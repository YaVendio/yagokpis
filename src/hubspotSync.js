import { supabase, retryQuery } from "./supabase";

var PAGE_SIZE = 1000;

// Generic paginated fetch with retry — works around PostgREST max-rows (1000)
async function fetchAllRows(queryBuilder) {
  var all = [];
  var from = 0;
  while (true) {
    var { data, error } = await retryQuery(function() {
      return queryBuilder.range(from, from + PAGE_SIZE - 1);
    });
    if (error) { return { rows: all, error: error }; }
    if (!data || data.length === 0) break;
    for (var i = 0; i < data.length; i++) all.push(data[i]);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { rows: all, error: null };
}

// Load meetings from Supabase hs_meetings table
export async function loadMeetingsFromDb(sinceIso) {
  var q = supabase.from("hs_meetings").select("data").gte("hs_createdate", sinceIso);
  var { rows, error } = await fetchAllRows(q);
  if (error) { console.error("[sync] meetings error:", error.message); return []; }
  return rows.map(function(r) { return r.data; });
}

// Load contacts by IDs from Supabase hs_contacts table
export async function loadContactsFromDb(contactIds) {
  if (!contactIds || contactIds.length === 0) return [];
  // Batch in chunks of 300 to avoid URL length limits
  var all = [];
  for (var i = 0; i < contactIds.length; i += 300) {
    var chunk = contactIds.slice(i, i + 300);
    var { data, error } = await retryQuery(function() {
      return supabase.from("hs_contacts").select("data").in("id", chunk);
    });
    if (error) { console.error("[sync] contacts error:", error.message); continue; }
    if (data) for (var j = 0; j < data.length; j++) all.push(data[j]);
  }
  return all.map(function(r) { return r.data; });
}

// Load deals from Supabase hs_deals table
export async function loadDealsFromDb(sinceIso) {
  var q = supabase.from("hs_deals").select("data").in("pipeline", ["720627716", "833703951"]).gte("createdate", sinceIso);
  var { rows, error } = await fetchAllRows(q);
  if (error) { console.error("[sync] deals error:", error.message); return []; }
  return rows.map(function(r) { return r.data; });
}

// Load leads from Supabase hs_leads table
export async function loadLeadsFromDb(sinceIso, pipelineId) {
  var q = supabase.from("hs_leads").select("data").gte("hs_createdate", sinceIso);
  if (pipelineId) q = q.eq("hs_pipeline", pipelineId);
  var { rows, error } = await fetchAllRows(q);
  if (error) { console.error("[sync] leads error:", error.message); return []; }
  return rows.map(function(r) { return r.data; });
}

// Load owners from Supabase hs_owners table → returns { id: name } map
export async function loadOwnersFromDb() {
  var { data, error } = await retryQuery(function() {
    return supabase.from("hs_owners").select("id, name");
  });
  if (error) { console.error("[sync] owners error:", error.message); return {}; }
  var map = {};
  for (var i = 0; i < (data || []).length; i++) {
    map[data[i].id] = data[i].name;
  }
  return map;
}

// Load pipelines from Supabase hs_pipelines table
export async function loadPipelinesFromDb() {
  var { data, error } = await retryQuery(function() {
    return supabase.from("hs_pipelines").select("data").eq("id", "deals").single();
  });
  if (error) { console.error("[sync] pipelines error:", error.message); return null; }
  return data ? data.data : null;
}

// Load contacts by email from Supabase hs_contacts table (for sibling lookup)
export async function loadContactsByEmail(emails) {
  if (!emails || emails.length === 0) return [];
  var all = [];
  for (var i = 0; i < emails.length; i += 50) {
    var chunk = emails.slice(i, i + 50);
    var { data, error } = await retryQuery(function() {
      return supabase.from("hs_contacts").select("data").in("data->properties->>email", chunk);
    });
    if (error) { console.error("[sync] email contacts error:", error.message); continue; }
    if (data) for (var j = 0; j < data.length; j++) all.push(data[j]);
  }
  return all.map(function(r) { return r.data; });
}

// Trigger incremental sync on server (fire-and-forget from browser)
export async function triggerIncrementalSync() {
  var password = sessionStorage.getItem("dashboard_password") || "";
  try {
    await supabase.functions.invoke("hubspot-sync", {
      body: { password: password, mode: "incremental" }
    });
    console.log("[sync] Incremental sync triggered");
  } catch (e) {
    console.warn("[sync] Incremental sync trigger failed:", e.message);
  }
}
