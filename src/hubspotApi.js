export async function callHubSpot(endpoint, params, body) {
  var password = sessionStorage.getItem("dashboard_password") || "";
  var payload = { endpoint: endpoint };
  if (body) payload.body = body;
  else if (params) payload.params = params;
  var resp = await fetch("/api/hubspot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-dashboard-password": password,
    },
    body: JSON.stringify(payload),
  });
  if (resp.status === 401) {
    window.dispatchEvent(new Event("auth-required"));
    throw new Error("Unauthorized");
  }
  if (!resp.ok) {
    var errText = await resp.text();
    try { var errJson = JSON.parse(errText); errText = errJson.error || errText; } catch(e) {}
    throw new Error("HubSpot API error: " + errText);
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

// Search meetings from a date onwards using Search API + parallel association fetch
export async function fetchMeetingsSince(sinceIso) {
  var sinceMs = new Date(sinceIso).getTime();
  console.log("[HS] Searching meetings since", sinceIso);

  // Step 1: Search meetings by date
  var all = [];
  var after = undefined;
  while (true) {
    var searchBody = {
      filterGroups: [{
        filters: [{
          propertyName: "hs_meeting_start_time",
          operator: "GTE",
          value: String(sinceMs)
        }]
      }],
      properties: ["hs_meeting_title", "hs_meeting_start_time", "hs_meeting_end_time", "hs_meeting_outcome"],
      limit: 100,
    };
    if (after) searchBody.after = after;
    var data = await callHubSpot("/crm/v3/objects/meetings/search", null, searchBody);
    if (data.results) all = all.concat(data.results);
    if (!data.paging || !data.paging.next || !data.paging.next.after) break;
    after = data.paging.next.after;
  }
  console.log("[HS] Found", all.length, "meetings");

  if (all.length === 0) return all;

  // Step 2: Fetch contact associations using v4 batch API (100 per request)
  console.log("[HS] Fetching associations for", all.length, "meetings via batch API...");
  var assocMap = {};
  var BATCH = 100;
  for (var i = 0; i < all.length; i += BATCH) {
    var chunk = all.slice(i, i + BATCH);
    var inputs = chunk.map(function(meeting) { return { id: meeting.id }; });
    try {
      var batchData = await callHubSpot("/crm/v4/associations/meetings/contacts/batch/read", null, { inputs: inputs });
      if (batchData.results) {
        for (var r = 0; r < batchData.results.length; r++) {
          var item = batchData.results[r];
          var fromId = item.from && item.from.id;
          if (fromId && item.to && item.to.length > 0) {
            assocMap[fromId] = item.to.map(function(t) { return { id: String(t.toObjectId) }; });
          }
        }
      }
    } catch (e) {
      console.warn("[HS] Batch association error for chunk", i, e.message);
    }
  }
  console.log("[HS] Associations done, mapped", Object.keys(assocMap).length, "meetings");

  // Stitch associations onto meetings
  for (var k = 0; k < all.length; k++) {
    if (assocMap[all[k].id]) {
      all[k].associations = { contacts: { results: assocMap[all[k].id] } };
    }
  }

  return all;
}

// Batch-read contacts by IDs
export async function fetchContactsByIds(contactIds) {
  var all = [];
  for (var i = 0; i < contactIds.length; i += 100) {
    var batch = contactIds.slice(i, i + 100);
    var inputs = batch.map(function(id) { return { id: id }; });
    var data = await callHubSpot("/crm/v3/objects/contacts/batch/read", null, {
      inputs: inputs,
      properties: ["firstname", "lastname", "phone", "email", "createdate", "hs_lead_status", "lifecyclestage"]
    });
    if (data.results) all = all.concat(data.results);
  }
  return all;
}

// Search leads (object) from a date onwards, filtered by pipeline
// Debug: list properties available on the leads object (0-136)
export async function debugLeadProperties() {
  var data = await callHubSpot("/crm/v3/properties/0-136");
  console.log("[HS] Lead (0-136) properties:", data);
  return data;
}

export async function fetchLeadsSince(sinceIso, pipelineId) {
  var sinceMs = new Date(sinceIso).getTime();
  var all = [];
  var after = undefined;
  while (true) {
    var filters = [{ propertyName: "createdate", operator: "GTE", value: String(sinceMs) }];
    if (pipelineId) filters.push({ propertyName: "hs_pipeline", operator: "EQ", value: pipelineId });
    var searchBody = {
      filterGroups: [{ filters: filters }],
      properties: ["hs_pipeline", "hs_pipeline_stage", "createdate"],
      limit: 100,
    };
    if (after) searchBody.after = after;
    var data = await callHubSpot("/crm/v3/objects/0-136/search", null, searchBody);
    if (data.results) all = all.concat(data.results);
    if (!data.paging || !data.paging.next || !data.paging.next.after) break;
    after = data.paging.next.after;
  }
  return all;
}

// Search deals from a date onwards
export async function fetchDealsSince(sinceIso) {
  var sinceMs = new Date(sinceIso).getTime();
  var all = [];
  var after = undefined;
  while (true) {
    var searchBody = {
      filterGroups: [{
        filters: [{
          propertyName: "createdate",
          operator: "GTE",
          value: String(sinceMs)
        }]
      }],
      properties: ["dealname", "dealstage", "amount", "pipeline", "createdate", "closedate"],
      limit: 100,
    };
    if (after) searchBody.after = after;
    var data = await callHubSpot("/crm/v3/objects/deals/search", null, searchBody);
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
      associations: "contacts",
    };
    if (after) params.after = after;
    var data = await callHubSpot("/crm/v3/objects/meetings", params);
    if (data.results) all = all.concat(data.results);
    if (!data.paging || !data.paging.next || !data.paging.next.after) break;
    after = data.paging.next.after;
  }
  return all;
}

export function getMeetingContactPhones(meetings, contacts) {
  var contactPhoneMap = {};
  for (var i = 0; i < contacts.length; i++) {
    var c = contacts[i];
    var ph = c.properties && c.properties.phone;
    if (ph) {
      var clean = ph.replace(/\D/g, "");
      if (clean) contactPhoneMap[c.id] = clean;
    }
  }
  var meetingPhones = {};
  for (var j = 0; j < meetings.length; j++) {
    var m = meetings[j];
    var assoc = m.associations && m.associations.contacts && m.associations.contacts.results;
    if (!assoc) continue;
    for (var k = 0; k < assoc.length; k++) {
      var contactId = assoc[k].id;
      var phone = contactPhoneMap[contactId];
      if (phone) meetingPhones[phone] = true;
    }
  }
  return meetingPhones;
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
