import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HS_BASE = "https://api.hubapi.com";
const HS_TOKEN = () => Deno.env.get("HUBSPOT_API_TOKEN")!;

export function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// --- HubSpot API helpers ---

async function fetchWithRetry(url: string, opts: RequestInit, label: string, maxRetries = 2): Promise<any> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) return res.json();
      if (res.status === 429 && attempt < maxRetries) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "1", 10);
        const wait = Math.min(Math.max(retryAfter * 1000, 1000), 5000);
        console.warn(`[HS] ${label} rate limited, retrying in ${wait}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      const text = await res.text();
      throw new Error(`HS ${label} ${res.status}: ${text}`);
    } catch (e: any) {
      clearTimeout(timeout);
      if (e.name === "AbortError") {
        console.warn(`[HS] ${label} timed out (10s) attempt ${attempt + 1}/${maxRetries + 1}`);
        if (attempt < maxRetries) continue;
        throw new Error(`HS ${label} timed out after ${maxRetries + 1} attempts`);
      }
      throw e;
    }
  }
}

export async function hsGet(path: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(HS_BASE + path);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return fetchWithRetry(url.toString(), {
    headers: { Authorization: `Bearer ${HS_TOKEN()}`, "Content-Type": "application/json" },
  }, `GET ${path}`);
}

export async function hsPost(path: string, body: any): Promise<any> {
  return fetchWithRetry(HS_BASE + path, {
    method: "POST",
    headers: { Authorization: `Bearer ${HS_TOKEN()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, `POST ${path}`);
}

// Paginate through HubSpot Search API results
export async function fetchAllPaginated(
  path: string,
  searchBody: any,
  maxResults = 50000
): Promise<any[]> {
  const all: any[] = [];
  let after: string | undefined;
  while (true) {
    const body = { ...searchBody, limit: 100 };
    if (after) body.after = after;
    const data = await hsPost(path, body);
    if (data.results) all.push(...data.results);
    if (!data.paging?.next?.after) break;
    after = data.paging.next.after;
    if (all.length >= maxResults) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  return all;
}

// Paginate through HubSpot List API results
export async function fetchAllList(
  path: string,
  params: Record<string, string> = {},
  maxResults = 50000
): Promise<any[]> {
  const all: any[] = [];
  let after: string | undefined;
  while (true) {
    const p = { ...params, limit: "100" };
    if (after) p.after = after;
    const data = await hsGet(path, p);
    if (data.results) all.push(...data.results);
    if (!data.paging?.next?.after) break;
    after = data.paging.next.after;
    if (all.length >= maxResults) break;
  }
  return all;
}

// Batch read associations (v4 API, 100 per request, concurrency-limited)
export async function fetchBatchAssociations(
  fromType: string,
  toType: string,
  objectIds: string[],
  concurrency = 3
): Promise<Record<string, { id: string }[]>> {
  const map: Record<string, { id: string }[]> = {};
  const chunks: string[][] = [];
  for (let i = 0; i < objectIds.length; i += 100) {
    chunks.push(objectIds.slice(i, i + 100));
  }
  for (let ci = 0; ci < chunks.length; ci += concurrency) {
    const group = chunks.slice(ci, ci + concurrency);
    const results = await Promise.all(
      group.map((chunk) => {
        const inputs = chunk.map((id) => ({ id }));
        return hsPost(`/crm/v4/associations/${fromType}/${toType}/batch/read`, { inputs }).catch(
          (e) => {
            console.warn(`Batch assoc ${fromType}->${toType} error:`, e.message);
            return { results: [] };
          }
        );
      })
    );
    for (const batchData of results) {
      if (batchData.results) {
        for (const item of batchData.results) {
          const fromId = item.from?.id;
          if (fromId && item.to?.length > 0) {
            map[fromId] = item.to.map((t: any) => ({ id: String(t.toObjectId) }));
          }
        }
      }
    }
  }
  return map;
}

// Batch read objects by IDs
export async function fetchBatchRead(
  objectType: string,
  ids: string[],
  properties: string[],
  concurrency = 3
): Promise<any[]> {
  const all: any[] = [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) {
    chunks.push(ids.slice(i, i + 100));
  }
  for (let ci = 0; ci < chunks.length; ci += concurrency) {
    const group = chunks.slice(ci, ci + concurrency);
    const results = await Promise.all(
      group.map((batch) => {
        const inputs = batch.map((id) => ({ id }));
        return hsPost(`/crm/v3/objects/${objectType}/batch/read`, { inputs, properties }).catch(
          (e) => {
            console.warn(`Batch read ${objectType} error:`, e.message);
            return { results: [] };
          }
        );
      })
    );
    for (const r of results) {
      if (r.results) all.push(...r.results);
    }
  }
  return all;
}

// Upsert rows into Supabase in chunks
export async function batchUpsert(
  supabase: any,
  table: string,
  rows: any[],
  chunkSize = 500
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: "id" });
    if (error) throw new Error(`Upsert ${table} chunk ${i}: ${error.message}`);
  }
}

// CORS headers for edge functions
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json",
};
