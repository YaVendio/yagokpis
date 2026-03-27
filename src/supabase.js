import { createClient } from "@supabase/supabase-js";

// Custom fetch with per-request timeout (15s) to prevent hanging on 522/slowness
var QUERY_TIMEOUT_MS = 30000;
function fetchWithTimeout(url, options) {
  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, QUERY_TIMEOUT_MS);
  var mergedOptions = Object.assign({}, options, { signal: controller.signal });
  return fetch(url, mergedOptions).finally(function() { clearTimeout(timer); });
}

export var supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { global: { fetch: fetchWithTimeout } }
);

// Retry helper for Supabase queries that fail with transient errors (522, 503, 504, timeouts)
var MAX_RETRIES = 3;
var RETRY_BASE_MS = 2000;

function _sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

// Retry a function that returns { data, error } (Supabase query pattern)
// Also catches thrown errors (e.g. AbortError from timeout)
export async function retryQuery(fn) {
  var result;
  for (var attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      result = await fn();
    } catch (e) {
      result = { data: null, error: { message: e.message || "Request failed" } };
    }
    if (!result.error) return result;
    if (attempt < MAX_RETRIES) {
      var delay = RETRY_BASE_MS * Math.pow(2, attempt);
      console.warn("[retry] Attempt " + (attempt + 1) + "/" + MAX_RETRIES + ", retrying in " + (delay / 1000) + "s:", result.error.message);
      await _sleep(delay);
    }
  }
  return result;
}
