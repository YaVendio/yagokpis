export async function callHubSpot(endpoint, params) {
  var password = sessionStorage.getItem("dashboard_password") || "";
  var resp = await fetch("/api/hubspot", {
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
    throw new Error("HubSpot API error " + resp.status + ": " + errText);
  }
  return await resp.json();
}

export async function fetchAllContacts() {
  var all = [];
  var after = undefined;
  while (true) {
    var params = {
      limit: "100",
      properties: "firstname,lastname,phone,email,createdate,hs_lead_status,lifecyclestage",
    };
    if (after) params.after = after;
    var data = await callHubSpot("/crm/v3/objects/contacts", params);
    if (data.results) all = all.concat(data.results);
    if (!data.paging || !data.paging.next || !data.paging.next.after) break;
    after = data.paging.next.after;
  }
  return all;
}

export async function fetchAllMeetings() {
  var all = [];
  var after = undefined;
  while (true) {
    var params = {
      limit: "100",
      properties: "hs_meeting_title,hs_meeting_start_time,hs_meeting_end_time,hs_meeting_outcome",
    };
    if (after) params.after = after;
    var data = await callHubSpot("/crm/v3/objects/meetings", params);
    if (data.results) all = all.concat(data.results);
    if (!data.paging || !data.paging.next || !data.paging.next.after) break;
    after = data.paging.next.after;
  }
  return all;
}

export async function fetchAllDeals() {
  var all = [];
  var after = undefined;
  while (true) {
    var params = {
      limit: "100",
      properties: "dealname,dealstage,amount,pipeline,createdate,closedate",
    };
    if (after) params.after = after;
    var data = await callHubSpot("/crm/v3/objects/deals", params);
    if (data.results) all = all.concat(data.results);
    if (!data.paging || !data.paging.next || !data.paging.next.after) break;
    after = data.paging.next.after;
  }
  return all;
}

export async function fetchDealPipelines() {
  var data = await callHubSpot("/crm/v3/pipelines/deals");
  return data;
}

export function extractHubSpotPhones(contacts) {
  var phones = {};
  for (var i = 0; i < contacts.length; i++) {
    var c = contacts[i];
    var ph = c.properties && c.properties.phone;
    if (ph) {
      var clean = ph.replace(/\D/g, "");
      if (clean) phones[clean] = true;
    }
  }
  return phones;
}
