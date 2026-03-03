export async function callMeuGrupoVip(endpoint, params) {
  var password = sessionStorage.getItem("dashboard_password") || "";
  var resp = await fetch("/api/meugrupovip", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-dashboard-password": password,
    },
    body: JSON.stringify({ endpoint: endpoint, params: params || {} }),
  });
  if (resp.status === 401) {
    window.dispatchEvent(new Event("auth-required"));
    throw new Error("Unauthorized");
  }
  if (!resp.ok) {
    var errText = await resp.text();
    throw new Error("MeuGrupoVip API error " + resp.status + ": " + errText);
  }
  return await resp.json();
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
