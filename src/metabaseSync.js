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

// Reconstruct values_json from messages column so expandThreadMessages() works unchanged
function threadToValuesFormat(row) {
  return {
    thread_id: row.thread_id,
    phone_number: row.phone_number || "",
    template_sent_at: row.template_sent_at || "",
    template_id: row.template_id || "",
    template_name: row.template_name || "",
    step_order: row.step_order,
    lead_qualification: row.lead_qualification || "",
    hubspot_id: row.hubspot_id || "",
    values_json: JSON.stringify({ messages: row.messages || [] }),
  };
}

function inboundThreadToValuesFormat(row) {
  return {
    thread_id: row.thread_id,
    phone_number: row.phone_number || "",
    thread_created_at: row.created_at || "",
    values_json: JSON.stringify({ messages: row.messages || [] }),
  };
}

// Load outbound threads from mb_outbound_threads
export async function loadOutboundThreads(since) {
  var q = supabase
    .from("mb_outbound_threads")
    .select("thread_id, phone_number, template_sent_at, template_id, template_name, step_order, lead_qualification, hubspot_id, messages, created_at")
    .gte("created_at", since)
    .order("thread_id");
  var { rows, error } = await fetchAllRows(q);
  if (error) { console.error("[metabaseSync] outbound error:", error.message); return []; }
  var threads = [];
  for (var i = 0; i < rows.length; i++) {
    threads.push(threadToValuesFormat(rows[i]));
  }
  console.log("[metabaseSync] Loaded " + threads.length + " outbound threads from cache");
  return threads;
}

// Load inbound threads from mb_inbound_threads
export async function loadInboundThreads(since) {
  var q = supabase
    .from("mb_inbound_threads")
    .select("thread_id, phone_number, created_at, messages")
    .gte("created_at", since)
    .order("thread_id");
  var { rows, error } = await fetchAllRows(q);
  if (error) { console.error("[metabaseSync] inbound error:", error.message); return []; }
  var threads = [];
  for (var i = 0; i < rows.length; i++) {
    threads.push(inboundThreadToValuesFormat(rows[i]));
  }
  console.log("[metabaseSync] Loaded " + threads.length + " inbound threads from cache");
  return threads;
}

// Load lifecycle phones from mb_lifecycle_phones → { phone: { firstAt, firstStep1At } }
export async function loadLifecyclePhones() {
  var q = supabase
    .from("mb_lifecycle_phones")
    .select("phone_number, first_lifecycle_at, first_step1_at");
  var { rows, error } = await fetchAllRows(q);
  if (error) { console.error("[metabaseSync] lifecycle error:", error.message); return {}; }
  var phones = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.phone_number) {
      phones[r.phone_number] = {
        firstAt: r.first_lifecycle_at || null,
        firstStep1At: r.first_step1_at || null,
      };
    }
  }
  console.log("[metabaseSync] Loaded " + Object.keys(phones).length + " lifecycle phones from cache");
  return phones;
}
