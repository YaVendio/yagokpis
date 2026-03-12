import { supabase } from "./supabase";

export async function callPostHog(endpoint, params, body) {
  var password = sessionStorage.getItem("dashboard_password") || "";
  var payload = { endpoint: endpoint, password: password };
  if (body) payload.body = body;
  else if (params) payload.params = params;
  var { data, error } = await supabase.functions.invoke("posthog", {
    body: payload,
  });
  if (error) {
    var status = error.context && error.context.status;
    if (status === 401) { window.dispatchEvent(new Event("auth-required")); throw new Error("Unauthorized"); }
    var msg = data && data.error || error.message || "PostHog API error";
    throw new Error(msg);
  }
  return data;
}

// Stub — will be implemented when specific PostHog insight IDs are defined
export async function fetchPostHogInsight(insightId) {
  return await callPostHog("/api/projects/@current/insights/" + insightId);
}
