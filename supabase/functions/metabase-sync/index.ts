import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getSupabaseAdmin, corsHeaders } from "../_shared/hubspot-helpers.ts";

const METABASE_URL = () => Deno.env.get("METABASE_URL")!;
const METABASE_API_KEY = () => Deno.env.get("METABASE_API_KEY")!;
const METABASE_DB_ID = () => Number(Deno.env.get("METABASE_DB_ID"));

async function queryMetabase(sql: string, dbIdOverride?: number): Promise<{ columns: string[]; results: any[][] }> {
  const resp = await fetch(METABASE_URL() + "/api/dataset", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": METABASE_API_KEY() },
    body: JSON.stringify({
      database: dbIdOverride ?? METABASE_DB_ID(),
      type: "native",
      native: { query: sql },
      constraints: { "max-results": 2000000, "max-results-bare-rows": 2000000 },
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Metabase ${resp.status}: ${text}`);
  }
  const data = await resp.json();
  return {
    columns: data.data.cols.map((c: any) => c.name),
    results: data.data.rows,
  };
}

function colIndex(columns: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  for (let i = 0; i < columns.length; i++) idx[columns[i]] = i;
  return idx;
}

function parseMessages(valuesJson: string | null): any[] {
  if (!valuesJson) return [];
  try {
    const parsed = JSON.parse(valuesJson);
    return parsed?.messages || [];
  } catch { return []; }
}

// --- Thread metrics pre-computation ---

const AUTO_REPLY_PATTERNS = [
  "gracias por comunicarte", "obrigado por entrar em contato",
  "en este momento no estamos disponibles", "no momento não estamos disponíveis",
  "responderemos lo antes posible", "responderemos o mais breve",
  "gracias por contactarnos", "obrigado por nos contatar",
  "thank you for contacting", "we are currently unavailable",
  "fuera del horario", "fora do horário",
  "mensaje automático", "mensagem automática",
  "respuesta automática", "resposta automática",
  "horario de atención", "horário de atendimento",
  "nuestro horario", "nosso horário",
  "le responderemos", "responderemos en breve",
  "te responderemos", "entraremos en contacto", "entraremos em contato",
  "gracias por escribirnos", "obrigado por nos escrever",
  "gracias por tu mensaje", "obrigado pela sua mensagem",
  "hemos recibido tu mensaje", "recebemos sua mensagem",
  "en breve un asesor", "em breve um atendente",
  "nos pondremos en contacto", "automatic reply", "auto-reply",
  "out of office", "fuera de oficina", "fora do escritório",
  "no estamos disponibles", "não estamos disponíveis",
  "bienvenido a", "bem-vindo a",
  "gracias por su mensaje", "obrigado por sua mensagem",
];

const TOPIC_KEYWORDS: Record<string, { flag: number; kw: string[] }> = {
  "Ventas": { flag: 1, kw: ["ventas", "vender", "vendedor", "factur", "ingreso", "revenue", "sales"] },
  "Soporte": { flag: 2, kw: ["soporte", "suporte", "problema", "error", "bug", "no funciona", "não funciona"] },
  "Automatización": { flag: 4, kw: ["automatiz", "inteligencia artificial"] },
  "Whatsapp": { flag: 8, kw: ["whatsapp"] },
  "Precios": { flag: 16, kw: ["precio", "preço", "costo", "cuánto cuesta", "quanto custa", "tarifa", "mensualidad"] },
  "Configuración": { flag: 32, kw: ["configurar", "conectar", "integrar", "instalar", "setup", "vincular"] },
};

function extractContent(msg: any): string {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    const parts: string[] = [];
    for (const b of msg.content) {
      if (typeof b === "string") parts.push(b);
      else if (b && b.text) parts.push(b.text);
      else if (b && b.type === "tool_use" && b.input) {
        for (const k in b.input) {
          if (typeof b.input[k] === "string") parts.push(b.input[k]);
        }
      }
    }
    return parts.join(" ");
  }
  return "";
}

function getMsgTimestamp(msg: any): Date | null {
  const ts = msg?.additional_kwargs?.metadata?.timestamp;
  if (!ts) return null;
  if (typeof ts === "number") return new Date(ts * 1000);
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

function checkAutoReply(content: string): boolean {
  if (!content) return false;
  const lower = content.toLowerCase();
  for (const pattern of AUTO_REPLY_PATTERNS) {
    if (lower.includes(pattern)) return true;
  }
  return false;
}

function detectLangOutbound(templateName: string | null, messages: any[]): string {
  if (templateName) {
    if (templateName.startsWith("pt_") || templateName.includes("_br")) return "pt";
    if (templateName.startsWith("es_")) return "es";
  }
  for (const msg of messages) {
    const c = extractContent(msg);
    if (c.includes("[Esta mensagem foi enviada automaticamente pelo YaVendió]")) return "pt";
    if (c.includes("[Este mensaje fue enviado automáticamente por YaVendió]")) return "es";
  }
  return "es";
}

function detectLangInbound(phone: string, messages: any[]): string {
  const clean = (phone || "").replace(/\D/g, "");
  if (clean.startsWith("55") && clean.length >= 12) return "pt";
  const ptIndicators = ["obrigado", "olá", "você", "preciso", "tenho", "quero", "posso", "vocês", "não", "sim", "bom dia", "boa tarde"];
  const esIndicators = ["hola", "gracias", "necesito", "tengo", "quiero", "puedo", "ustedes", "buenos días", "buenas tardes", "por favor"];
  let ptScore = 0, esScore = 0;
  for (const msg of messages) {
    if (msg.type !== "human") continue;
    const c = extractContent(msg).toLowerCase();
    if (!c) continue;
    for (const p of ptIndicators) { if (c.includes(p)) ptScore++; }
    for (const e of esIndicators) { if (c.includes(e)) esScore++; }
  }
  return ptScore > esScore ? "pt" : "es";
}

function computeThreadMetrics(
  messages: any[],
  opts: { templateSentAt?: string | null; templateName?: string | null; isOutbound: boolean; phone?: string }
) {
  let humanCount = 0;
  let aiCount = 0;
  let wordCount = 0;
  let firstHumanTs: Date | null = null;
  let lastHumanTs: Date | null = null;
  let firstHumanContent: string | null = null;
  let hasTool = false;
  let hasMeetingLink = false;
  let hasIgLink = false;
  let hasIgAt = false;
  let hasSignupLink = false;
  let allText = "";
  const sentAt = opts.templateSentAt ? new Date(opts.templateSentAt) : null;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  let hasValidResponse = false;

  for (const msg of messages) {
    const content = extractContent(msg);
    const type = msg.type;
    const ts = getMsgTimestamp(msg);

    if (type === "human") {
      humanCount++;
      const words = content.trim().split(/\s+/).filter((w: string) => w.length > 0);
      wordCount += words.length;
      allText += " " + content;
      if (firstHumanContent === null) firstHumanContent = content;
      if (ts) {
        if (!firstHumanTs || ts < firstHumanTs) firstHumanTs = ts;
        if (!lastHumanTs || ts > lastHumanTs) lastHumanTs = ts;
      }
      if (/instagram\.com/i.test(content)) hasIgLink = true;
      if (/@\w+|ig\s*:/i.test(content)) hasIgAt = true;
      if (opts.isOutbound && sentAt && ts) {
        if (ts >= sentAt && ts <= new Date(sentAt.getTime() + sevenDaysMs)) hasValidResponse = true;
      }
    } else if (type === "ai") {
      aiCount++;
      allText += " " + content;
      if (/meetings\.hubspot\.com\//.test(content) || /yavendio\.com\/[^\s]*meetings/.test(content)) hasMeetingLink = true;
      if (!opts.isOutbound && /yavendio\.com|yavendió\.com|crear\s+(?:tu\s+)?cuenta|criar\s+(?:sua\s+)?conta|crea\s+una\s+cuenta|registr(?:ar|ate|o)/i.test(content)) hasSignupLink = true;
    } else if (type === "tool") {
      hasTool = true;
    }
  }

  if (!opts.isOutbound && humanCount > 0) hasValidResponse = true;

  let isAutoReply = false;
  if (humanCount === 1 && firstHumanContent) isAutoReply = checkAutoReply(firstHumanContent);

  const detectedLang = opts.isOutbound
    ? detectLangOutbound(opts.templateName || null, messages)
    : detectLangInbound(opts.phone || "", messages);

  let topicFlags = 0;
  const convLower = allText.toLowerCase();
  for (const topicName in TOPIC_KEYWORDS) {
    const td = TOPIC_KEYWORDS[topicName];
    for (const kw of td.kw) {
      if (convLower.includes(kw)) { topicFlags |= td.flag; break; }
    }
  }

  const result: any = {
    human_msg_count: humanCount,
    ai_msg_count: aiCount,
    total_word_count: wordCount,
    is_auto_reply: isAutoReply,
    has_tool: hasTool,
    has_meeting_link: hasMeetingLink,
    has_ig_link: hasIgLink,
    has_ig_at: hasIgAt,
    has_valid_response: hasValidResponse,
    first_human_ts: firstHumanTs ? firstHumanTs.toISOString() : null,
    last_human_ts: lastHumanTs ? lastHumanTs.toISOString() : null,
    first_human_hour: firstHumanTs ? firstHumanTs.getUTCHours() : null,
    detected_lang: detectedLang,
    topic_flags: topicFlags,
  };
  if (!opts.isOutbound) result.has_signup_link = hasSignupLink;
  return result;
}

// --- Sync functions ---

async function syncOutboundThreads(sb: any, since: string): Promise<number> {
  const sql = `WITH last_lead_qualification AS (
    SELECT DISTINCT ON (company_id)
        company_id,
        event_data->>'qualification' AS lead_qualification,
        event_data->>'hubspot_ID' AS hubspot_id
    FROM lifecycle_events
    WHERE event_name = 'lead_qualification'
    ORDER BY company_id, event_timestamp DESC
)
SELECT
    t.thread_id,
    le.phone_number,
    le.sent_at AS template_sent_at,
    le.template_id,
    le.template_name,
    lfs.step_order,
    llq.lead_qualification,
    llq.hubspot_id,
    t."values"::text AS values_json
FROM thread t
JOIN lifecycle_executions le
    ON (t.metadata->>'execution_id') = le.id::text
JOIN lifecycle_flow_steps lfs
    ON le.step_id = lfs.id
LEFT JOIN last_lead_qualification llq
    ON llq.company_id = le.company_id
WHERE le.flow_id = 1
    AND le.sent_at >= '${since}'
ORDER BY t.thread_id`;

  const result = await queryMetabase(sql);
  const ci = colIndex(result.columns);

  const rows: any[] = [];
  for (const row of result.results) {
    const messages = parseMessages(row[ci["values_json"]]);
    const templateName = row[ci["template_name"]] || null;
    const templateSentAt = row[ci["template_sent_at"]] || null;

    const metrics = computeThreadMetrics(messages, {
      templateSentAt, templateName, isOutbound: true,
    });

    rows.push({
      thread_id: row[ci["thread_id"]],
      phone_number: row[ci["phone_number"]] || null,
      template_sent_at: templateSentAt,
      template_id: row[ci["template_id"]] || null,
      template_name: templateName,
      step_order: row[ci["step_order"]] || null,
      lead_qualification: row[ci["lead_qualification"]] || null,
      hubspot_id: row[ci["hubspot_id"]] || null,
      messages,
      created_at: templateSentAt,
      synced_at: new Date().toISOString(),
      ...metrics,
    });
  }

  // Upsert in chunks of 500
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await sb.from("mb_outbound_threads").upsert(chunk, { onConflict: "thread_id" });
    if (error) throw new Error(`Upsert mb_outbound_threads chunk ${i}: ${error.message}`);
  }

  return rows.length;
}

async function syncInboundThreads(sb: any, since: string, skipMessages = false): Promise<number> {
  const BATCH = 25;
  let total = 0;
  let offset = 0;

  while (true) {
    const sql = `SELECT
    t.thread_id,
    COALESCE(t.metadata->>'phone_number', t.metadata->>'phone',
             t.metadata->>'wa_id', t.metadata->>'contact_phone', '') AS phone_number,
    t.created_at AS thread_created_at,
    t."values"::text AS values_json
FROM thread t
WHERE t.created_at >= '${since}'
  AND (t.metadata->>'flow_id' IS DISTINCT FROM '1')
ORDER BY t.thread_id
LIMIT ${BATCH} OFFSET ${offset}`;

    const result = await queryMetabase(sql);
    if (!result.results || result.results.length === 0) break;
    const ci = colIndex(result.columns);

    const rows: any[] = [];
    for (const row of result.results) {
      const phone = row[ci["phone_number"]] || "";
      const messages = parseMessages(row[ci["values_json"]]);

      let resolvedPhone = phone;
      if (!resolvedPhone) {
        for (const msg of messages) {
          const meta = msg?.additional_kwargs?.metadata;
          if (meta) {
            resolvedPhone = meta.phone_number || meta.phone || meta.wa_id || meta.contact_phone || "";
            if (resolvedPhone) break;
          }
        }
      }

      const metrics = computeThreadMetrics(messages, {
        isOutbound: false, phone: resolvedPhone,
      });

      rows.push({
        thread_id: row[ci["thread_id"]],
        phone_number: resolvedPhone || null,
        created_at: row[ci["thread_created_at"]] || null,
        messages,
        synced_at: new Date().toISOString(),
        ...metrics,
      });
    }

    const upsertRows = skipMessages ? rows.map(r => { const { messages: _, ...rest } = r; return rest; }) : rows;
    for (let i = 0; i < upsertRows.length; i += 50) {
      const chunk = upsertRows.slice(i, i + 50);
      const { error } = await sb.from("mb_inbound_threads").upsert(chunk, { onConflict: "thread_id" });
      if (error) throw new Error(`Upsert mb_inbound_threads chunk ${i}: ${error.message}`);
    }

    total += rows.length;
    console.log(`[metabase-sync] Inbound batch: offset=${offset}, fetched=${rows.length}`);
    if (result.results.length < BATCH) break;
    offset += BATCH;
  }

  return total;
}

async function syncLifecyclePhones(sb: any): Promise<number> {
  const sql = `SELECT
    le.phone_number,
    MIN(le.sent_at) AS first_lifecycle_at,
    MIN(CASE WHEN lfs.step_order = 1 THEN le.sent_at ELSE NULL END) AS first_step1_at
FROM lifecycle_executions le
JOIN lifecycle_flow_steps lfs ON le.step_id = lfs.id
WHERE le.sent_at >= '2025-01-01'
GROUP BY le.phone_number`;

  const result = await queryMetabase(sql);

  const rows: any[] = [];
  for (const row of result.results) {
    if (!row[0]) continue;
    rows.push({
      phone_number: row[0],
      first_lifecycle_at: row[1] || null,
      first_step1_at: row[2] || null,
      synced_at: new Date().toISOString(),
    });
  }

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await sb.from("mb_lifecycle_phones").upsert(chunk, { onConflict: "phone_number" });
    if (error) throw new Error(`Upsert mb_lifecycle_phones chunk ${i}: ${error.message}`);
  }

  return rows.length;
}

// --- PostHog engagement syncs (WhatsApp connected, Products created) ---
//
// WhatsApp event carries properties.phone_number directly.
// Products event has no phone, so we join to the WhatsApp event via person_id to retrieve it
// (creating a product without a connected WhatsApp is not supported in the product, so this JOIN
//  is the narrative-correct matching).
// Event name casings vary in history ("Whatsapp" and "WhatsApp"); we match both.

async function queryPostHog(hogql: string): Promise<{ results: any[][] }> {
  const apiKey = Deno.env.get("POSTHOG_PERSONAL_API_KEY");
  if (!apiKey) throw new Error("POSTHOG_PERSONAL_API_KEY not configured");
  const host = Deno.env.get("POSTHOG_HOST") || "https://us.posthog.com";
  const projectId = Deno.env.get("POSTHOG_PROJECT_ID") || "@current";
  const resp = await fetch(host + "/api/projects/" + projectId + "/query/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query: hogql } }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`PostHog ${resp.status}: ${text}`);
  }
  const data = await resp.json();
  return { results: data.results || [] };
}

async function syncWhatsAppConnectedPhones(sb: any): Promise<number> {
  const sql = `SELECT properties.phone_number AS phone, min(timestamp) AS first_at
    FROM events
    WHERE event IN ('Whatsapp Connection: Completed', 'WhatsApp Connection: Completed')
      AND properties.phone_number IS NOT NULL
    GROUP BY properties.phone_number
    LIMIT 1000000`;
  const result = await queryPostHog(sql);

  const rows: any[] = [];
  const seen = new Set<string>();
  for (const row of result.results) {
    if (!row[0] || !row[1]) continue;
    const clean = String(row[0]).replace(/\D/g, "");
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    rows.push({ phone_number: clean, connected_at: row[1], synced_at: new Date().toISOString() });
  }

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await sb.from("mb_whatsapp_connected_phones").upsert(chunk, { onConflict: "phone_number" });
    if (error) throw new Error(`Upsert mb_whatsapp_connected_phones chunk ${i}: ${error.message}`);
  }
  return rows.length;
}

async function syncProductsCreatedPhones(sb: any): Promise<number> {
  const sql = `SELECT wa.phone AS phone, min(pc.ts) AS first_at
    FROM (
      SELECT person_id, min(timestamp) AS ts
      FROM events
      WHERE event = 'Product: Created'
      GROUP BY person_id
    ) pc
    JOIN (
      SELECT person_id, any(properties.phone_number) AS phone
      FROM events
      WHERE event IN ('Whatsapp Connection: Completed', 'WhatsApp Connection: Completed')
        AND properties.phone_number IS NOT NULL
      GROUP BY person_id
    ) wa ON pc.person_id = wa.person_id
    GROUP BY wa.phone
    LIMIT 1000000`;
  const result = await queryPostHog(sql);

  const rows: any[] = [];
  const seen = new Set<string>();
  for (const row of result.results) {
    if (!row[0] || !row[1]) continue;
    const clean = String(row[0]).replace(/\D/g, "");
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    rows.push({ phone_number: clean, created_at: row[1], synced_at: new Date().toISOString() });
  }

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await sb.from("mb_products_created_phones").upsert(chunk, { onConflict: "phone_number" });
    if (error) throw new Error(`Upsert mb_products_created_phones chunk ${i}: ${error.message}`);
  }
  return rows.length;
}

// Discovery helper: returns top events matching common engagement keywords.
async function discoverPostHogEvents(): Promise<any> {
  const evSql = `SELECT event, count() AS n
    FROM events
    WHERE timestamp > now() - interval 90 day
      AND (event ILIKE '%whatsapp%' OR event ILIKE '%product%' OR event ILIKE '%instance%' OR event ILIKE '%connect%')
    GROUP BY event
    ORDER BY n DESC
    LIMIT 50`;
  const events = await queryPostHog(evSql);
  return {
    candidate_events: events.results.map((r) => ({ event: r[0], count: r[1] })),
  };
}

async function syncActivatedPhones(sb: any): Promise<number> {
  const sql = `SELECT phone, business_activated_at
    FROM companies
    WHERE business_activated_at IS NOT NULL
      AND phone IS NOT NULL`;

  const result = await queryMetabase(sql, 2);

  const rows: any[] = [];
  const seen = new Set<string>();
  for (const row of result.results) {
    if (!row[0] || !row[1]) continue;
    const clean = String(row[0]).replace(/\D/g, "");
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    rows.push({
      phone_number: clean,
      activated_at: row[1],
      synced_at: new Date().toISOString(),
    });
  }

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await sb.from("mb_activated_phones").upsert(chunk, { onConflict: "phone_number" });
    if (error) throw new Error(`Upsert mb_activated_phones chunk ${i}: ${error.message}`);
  }

  return rows.length;
}

async function syncResponseStats(sb: any, since: string): Promise<void> {
  const sql = `WITH outbound AS (
    SELECT COUNT(DISTINCT phone_number) AS outbound_total
    FROM lifecycle_executions
    WHERE flow_id = 1
      AND status = 'sent'
      AND sent_at >= '${since}'
),
responded_base AS (
    SELECT
        metadata->>'phone_number' AS phone_number,
        "values"->'messages' AS messages,
        ROW_NUMBER() OVER (
            PARTITION BY metadata->>'phone_number'
            ORDER BY created_at DESC
        ) AS rn
    FROM thread
    WHERE created_at >= '${since}'
      AND COALESCE(metadata->>'channel', '') != 'cgr'
      AND metadata->>'flow_id' = '1'
      AND metadata->>'phone_number' IS NOT NULL
      AND jsonb_array_length(COALESCE("values"->'messages', '[]'::jsonb)) > 0
      AND EXISTS (
          SELECT 1 FROM jsonb_array_elements("values"->'messages') m
          WHERE m->>'type' = 'human'
      )
),
outbound_responded AS (
    SELECT COUNT(*) AS outbound_responded
    FROM responded_base WHERE rn = 1
),
outbound_responded_real AS (
    SELECT COUNT(*) AS outbound_responded_real
    FROM responded_base t
    CROSS JOIN LATERAL (
        SELECT
            (SELECT count(*) FROM jsonb_array_elements(t.messages) m2 WHERE m2->>'type' = 'human') AS human_count,
            (SELECT COALESCE(m3.val->>'content', '')
             FROM jsonb_array_elements(t.messages) WITH ORDINALITY AS m3(val, idx)
             WHERE m3.val->>'type' = 'human' ORDER BY m3.idx LIMIT 1
            ) AS first_human_content,
            (SELECT (m4.val #>> '{additional_kwargs,metadata,timestamp}')::numeric
             FROM jsonb_array_elements(t.messages) WITH ORDINALITY AS m4(val, idx)
             WHERE m4.val->>'type' = 'human' ORDER BY m4.idx LIMIT 1
            ) AS first_human_ts,
            (SELECT max((m5.val #>> '{additional_kwargs,metadata,timestamp}')::numeric)
             FROM jsonb_array_elements(t.messages) WITH ORDINALITY AS m5(val, idx)
             WHERE m5.val->>'type' = 'ai'
               AND m5.idx < (SELECT min(h2.idx) FROM jsonb_array_elements(t.messages) WITH ORDINALITY AS h2(val, idx) WHERE h2.val->>'type' = 'human')
            ) AS preceding_ai_ts
    ) h
    WHERE t.rn = 1
      AND NOT (
          h.human_count = 1
          AND (
              (h.first_human_ts IS NOT NULL AND h.preceding_ai_ts IS NOT NULL AND (h.first_human_ts - h.preceding_ai_ts) < 10)
              OR lower(h.first_human_content) LIKE '%gracias por comunicarte%'
              OR lower(h.first_human_content) LIKE '%obrigado por entrar em contato%'
              OR lower(h.first_human_content) LIKE '%en este momento no estamos disponibles%'
              OR lower(h.first_human_content) LIKE '%no momento n\\u00e3o estamos dispon\\u00edveis%'
              OR lower(h.first_human_content) LIKE '%responderemos lo antes posible%'
              OR lower(h.first_human_content) LIKE '%responderemos o mais breve%'
              OR lower(h.first_human_content) LIKE '%gracias por contactarnos%'
              OR lower(h.first_human_content) LIKE '%obrigado por nos contatar%'
              OR lower(h.first_human_content) LIKE '%thank you for contacting%'
              OR lower(h.first_human_content) LIKE '%we are currently unavailable%'
              OR lower(h.first_human_content) LIKE '%fuera del horario%'
              OR lower(h.first_human_content) LIKE '%fora do hor\\u00e1rio%'
              OR lower(h.first_human_content) LIKE '%mensaje autom\\u00e1tico%'
              OR lower(h.first_human_content) LIKE '%mensagem autom\\u00e1tica%'
              OR lower(h.first_human_content) LIKE '%respuesta autom\\u00e1tica%'
              OR lower(h.first_human_content) LIKE '%resposta autom\\u00e1tica%'
              OR lower(h.first_human_content) LIKE '%horario de atenci\\u00f3n%'
              OR lower(h.first_human_content) LIKE '%hor\\u00e1rio de atendimento%'
              OR lower(h.first_human_content) LIKE '%nuestro horario%'
              OR lower(h.first_human_content) LIKE '%nosso hor\\u00e1rio%'
              OR lower(h.first_human_content) LIKE '%le responderemos%'
              OR lower(h.first_human_content) LIKE '%responderemos en breve%'
              OR lower(h.first_human_content) LIKE '%te responderemos%'
              OR lower(h.first_human_content) LIKE '%entraremos en contacto%'
              OR lower(h.first_human_content) LIKE '%entraremos em contato%'
              OR lower(h.first_human_content) LIKE '%gracias por escribirnos%'
              OR lower(h.first_human_content) LIKE '%obrigado por nos escrever%'
              OR lower(h.first_human_content) LIKE '%gracias por tu mensaje%'
              OR lower(h.first_human_content) LIKE '%obrigado pela sua mensagem%'
              OR lower(h.first_human_content) LIKE '%hemos recibido tu mensaje%'
              OR lower(h.first_human_content) LIKE '%recebemos sua mensagem%'
              OR lower(h.first_human_content) LIKE '%en breve un asesor%'
              OR lower(h.first_human_content) LIKE '%em breve um atendente%'
              OR lower(h.first_human_content) LIKE '%nos pondremos en contacto%'
              OR lower(h.first_human_content) LIKE '%automatic reply%'
              OR lower(h.first_human_content) LIKE '%auto-reply%'
              OR lower(h.first_human_content) LIKE '%out of office%'
              OR lower(h.first_human_content) LIKE '%fuera de oficina%'
              OR lower(h.first_human_content) LIKE '%fora do escrit\\u00f3rio%'
              OR lower(h.first_human_content) LIKE '%no estamos disponibles%'
              OR lower(h.first_human_content) LIKE '%n\\u00e3o estamos dispon\\u00edveis%'
              OR lower(h.first_human_content) LIKE '%bienvenido a%'
              OR lower(h.first_human_content) LIKE '%bem-vindo a%'
              OR lower(h.first_human_content) LIKE '%gracias por su mensaje%'
              OR lower(h.first_human_content) LIKE '%obrigado por sua mensagem%'
          )
      )
),
all_conversational AS (
    SELECT COUNT(*) AS inbound
    FROM (
        SELECT
            COALESCE(metadata->>'phone_number', thread_id::text) AS uid,
            ROW_NUMBER() OVER (
                PARTITION BY COALESCE(metadata->>'phone_number', thread_id::text)
                ORDER BY created_at DESC
            ) AS rn
        FROM thread
        WHERE created_at >= '${since}'
          AND COALESCE(metadata->>'channel', '') != 'cgr'
          AND jsonb_array_length(COALESCE(values->'messages', '[]'::jsonb)) > 0
          AND (metadata->>'flow_id' IS DISTINCT FROM '1')
          AND EXISTS (
              SELECT 1 FROM jsonb_array_elements(values->'messages') m
              WHERE m->>'type' = 'human'
          )
          AND EXISTS (
              SELECT 1 FROM jsonb_array_elements(values->'messages') m
              WHERE m->>'type' = 'ai'
          )
    ) t WHERE rn = 1
)
SELECT
    o.outbound_total,
    r.outbound_responded,
    rr.outbound_responded_real,
    i.inbound
FROM outbound o, outbound_responded r, outbound_responded_real rr, all_conversational i`;

  const result = await queryMetabase(sql);
  if (!result.results || result.results.length === 0) return;

  const row = result.results[0];
  const stats = {
    outboundTotal: row[0] || 0,
    outboundResponded: row[1] || 0,
    outboundRespondedReal: row[2] || 0,
    inbound: row[3] || 0,
  };

  const cacheKey = "response_stats_" + since;
  await sb.from("hubspot_cache").upsert({
    key: cacheKey,
    data: stats,
    updated_at: new Date().toISOString(),
  });
}

// --- Main handler ---

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const { password, step, backfill } = await req.json();
  if (!password || password !== Deno.env.get("DASHBOARD_PASSWORD")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: corsHeaders,
    });
  }

  const sb = getSupabaseAdmin();

  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  const sinceStr = since.toISOString().slice(0, 10);

  // Single-step mode: run only one sync to avoid memory limits
  if (step) {
    try {
      let result: any = {};
      if (step === "outbound") {
        const count = await syncOutboundThreads(sb, sinceStr);
        result = { outbound_threads: count };
      } else if (step === "inbound") {
        const count = await syncInboundThreads(sb, sinceStr, !!backfill);
        result = { inbound_threads: count };
      } else if (step === "lifecycle") {
        const count = await syncLifecyclePhones(sb);
        result = { lifecycle_phones: count };
      } else if (step === "activations") {
        const count = await syncActivatedPhones(sb);
        result = { activated_phones: count };
      } else if (step === "whatsapp") {
        const count = await syncWhatsAppConnectedPhones(sb);
        result = { whatsapp_connected_phones: count };
      } else if (step === "products") {
        const count = await syncProductsCreatedPhones(sb);
        result = { products_created_phones: count };
      } else if (step === "posthog_discover") {
        result = await discoverPostHogEvents();
      } else if (step === "stats") {
        await syncResponseStats(sb, sinceStr);
        result = { response_stats: "ok" };
      } else {
        return new Response(JSON.stringify({ error: "Unknown step: " + step }), {
          status: 400, headers: corsHeaders,
        });
      }
      console.log(`[metabase-sync] step=${step}`, result);
      await sb.from("mb_sync_log").insert({
        sync_type: step, status: "completed",
        completed_at: new Date().toISOString(), details: result,
      });
      return new Response(JSON.stringify({ ok: true, step, ...result }), { headers: corsHeaders });
    } catch (err) {
      console.error(`[metabase-sync] step=${step} error:`, err.message);
      await sb.from("mb_sync_log").insert({
        sync_type: step, status: "error",
        completed_at: new Date().toISOString(), details: { error: err.message },
      });
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: corsHeaders,
      });
    }
  }

  // Full mode (all steps sequentially) — may hit memory limits on free tier
  const { data: logRow } = await sb.from("mb_sync_log").insert({
    sync_type: "full", status: "running",
  }).select("id").single();
  const logId = logRow?.id;
  const details: Record<string, any> = {};

  try {
    const outCount = await syncOutboundThreads(sb, sinceStr);
    details.outbound_threads = outCount;
    console.log(`[metabase-sync] Outbound threads: ${outCount}`);

    const inCount = await syncInboundThreads(sb, sinceStr);
    details.inbound_threads = inCount;
    console.log(`[metabase-sync] Inbound threads: ${inCount}`);

    const lcCount = await syncLifecyclePhones(sb);
    details.lifecycle_phones = lcCount;
    console.log(`[metabase-sync] Lifecycle phones: ${lcCount}`);

    const actCount = await syncActivatedPhones(sb);
    details.activated_phones = actCount;
    console.log(`[metabase-sync] Activated phones: ${actCount}`);

    try {
      const waCount = await syncWhatsAppConnectedPhones(sb);
      details.whatsapp_connected_phones = waCount;
      console.log(`[metabase-sync] WhatsApp connected phones: ${waCount}`);
    } catch (e) {
      details.whatsapp_connected_phones_error = (e as Error).message;
      console.warn(`[metabase-sync] WhatsApp sync failed: ${(e as Error).message}`);
    }

    try {
      const pcCount = await syncProductsCreatedPhones(sb);
      details.products_created_phones = pcCount;
      console.log(`[metabase-sync] Products created phones: ${pcCount}`);
    } catch (e) {
      details.products_created_phones_error = (e as Error).message;
      console.warn(`[metabase-sync] Products sync failed: ${(e as Error).message}`);
    }

    await syncResponseStats(sb, sinceStr);
    details.response_stats = "ok";
    console.log(`[metabase-sync] Response stats cached`);

    if (logId) {
      await sb.from("mb_sync_log").update({
        completed_at: new Date().toISOString(),
        status: "completed", details,
      }).eq("id", logId);
    }
    return new Response(JSON.stringify({ ok: true, details }), { headers: corsHeaders });
  } catch (err) {
    console.error("[metabase-sync] Error:", err.message);
    details.error = err.message;
    if (logId) {
      await sb.from("mb_sync_log").update({
        completed_at: new Date().toISOString(),
        status: "error", details,
      }).eq("id", logId);
    }
    return new Response(JSON.stringify({ error: err.message, details }), {
      status: 500, headers: corsHeaders,
    });
  }
});
