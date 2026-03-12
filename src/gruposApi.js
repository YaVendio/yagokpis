import { supabase } from "./supabase";

export async function callMeuGrupoVip(endpoint, params) {
  var password = sessionStorage.getItem("dashboard_password") || "";
  var { data, error } = await supabase.functions.invoke("meugrupovip", {
    body: { endpoint: endpoint, params: params || {}, password: password },
  });
  if (error) {
    var status = error.context && error.context.status;
    if (status === 401) { window.dispatchEvent(new Event("auth-required")); throw new Error("Unauthorized"); }
    var msg = data && data.error || error.message || "MeuGrupoVip API error";
    throw new Error(msg);
  }
  return data;
}

export async function fetchCampaigns() {
  return await callMeuGrupoVip("/campaigns/list");
}

export async function fetchCampaignGroups(campaignId) {
  return await callMeuGrupoVip("/campaigns/" + campaignId + "/groups");
}

export async function fetchCampaignLeads(campaignId, startDate, endDate, dateType, groupId) {
  var params = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  if (dateType) params.date_type = dateType;
  if (groupId) params.group_id = groupId;
  return await callMeuGrupoVip("/campaigns/" + campaignId + "/leads", params);
}

export function formatDateForApi(date) {
  var d = new Date(date);
  var dd = String(d.getDate()).padStart(2, "0");
  var mm = String(d.getMonth() + 1).padStart(2, "0");
  var yyyy = d.getFullYear();
  return dd + "/" + mm + "/" + yyyy;
}
