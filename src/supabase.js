import { createClient } from "@supabase/supabase-js";
export var supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Retry helper for Supabase queries that fail with transient errors (522, 503, 504, timeouts)
var MAX_RETRIES = 3;
var RETRY_BASE_MS = 2000;

function _sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

function _isRetryable(error) {
  if (!error) return false;
  var msg = String(error.message || "").toLowerCase();
  return msg.indexOf("timeout") >= 0 || msg.indexOf("522") >= 0 ||
    msg.indexOf("503") >= 0 || msg.indexOf("504") >= 0 ||
    msg.indexOf("connection") >= 0 || msg.indexOf("fetch") >= 0 ||
    msg.indexOf("network") >= 0 || msg.indexOf("aborted") >= 0 ||
    msg.indexOf("failed") >= 0;
}

// Retry a function that returns { data, error } (Supabase query pattern)
export async function retryQuery(fn) {
  var result;
  for (var attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    result = await fn();
    if (!result.error || !_isRetryable(result.error)) return result;
    if (attempt < MAX_RETRIES) {
      var delay = RETRY_BASE_MS * Math.pow(2, attempt);
      console.warn("[retry] Attempt " + (attempt + 1) + "/" + MAX_RETRIES + ", retrying in " + (delay / 1000) + "s:", result.error.message);
      await _sleep(delay);
    }
  }
  return result;
}
