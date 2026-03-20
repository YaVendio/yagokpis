import { supabase } from "./supabase";
import { withRetry } from "./apiRetry";
import { dispatchAuthRequired } from "./authGuard";

export async function callPostHog(endpoint, params, body) {
  var password = sessionStorage.getItem("dashboard_password") || "";
  try {
    return await withRetry(function () { return _invokePostHog(endpoint, params, body, password); });
  } catch (e) {
    if (e._status === 401) { dispatchAuthRequired(); throw new Error("Unauthorized"); }
    throw e;
  }
}

function _invokePostHog(endpoint, params, body, password) {
  var payload = { endpoint: endpoint, password: password };
  if (body) payload.body = body;
  else if (params) payload.params = params;
  return supabase.functions.invoke("posthog", {
    body: payload,
  }).then(function (res) {
    if (res.error) {
      var status = res.error.context && res.error.context.status;
      var msg = res.data && res.data.error || res.error.message || "PostHog API error";
      var err = new Error(msg);
      err._status = status;
      throw err;
    }
    return res.data;
  });
}

// Stub — will be implemented when specific PostHog insight IDs are defined
export async function fetchPostHogInsight(insightId) {
  return await callPostHog("/api/projects/@current/insights/" + insightId);
}

export async function fetchPostHogSources(startDate, endDate) {
  var start = startDate.toISOString().slice(0, 10);
  var end = endDate.toISOString().slice(0, 10);

  var domainQuery = "SELECT properties.$initial_referring_domain as source, count() as total FROM persons WHERE created_at >= '" + start + "' AND created_at < '" + end + "' GROUP BY source ORDER BY total DESC LIMIT 30";
  var utmQuery = "SELECT properties.$initial_utm_source as source, count() as total FROM persons WHERE created_at >= '" + start + "' AND created_at < '" + end + "' GROUP BY source ORDER BY total DESC LIMIT 30";

  var results = await Promise.all([
    callPostHog("/api/projects/@current/query/", null, { query: { kind: "HogQLQuery", query: domainQuery } }),
    callPostHog("/api/projects/@current/query/", null, { query: { kind: "HogQLQuery", query: utmQuery } }),
  ]);

  function parseRows(res) {
    var rows = res && res.results || [];
    return rows.filter(function (r) { return r[0] && r[0] !== "" && r[0] !== "null"; }).map(function (r) { return { source: r[0], count: r[1] }; });
  }

  return {
    byDomain: parseRows(results[0]),
    byUtmSource: parseRows(results[1]),
  };
}
