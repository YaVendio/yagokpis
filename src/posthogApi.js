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

export async function fetchPostHogOrganizations(startDate, endDate) {
  var start = startDate.toISOString().slice(0, 10);
  var end = endDate.toISOString().slice(0, 10);

  var totalQuery = "SELECT count() as total FROM groups WHERE index = 0 AND created_at >= '" + start + "' AND created_at < '" + end + "'";
  var dailyQuery = "SELECT toDate(created_at) as day, count() as total FROM groups WHERE index = 0 AND created_at >= '" + start + "' AND created_at < '" + end + "' GROUP BY day ORDER BY day";
  var listQuery = "SELECT properties.name as name, properties.$group_key as key, created_at FROM groups WHERE index = 0 AND created_at >= '" + start + "' AND created_at < '" + end + "' ORDER BY created_at DESC LIMIT 200";

  var results = await Promise.all([
    callPostHog("/api/projects/@current/query/", null, { query: { kind: "HogQLQuery", query: totalQuery } }),
    callPostHog("/api/projects/@current/query/", null, { query: { kind: "HogQLQuery", query: dailyQuery } }),
    callPostHog("/api/projects/@current/query/", null, { query: { kind: "HogQLQuery", query: listQuery } }),
  ]);

  var totalRows = results[0] && results[0].results || [];
  var total = totalRows.length > 0 ? totalRows[0][0] : 0;

  var dailyRows = results[1] && results[1].results || [];
  var daily = dailyRows.map(function (r) { return { date: r[0], count: r[1] }; });

  var listRows = results[2] && results[2].results || [];
  var orgs = listRows.map(function (r) { return { name: r[0] || r[1] || "Sin nombre", key: r[1], createdAt: r[2] }; });

  return { total: total, daily: daily, orgs: orgs };
}

export async function fetchPostHogPersonsByEmail(emails) {
  if (!emails || emails.length === 0) return {};
  // Batch in groups of 200 to avoid HogQL query size limits
  var BATCH = 200;
  var batches = [];
  for (var i = 0; i < emails.length; i += BATCH) {
    batches.push(emails.slice(i, i + BATCH));
  }
  var map = {};
  var results = await Promise.all(batches.map(function (batch) {
    var escaped = batch.map(function (e) { return "'" + e.replace(/'/g, "\\'") + "'"; }).join(",");
    var query = "SELECT properties.email, properties.$initial_utm_source, properties.$initial_utm_medium, properties.$initial_utm_campaign, properties.$initial_referring_domain FROM persons WHERE properties.email IN (" + escaped + ")";
    return callPostHog("/api/projects/@current/query/", null, { query: { kind: "HogQLQuery", query: query } });
  }));
  for (var r = 0; r < results.length; r++) {
    var rows = results[r] && results[r].results || [];
    for (var j = 0; j < rows.length; j++) {
      var email = rows[j][0];
      if (email) {
        map[email.toLowerCase()] = {
          utm_source: rows[j][1] || "",
          utm_medium: rows[j][2] || "",
          utm_campaign: rows[j][3] || "",
          ref_domain: rows[j][4] || "",
        };
      }
    }
  }
  console.log("[PostHog] Persons fetched:", Object.keys(map).length, "of", emails.length, "emails");
  return map;
}
