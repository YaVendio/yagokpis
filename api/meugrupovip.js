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
      var wait = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
      await new Promise(function(r) { setTimeout(r, wait); });
    }

    if (!resp.ok) {
      var errText = await resp.text();
      return res.status(resp.status).json({ error: "MeuGrupoVip error: " + errText });
    }

    var data = await resp.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Proxy error: " + err.message });
  }
}
