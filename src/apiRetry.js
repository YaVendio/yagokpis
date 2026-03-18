export async function withRetry(fn, maxRetries, delayMs) {
  if (!maxRetries) maxRetries = 2;
  if (!delayMs) delayMs = 1000;
  var lastError;
  for (var attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      var status = e._status;
      var retryable = !status || status === 401 || status === 502 || status === 503;
      if (attempt < maxRetries && retryable) {
        await new Promise(function (r) { setTimeout(r, delayMs * (attempt + 1)); });
      }
    }
  }
  throw lastError;
}
