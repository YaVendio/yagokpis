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

// Load ALL distinct template names (no date filter) for config screen
// Merges two sources: Metabase (full history: names, total_sent, last_sent) + Supabase RPC (reliable response rates from March+)
export async function loadAllTemplateNames(queryMetabaseFn) {
  // 1. Supabase RPC: reliable response data from cached outbound threads
  var respMap = {};
  var { data: sbData, error: sbErr } = await retryQuery(function() {
    return supabase.rpc("get_all_template_names");
  });
  if (sbErr) { console.error("[metabaseSync] Supabase template RPC error:", sbErr.message); }
  if (sbData) {
    for (var si = 0; si < sbData.length; si++) {
      var s = sbData[si];
      respMap[s.template_name] = { total_sent: s.total_sent || 0, total_resp: s.total_resp || 0 };
    }
  }

  // 2. Metabase (Huble): full history — names, total_sent, step_order, last_sent
  if (queryMetabaseFn) {
    try {
      var mbResult = await queryMetabaseFn(
        "SELECT le.template_name, lfs.step_order, " +
        "COUNT(DISTINCT le.id) AS total_sent, " +
        "MAX(le.sent_at) AS last_sent " +
        "FROM lifecycle_executions le " +
        "JOIN lifecycle_flow_steps lfs ON le.step_id = lfs.id " +
        "WHERE le.flow_id = 1 AND le.template_name IS NOT NULL AND le.template_name != '' " +
        "GROUP BY le.template_name, lfs.step_order " +
        "ORDER BY total_sent DESC"
      );
      if (mbResult && mbResult.results && mbResult.results.length > 0) {
        var colIdx = {};
        for (var ci = 0; ci < mbResult.columns.length; ci++) colIdx[mbResult.columns[ci]] = ci;
        var rows = [];
        for (var ri = 0; ri < mbResult.results.length; ri++) {
          var r = mbResult.results[ri];
          var tName = r[colIdx["template_name"]];
          var sbInfo = respMap[tName];
          rows.push({
            template_name: tName,
            step_order: r[colIdx["step_order"]] || null,
            total_sent: r[colIdx["total_sent"]] || 0,
            total_resp: sbInfo ? sbInfo.total_resp : null,
            last_sent: r[colIdx["last_sent"]] || null,
          });
        }
        // Add any templates in Supabase but not in Metabase
        var mbNames = {};
        for (var mi = 0; mi < rows.length; mi++) mbNames[rows[mi].template_name] = true;
        for (var sName in respMap) {
          if (!mbNames[sName]) {
            rows.push({
              template_name: sName,
              step_order: null,
              total_sent: respMap[sName].total_sent || 0,
              total_resp: respMap[sName].total_resp || 0,
              last_sent: null,
            });
          }
        }
        console.log("[metabaseSync] Loaded " + rows.length + " templates (Metabase + Supabase merge)");
        return rows;
      }
    } catch (e) {
      console.warn("[metabaseSync] Metabase template query failed, using Supabase only:", e.message);
    }
  }
  // Fallback: Supabase cache only
  return sbData || [];
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
