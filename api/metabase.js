export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  var password = req.headers["x-dashboard-password"];
  if (!password || password !== process.env.DASHBOARD_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  var { sql } = req.body || {};
  if (!sql) {
    return res.status(400).json({ error: "Missing sql" });
  }

  var metabaseUrl = process.env.METABASE_URL;
  var apiKey = process.env.METABASE_API_KEY;
  var dbId = Number(process.env.METABASE_DB_ID);

  try {
    var resp = await fetch(metabaseUrl + "/api/dataset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        database: dbId,
        type: "native",
        native: { query: sql },
      }),
    });

    if (!resp.ok) {
      var errText = await resp.text();
      return res.status(resp.status).json({ error: "Metabase error: " + errText });
    }

    var data = await resp.json();
    return res.status(200).json({
      columns: data.data.cols.map(function (c) { return c.name; }),
      results: data.data.rows,
    });
  } catch (err) {
    return res.status(500).json({ error: "Proxy error: " + err.message });
  }
}
