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

export async function fetchEmailCampaigns() {
  // Fetch ALL email campaigns (no type filter) — lets us see classic + trigger + automation
  var allCampaigns = [];
  var offset = 0;
  var limit = 100;
  var hasMore = true;
  while (hasMore) {
    var data = await callBrevo("/v3/emailCampaigns", {
      statistics: "globalStats",
      limit: limit,
      offset: offset,
    });
    console.log("[Brevo] count:", data.count, "page:", (data.campaigns || []).length);
    if (data.campaigns && data.campaigns.length > 0 && offset === 0) {
      console.log("[Brevo] Sample:", JSON.stringify(data.campaigns[0]).substring(0, 600));
    }
    var campaigns = data.campaigns || [];
    allCampaigns = allCampaigns.concat(campaigns);
    if (campaigns.length < limit || allCampaigns.length >= (data.count || 0)) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }
  console.log("[Brevo] Total fetched:", allCampaigns.length);
  return allCampaigns;
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
