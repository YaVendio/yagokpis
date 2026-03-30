import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  }

  try {
    const { password, endpoint, params, body: reqBody } = await req.json();

    if (!password || password !== Deno.env.get("DASHBOARD_PASSWORD")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    if (!endpoint) {
      return new Response(JSON.stringify({ error: "Missing endpoint" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const apiKey = Deno.env.get("POSTHOG_PERSONAL_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "POSTHOG_PERSONAL_API_KEY not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    let url = "https://app.posthog.com" + endpoint;
    const fetchOpts: RequestInit = {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Accept": "application/json",
      },
    };

    if (reqBody) {
      fetchOpts.method = "POST";
      (fetchOpts.headers as Record<string, string>)["Content-Type"] = "application/json";
      fetchOpts.body = JSON.stringify(reqBody);
    } else if (params && Object.keys(params).length > 0) {
      const qs = Object.entries(params)
        .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(String(v)))
        .join("&");
      url += "?" + qs;
    }

    const resp = await fetch(url, fetchOpts);

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ error: "PostHog error (" + resp.status + "): " + errText }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const data = await resp.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Proxy error: " + err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
