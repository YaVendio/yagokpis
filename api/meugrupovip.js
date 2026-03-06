// In-memory cache (persists across requests in the same serverless instance)
var cache = {};
var CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Queue to serialize requests to MeuGrupoVip API (1 req/60s rate limit)
var requestQueue = Promise.resolve();

function getCacheKey(url) {
  return url;
}

function getCached(key) {
  var entry = cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  if (entry) delete cache[key];
  return null;
}

function setCache(key, data) {
  cache[key] = { data: data, ts: Date.now() };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  var password = req.headers["x-dashboard-password"];
  if (!password || password !== process.env.DASHBOARD_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  var { endpoint, params } = req.body || {};
  if (!endpoint) {
    return res.status(400).json({ error: "Missing endpoint" });
  }

  var token = process.env.MEUGRUPOVIP_API_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "MEUGRUPOVIP_API_TOKEN not configured" });
  }

  try {
    var url = "https://meugrupo.vip/api/v1" + endpoint;
    if (params && Object.keys(params).length > 0) {
      var qs = Object.entries(params)
        .map(function (pair) { return encodeURIComponent(pair[0]) + "=" + encodeURIComponent(pair[1]); })
        .join("&");
      url += "?" + qs;
    }

    // Check cache first
    var cacheKey = getCacheKey(url);
    var cached = getCached(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    // Enqueue request to serialize API calls
    var result = await new Promise(function (resolve, reject) {
      requestQueue = requestQueue.then(async function () {
        // Re-check cache (another queued request may have populated it)
        var cached2 = getCached(cacheKey);
        if (cached2) { resolve(cached2); return; }

        var resp;
        var maxRetries = 3;
        for (var attempt = 0; attempt <= maxRetries; attempt++) {
          resp = await fetch(url, {
            method: "GET",
            headers: {
              "Authorization": "Bearer " + token,
              "Accept": "application/json",
            },
          });
          if (resp.status !== 429 || attempt === maxRetries) break;
          // Respect Retry-After header, default to 62s
          var retryAfter = parseInt(resp.headers.get("Retry-After") || "62", 10);
          if (retryAfter < 1 || retryAfter > 120) retryAfter = 62;
          await new Promise(function (r) { setTimeout(r, (retryAfter + 2) * 1000); });
        }

        if (!resp.ok) {
          var errText = await resp.text();
          reject(new Error("MeuGrupoVip error: " + errText));
          return;
        }

        var data = await resp.json();
        setCache(cacheKey, data);
        resolve(data);
      }).catch(function (err) {
        reject(err);
      });
    });

    return res.status(200).json(result);
  } catch (err) {
    var status = err.message && err.message.includes("429") ? 429 : 500;
    return res.status(status).json({ error: err.message });
  }
}
