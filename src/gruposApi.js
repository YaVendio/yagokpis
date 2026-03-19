import { supabase } from "./supabase";
import { withRetry } from "./apiRetry";
import { dispatchAuthRequired } from "./authGuard";

export async function callMeuGrupoVip(endpoint, params) {
  var password = sessionStorage.getItem("dashboard_password") || "";
  try {
    return await withRetry(function () { return _invokeMeuGrupoVip(endpoint, params, password); });
  } catch (e) {
    if (e._status === 401) { dispatchAuthRequired(); throw new Error("Unauthorized"); }
    throw e;
  }
}

function _invokeMeuGrupoVip(endpoint, params, password) {
  return supabase.functions.invoke("meugrupovip", {
    body: { endpoint: endpoint, params: params || {}, password: password },
  }).then(function (res) {
    if (res.error) {
      var status = res.error.context && res.error.context.status;
      var msg = res.data && res.data.error || res.error.message || "MeuGrupoVip API error";
      var err = new Error(msg);
      err._status = status;
      throw err;
    }
    return res.data;
  });
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

export function formatEndDateForApi(date) {
  var d = new Date(date);
  d.setDate(d.getDate() + 1);
  var dd = String(d.getDate()).padStart(2, "0");
  var mm = String(d.getMonth() + 1).padStart(2, "0");
  var yyyy = d.getFullYear();
  return dd + "/" + mm + "/" + yyyy;
}
