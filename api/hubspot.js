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

  var token = process.env.HUBSPOT_API_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "HUBSPOT_API_TOKEN not configured" });
  }

  try {
    var url = "https://api.hubapi.com" + endpoint;
    if (params && Object.keys(params).length > 0) {
      var qs = Object.entries(params)
        .map(function (pair) { return encodeURIComponent(pair[0]) + "=" + encodeURIComponent(pair[1]); })
        .join("&");
      url += "?" + qs;
    }

    var resp = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + token,
        "Accept": "application/json",
      },
    });

    if (!resp.ok) {
      var errText = await resp.text();
      return res.status(resp.status).json({ error: "HubSpot error: " + errText });
    }

    var data = await resp.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Proxy error: " + err.message });
  }
}
