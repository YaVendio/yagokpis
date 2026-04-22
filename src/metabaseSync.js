import { supabase, retryQuery } from "./supabase";
import { staleWhileRevalidate, setCache, getStale } from "./dataCache";

var PAGE_SIZE = 1000;
var MAX_PARALLEL = 3;

// Generic paginated fetch with retry — works around PostgREST max-rows (1000)
// Accepts a factory function that returns a fresh query builder for each page
async function fetchAllRows(queryFactory) {
  // First page: sequential to determine if more pages needed
  var { data, error } = await retryQuery(function() {
    return queryFactory().range(0, PAGE_SIZE - 1);
  });
  if (error) { return { rows: [], error: error }; }
  if (!data || data.length === 0) return { rows: [], error: null };

  var all = data.slice();
  if (data.length < PAGE_SIZE) return { rows: all, error: null };

  // First page was full — fetch remaining pages in parallel batches
  var from = PAGE_SIZE;
  var done = false;
  while (!done) {
    // Create a batch of up to MAX_PARALLEL requests
    var batch = [];
    for (var b = 0; b < MAX_PARALLEL; b++) {
      var start = from + b * PAGE_SIZE;
      batch.push((function(s) {
        return retryQuery(function() { return queryFactory().range(s, s + PAGE_SIZE - 1); });
      })(start));
    }
    var results = await Promise.all(batch);
    for (var ri = 0; ri < results.length; ri++) {
      if (results[ri].error) { return { rows: all, error: results[ri].error }; }
      var pageData = results[ri].data;
      if (!pageData || pageData.length === 0) { done = true; break; }
      for (var i = 0; i < pageData.length; i++) all.push(pageData[i]);
      if (pageData.length < PAGE_SIZE) { done = true; break; }
    }
    from += MAX_PARALLEL * PAGE_SIZE;
  }
  return { rows: all, error: null };
}

// Load outbound threads with pre-computed metrics (no messages column)
// Uses stale-while-revalidate: returns cached data instantly, refreshes in background
export async function loadOutboundThreads(since, onRefresh) {
  var cacheKey = "outbound_" + since;
  function doFetch() {
    return fetchAllRows(function() {
      return supabase
        .from("mb_outbound_threads")
        .select("thread_id, phone_number, template_sent_at, template_id, template_name, step_order, lead_qualification, hubspot_id, created_at, human_msg_count, ai_msg_count, total_word_count, is_auto_reply, has_tool, has_meeting_link, has_ig_link, has_ig_at, has_valid_response, first_human_ts, last_human_ts, first_human_hour, detected_lang, topic_flags")
        .gte("created_at", since)
        .order("thread_id");
    }).then(function(r) {
      if (r.error) throw new Error(r.error.message);
      return r.rows;
    });
  }
  var result = await staleWhileRevalidate(cacheKey, "threads", doFetch, onRefresh);
  console.log("[metabaseSync] Loaded " + result.data.length + " outbound threads" + (result.isStale ? " (from cache, refreshing...)" : ""));
  return result.data;
}

