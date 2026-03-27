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

// Load outbound threads with pre-computed metrics (no messages column)
export async function loadOutboundThreads(since) {
  var q = supabase
    .from("mb_outbound_threads")
    .select("thread_id, phone_number, template_sent_at, template_id, template_name, step_order, lead_qualification, hubspot_id, created_at, human_msg_count, ai_msg_count, total_word_count, is_auto_reply, has_tool, has_meeting_link, has_ig_link, has_ig_at, has_valid_response, first_human_ts, last_human_ts, first_human_hour, detected_lang, topic_flags")
    .gte("created_at", since)
    .order("thread_id");
  var { rows, error } = await fetchAllRows(q);
  if (error) { console.error("[metabaseSync] outbound error:", error.message); return []; }
  console.log("[metabaseSync] Loaded " + rows.length + " outbound threads from cache (no messages)");
  return rows;
}

// Load inbound threads with pre-computed metrics (no messages column)
export async function loadInboundThreads(since) {
  var q = supabase
    .from("mb_inbound_threads")
    .select("thread_id, phone_number, created_at, human_msg_count, ai_msg_count, total_word_count, is_auto_reply, has_tool, has_meeting_link, has_ig_link, has_ig_at, has_valid_response, first_human_ts, last_human_ts, first_human_hour, detected_lang, topic_flags, has_signup_link")
    .gte("created_at", since)
    .order("thread_id");
  var { rows, error } = await fetchAllRows(q);
  if (error) { console.error("[metabaseSync] inbound error:", error.message); return []; }
  console.log("[metabaseSync] Loaded " + rows.length + " inbound threads from cache (no messages)");
  return rows;
}

// Lazy load messages for specific threads (on-demand conversation loading)
export async function loadThreadMessages(threadIds, table) {
  if (!threadIds || threadIds.length === 0) return [];
  var { data, error } = await retryQuery(function() {
    return supabase.from(table).select("thread_id, messages").in("thread_id", threadIds);
  });
  if (error) { console.error("[sync] loadThreadMessages error:", error.message); return []; }
  return data || [];
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
