import { supabase } from "./supabase";

export async function callHubSpot(endpoint, params, body) {
  var password = sessionStorage.getItem("dashboard_password") || "";
  var payload = { endpoint: endpoint, password: password };
  if (body) payload.body = body;
  else if (params) payload.params = params;
  var { data, error } = await supabase.functions.invoke("hubspot", {
    body: payload,
  });
  if (error) {
    var status = error.context && error.context.status;
    if (status === 401) { window.dispatchEvent(new Event("auth-required")); throw new Error("Unauthorized"); }
    var msg = data && data.error || error.message || "HubSpot API error";
    throw new Error(msg);
  }
  return data;
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
  if (data && data.results) {
    var names = data.results.map(function(p) { return p.name; });
    console.log("[HS] Lead property names:", names.join(", "));
    var relevant = data.results.filter(function(p) {
      return /pipe|create|date|stage/i.test(p.name);
    });
    console.log("[HS] Lead relevant properties:", relevant.map(function(p) { return p.name + " (" + p.label + ", " + p.type + ")"; }));
  }
  return data;
}

export async function fetchLeadsSince(sinceIso, pipelineId) {
  // First, fetch a sample to discover property names
  try {
    var sample = await callHubSpot("/crm/v3/objects/0-136", { limit: "1" });
    if (sample && sample.results && sample.results[0]) {
      console.log("[HS] Lead sample properties:", Object.keys(sample.results[0].properties || {}).join(", "));
    }
  } catch (e) { console.warn("[HS] Lead sample fetch failed:", e.message); }

  // Fetch all leads via list endpoint (GET with pagination) — avoids search filter issues
  var all = [];
  var after = undefined;
  while (true) {
    var params = { limit: "100", properties: "hs_pipeline,hs_pipeline_stage,hs_lead_name,createdate,hs_createdate" };
    if (after) params.after = after;
    var data = await callHubSpot("/crm/v3/objects/0-136", params);
    if (data.results) all = all.concat(data.results);
    if (!data.paging || !data.paging.next || !data.paging.next.after) break;
    after = data.paging.next.after;
  }
  console.log("[HS] Total leads fetched:", all.length);

  // Filter client-side by pipeline and date
  var sinceDate = new Date(sinceIso);
  var filtered = all.filter(function(lead) {
    var props = lead.properties || {};
    // Filter by pipeline if specified
    if (pipelineId && props.hs_pipeline !== pipelineId) return false;
    // Filter by date
    var cd = props.createdate || props.hs_createdate || lead.createdAt;
    if (!cd) return false;
    return new Date(cd) >= sinceDate;
  });
  console.log("[HS] Leads after filter (pipeline=" + pipelineId + ", since=" + sinceIso + "):", filtered.length);
  return filtered;
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

// Fetch leads (0-136) for Growth tab with associated contact properties
export async function fetchGrowthLeads(sinceIso, pipelineId) {
  // Step 1: Fetch all leads via list endpoint with pagination
  var all = [];
  var after = undefined;
  while (true) {
    var params = { limit: "100", properties: "hs_pipeline,hs_pipeline_stage,hs_lead_name,createdate,hs_createdate" };
    if (after) params.after = after;
    var data = await callHubSpot("/crm/v3/objects/0-136", params);
    if (data.results) all = all.concat(data.results);
    if (!data.paging || !data.paging.next || !data.paging.next.after) break;
    after = data.paging.next.after;
  }
  console.log("[HS Growth] Total leads fetched:", all.length);

  // Step 2: Filter by pipeline and date client-side
  var sinceDate = new Date(sinceIso);
  var filtered = all.filter(function(lead) {
    var props = lead.properties || {};
    if (pipelineId && props.hs_pipeline !== pipelineId) return false;
    var cd = props.createdate || props.hs_createdate || lead.createdAt;
    if (!cd) return false;
    return new Date(cd) >= sinceDate;
  });
  console.log("[HS Growth] Leads after filter (pipeline=" + pipelineId + ", since=" + sinceIso + "):", filtered.length);

  if (filtered.length === 0) return filtered;

  // Step 3: Batch fetch associations to contacts
  console.log("[HS Growth] Fetching lead→contact associations...");
  var assocMap = {};
  var BATCH = 100;
  for (var i = 0; i < filtered.length; i += BATCH) {
    var chunk = filtered.slice(i, i + BATCH);
    var inputs = chunk.map(function(lead) { return { id: lead.id }; });
    try {
      var batchData = await callHubSpot("/crm/v4/associations/0-136/contacts/batch/read", null, { inputs: inputs });
      if (batchData.results) {
        for (var r = 0; r < batchData.results.length; r++) {
          var item = batchData.results[r];
          var fromId = item.from && item.from.id;
          if (fromId && item.to && item.to.length > 0) {
            assocMap[fromId] = String(item.to[0].toObjectId);
          }
        }
      }
    } catch (e) {
      console.warn("[HS Growth] Batch association error for chunk", i, e.message);
    }
  }
  console.log("[HS Growth] Associations mapped:", Object.keys(assocMap).length, "leads → contacts");

  // Step 4: Batch read associated contacts with growth properties
  var contactIds = [];
  var seen = {};
  for (var k = 0; k < filtered.length; k++) {
    var cid = assocMap[filtered[k].id];
    if (cid && !seen[cid]) { contactIds.push(cid); seen[cid] = true; }
  }
  console.log("[HS Growth] Unique contacts to fetch:", contactIds.length);

  var contactMap = {};
  for (var j = 0; j < contactIds.length; j += 100) {
    var cBatch = contactIds.slice(j, j + 100);
    var cInputs = cBatch.map(function(id) { return { id: id }; });
    try {
      var cData = await callHubSpot("/crm/v3/objects/contacts/batch/read", null, {
        inputs: cInputs,
        properties: [
          "hubspot_owner_id", "prioridad_plg",
          "hs_analytics_source", "hs_analytics_source_data_1", "initial_utm_campaign",
          "industria", "sales_channels", "email", "phone"
        ]
      });
      if (cData.results) {
        for (var ci = 0; ci < cData.results.length; ci++) {
          contactMap[cData.results[ci].id] = cData.results[ci];
        }
      }
    } catch (e) {
      console.warn("[HS Growth] Batch contact read error for chunk", j, e.message);
    }
  }
  console.log("[HS Growth] Contacts fetched:", Object.keys(contactMap).length);

  // Step 5: Stitch contact properties onto leads
  for (var m = 0; m < filtered.length; m++) {
    var contactId = assocMap[filtered[m].id];
    var contact = contactId && contactMap[contactId];
    filtered[m]._contact = contact || null;
    filtered[m]._contactProps = contact && contact.properties || {};
  }

  return filtered;
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