// Load inbound threads with pre-computed metrics (no messages column)
export async function loadInboundThreads(since, onRefresh) {
  var cacheKey = "inbound_" + since;
  function doFetch() {
    return fetchAllRows(function() {
      return supabase
        .from("mb_inbound_threads")
        .select("thread_id, phone_number, created_at, human_msg_count, ai_msg_count, total_word_count, is_auto_reply, has_tool, has_meeting_link, has_ig_link, has_ig_at, has_valid_response, first_human_ts, last_human_ts, first_human_hour, detected_lang, topic_flags, has_signup_link")
        .gte("created_at", since)
        .order("thread_id");
    }).then(function(r) {
      if (r.error) throw new Error(r.error.message);
      return r.rows;
    });
  }
  var result = await staleWhileRevalidate(cacheKey, "threads", doFetch, onRefresh);
  console.log("[metabaseSync] Loaded " + result.data.length + " inbound threads" + (result.isStale ? " (from cache, refreshing...)" : ""));
  return result.data;
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

// Load activated phones from mb_activated_phones -> { phone: activated_at }
export async function loadActivatedPhones() {
  var cacheKey = "activated_phones";
  function doFetch() {
    return fetchAllRows(function() {
      return supabase
        .from("mb_activated_phones")
        .select("phone_number, activated_at");
    }).then(function(r) {
      if (r.error) throw new Error(r.error.message);
      var phones = {};
      for (var i = 0; i < r.rows.length; i++) {
        var row = r.rows[i];
        if (row.phone_number) {
          var clean = String(row.phone_number).replace(/\D/g, "");
          if (clean) phones[clean] = row.activated_at;
        }
      }
      return phones;
    });
  }
  var result = await staleWhileRevalidate(cacheKey, "activations", doFetch);
  console.log("[metabaseSync] Loaded " + Object.keys(result.data).length + " activated phones" + (result.isStale ? " (from cache)" : ""));
  return result.data;
}

// Load WhatsApp-connected phones from mb_whatsapp_connected_phones -> { phone: connected_at }
export async function loadWhatsAppConnectedPhones() {
  var cacheKey = "whatsapp_connected_phones";
  function doFetch() {
    return fetchAllRows(function() {
      return supabase
        .from("mb_whatsapp_connected_phones")
        .select("phone_number, connected_at");
    }).then(function(r) {
      if (r.error) throw new Error(r.error.message);
      var phones = {};
      for (var i = 0; i < r.rows.length; i++) {
        var row = r.rows[i];
        if (row.phone_number) {
          var clean = String(row.phone_number).replace(/\D/g, "");
          if (clean) phones[clean] = row.connected_at;
        }
      }
      return phones;
    });
  }
  var result = await staleWhileRevalidate(cacheKey, "whatsapp", doFetch);
  console.log("[metabaseSync] Loaded " + Object.keys(result.data).length + " whatsapp-connected phones" + (result.isStale ? " (from cache)" : ""));
  return result.data;
}

// Load products-created phones from mb_products_created_phones -> { phone: created_at }
export async function loadProductsCreatedPhones() {
  var cacheKey = "products_created_phones";
  function doFetch() {
    return fetchAllRows(function() {
      return supabase
        .from("mb_products_created_phones")
        .select("phone_number, created_at");
    }).then(function(r) {
      if (r.error) throw new Error(r.error.message);
      var phones = {};
      for (var i = 0; i < r.rows.length; i++) {
        var row = r.rows[i];
        if (row.phone_number) {
          var clean = String(row.phone_number).replace(/\D/g, "");
          if (clean) phones[clean] = row.created_at;
        }
      }
      return phones;
    });
  }
  var result = await staleWhileRevalidate(cacheKey, "products", doFetch);
  console.log("[metabaseSync] Loaded " + Object.keys(result.data).length + " products-created phones" + (result.isStale ? " (from cache)" : ""));
  return result.data;
}

// Load lifecycle phones from mb_lifecycle_phones -> { phone: { firstAt, firstStep1At } }
export async function loadLifecyclePhones() {
  var cacheKey = "lifecycle_phones";
  function doFetch() {
    return fetchAllRows(function() {
      return supabase
        .from("mb_lifecycle_phones")
        .select("phone_number, first_lifecycle_at, first_step1_at");
    }).then(function(r) {
      if (r.error) throw new Error(r.error.message);
      var phones = {};
      for (var i = 0; i < r.rows.length; i++) {
        var row = r.rows[i];
        if (row.phone_number) {
          phones[row.phone_number] = {
            firstAt: row.first_lifecycle_at || null,
            firstStep1At: row.first_step1_at || null,
          };
        }
      }
      return phones;
    });
  }
  var result = await staleWhileRevalidate(cacheKey, "lifecycle", doFetch);
  console.log("[metabaseSync] Loaded " + Object.keys(result.data).length + " lifecycle phones" + (result.isStale ? " (from cache)" : ""));
  return result.data;
}
