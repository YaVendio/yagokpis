import { supabase } from "./supabase";

export async function callBrevo(endpoint, params) {
  var password = sessionStorage.getItem("dashboard_password") || "";
  var { data, error } = await supabase.functions.invoke("brevo", {
    body: { endpoint: endpoint, params: params || {}, password: password },
  });
  if (error) {
    var status = error.context && error.context.status;
    if (status === 401) { window.dispatchEvent(new Event("auth-required")); throw new Error("Unauthorized"); }
    var msg = (data && data.error) || error.message || "Brevo API error";
    throw new Error(msg);
  }
  // Handle proxied Brevo API errors (returned as 200 with ok:false)
  if (data && data.ok === false) {
    throw new Error(data.error || "Unknown Brevo API error");
  }
  return data;
}

// --- Diagnostic: discover templates & transactional events available to this API key ---
export async function fetchAutomationDiagnostic() {
  console.log("[Brevo] === DIAGNOSTIC START ===");

  // 1. Fetch all SMTP templates
  console.log("[Brevo] Fetching SMTP templates...");
  try {
    var tplData = await callBrevo("/v3/smtp/templates", { limit: 50, offset: 0 });
    var templates = tplData.templates || [];
    console.log("[Brevo] Templates found:", tplData.count);
    for (var i = 0; i < templates.length; i++) {
      var t = templates[i];
      console.log("[Brevo] Template #" + t.id + " — name: \"" + t.name + "\" — tag: \"" + (t.tag || "") + "\" — active: " + t.isActive);
    }
  } catch (e) {
    console.error("[Brevo] Templates fetch failed:", e.message);
  }

  // 2. Fetch a sample of transactional email events (last 30 days)
  console.log("[Brevo] Fetching SMTP events (sample)...");
  try {
    var evtData = await callBrevo("/v3/smtp/statistics/events", { limit: 10, offset: 0 });
    var events = evtData.events || [];
    console.log("[Brevo] Events sample count:", events.length);
    for (var j = 0; j < events.length; j++) {
      var ev = events[j];
      console.log("[Brevo] Event:", ev.event, "| templateId:", ev.templateId, "| email:", ev.email, "| date:", ev.date);
    }
  } catch (e) {
    console.error("[Brevo] Events fetch failed:", e.message);
  }

  // 3. Try aggregated report
  console.log("[Brevo] Fetching aggregated SMTP report...");
  try {
    var aggData = await callBrevo("/v3/smtp/statistics/aggregatedReport", {});
    console.log("[Brevo] Aggregated report:", JSON.stringify(aggData));
  } catch (e) {
    console.error("[Brevo] Aggregated report failed:", e.message);
  }

  console.log("[Brevo] === DIAGNOSTIC END ===");
  return { templates: templates || [], events: events || [], aggregated: aggData || null };
}

export function aggregateWorkflowStats(campaigns) {
  var stats = { sent: 0, delivered: 0, uniqueOpens: 0, uniqueClicks: 0,
    hardBounces: 0, softBounces: 0, unsubscriptions: 0, complaints: 0 };
  for (var i = 0; i < campaigns.length; i++) {
    var s = campaigns[i].statistics && campaigns[i].statistics.globalStats || {};
    stats.sent += s.sent || 0;
    stats.delivered += s.delivered || 0;
    stats.uniqueOpens += s.uniqueViews || s.uniqueOpens || 0;
    stats.uniqueClicks += s.uniqueClicks || 0;
    stats.hardBounces += s.hardBounces || 0;
    stats.softBounces += s.softBounces || 0;
    stats.unsubscriptions += s.unsubscriptions || 0;
    stats.complaints += s.complaints || 0;
  }
  return stats;
}

export function calculateMetrics(stats) {
  var delivered = stats.delivered || 0;
  var sent = stats.sent || 0;
  var totalBounces = (stats.hardBounces || 0) + (stats.softBounces || 0);
  return {
    sent: sent,
    delivered: delivered,
    uniqueOpens: stats.uniqueOpens || 0,
    uniqueClicks: stats.uniqueClicks || 0,
    hardBounces: stats.hardBounces || 0,
    softBounces: stats.softBounces || 0,
    totalBounces: totalBounces,
    unsubscriptions: stats.unsubscriptions || 0,
    complaints: stats.complaints || 0,
    openRate: delivered > 0 ? (stats.uniqueOpens / delivered * 100).toFixed(1) : "0",
    clickRate: delivered > 0 ? (stats.uniqueClicks / delivered * 100).toFixed(1) : "0",
    bounceRate: sent > 0 ? (totalBounces / sent * 100).toFixed(1) : "0",
    deliveryRate: sent > 0 ? (delivered / sent * 100).toFixed(1) : "0",
    unsubRate: delivered > 0 ? (stats.unsubscriptions / delivered * 100).toFixed(2) : "0",
    complaintRate: delivered > 0 ? (stats.complaints / delivered * 100).toFixed(3) : "0",
  };
}
