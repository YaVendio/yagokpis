import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  }

  try {
    const { password, sql, db_id } = await req.json();

    if (!password || password !== Deno.env.get("DASHBOARD_PASSWORD")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    if (!sql) {
      return new Response(JSON.stringify({ error: "Missing sql" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const metabaseUrl = Deno.env.get("METABASE_URL");
    const apiKey = Deno.env.get("METABASE_API_KEY");
    const dbId = Number(Deno.env.get("METABASE_DB_ID"));

    if (!metabaseUrl || !apiKey) {
      return new Response(JSON.stringify({ error: "Metabase not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const resp = await fetch(metabaseUrl + "/api/dataset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        database: db_id || dbId,
        type: "native",
        native: { query: sql },
        constraints: { "max-results": 2000000, "max-results-bare-rows": 2000000 },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ error: "Metabase error: " + errText }), {
        status: resp.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const data = await resp.json();
    return new Response(JSON.stringify({
      columns: data.data.cols.map((c: any) => c.name),
      results: data.data.rows,
    }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Proxy error: " + err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
