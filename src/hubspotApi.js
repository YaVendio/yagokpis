import { supabase } from "./supabase";
import { withRetry } from "./apiRetry";

export async function callHubSpot(endpoint, params, body) {
  var password = sessionStorage.getItem("dashboard_password") || "";
  try {
    return await withRetry(function () { return _invokeHubSpot(endpoint, params, body, password); });
  } catch (e) {
    if (e._status === 401) { window.dispatchEvent(new Event("auth-required")); throw new Error("Unauthorized"); }
    throw e;
  }
}

function _invokeHubSpot(endpoint, params, body, password) {
  var payload = { endpoint: endpoint, password: password };
  if (body) payload.body = body;
  else if (params) payload.params = params;
  return supabase.functions.invoke("hubspot", {
    body: payload,
  }).then(function (res) {
    if (res.error) {
      var status = res.error.context && res.error.context.status;
      var msg = res.data && res.data.error || res.error.message || "HubSpot API error";
      var err = new Error(msg);
      err._status = status;
      throw err;
    }
    return res.data;
  });
}

export async function fetchAllContacts() {
  var all = [];
  var after = undefined;
  while (true) {
    var params = {
      limit: "100",
      properties: "firstname,lastname,phone,email,createdate,hs_lead_status,lifecyclestage,company",
    };
    if (after) params.after = after;
    var data = await callHubSpot("/crm/v3/objects/contacts", params);
    if (data.results) all = all.concat(data.results);
    if (!data.paging || !data.paging.next || !data.paging.next.after) break;
    after = data.paging.next.after;
  }
  return all;
}

// Fetch only contacts that have a phone number (search API)
export async function fetchAllContactsWithPhone() {
  var all = [];
  var after = undefined;
  while (true) {
    var searchBody = {
      filterGroups: [
        { filters: [{ propertyName: "phone", operator: "HAS_PROPERTY" }] },
        { filters: [{ propertyName: "mobilephone", operator: "HAS_PROPERTY" }] },
      ],
      properties: ["firstname", "lastname", "phone", "mobilephone", "email", "createdate", "hs_lead_status", "lifecyclestage", "company"],
      limit: 100,
    };
    if (after) searchBody.after = after;
    var data = await callHubSpot("/crm/v3/objects/contacts/search", null, searchBody);
    if (data.results) all = all.concat(data.results);
    if (!data.paging || !data.paging.next || !data.paging.next.after) break;
    after = data.paging.next.after;
  }
  console.log("[HS] Contacts with phone:", all.length);
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
      properties: ["hs_meeting_title", "hs_meeting_start_time", "hs_meeting_end_time", "hs_meeting_outcome", "hubspot_owner_id", "hs_meeting_source"],
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

  // Step 2: Fetch contact associations using v4 batch API (100 per request, up to 3 in parallel)
  console.log("[HS] Fetching associations for", all.length, "meetings via batch API...");
  var assocMap = {};
  var BATCH = 100;
  var CONCURRENCY = 3;
  var chunks = [];
  for (var i = 0; i < all.length; i += BATCH) {
    chunks.push(all.slice(i, i + BATCH));
  }
  for (var ci = 0; ci < chunks.length; ci += CONCURRENCY) {
    var group = chunks.slice(ci, ci + CONCURRENCY);
    var promises = group.map(function(chunk) {
      var inputs = chunk.map(function(meeting) { return { id: meeting.id }; });
      return callHubSpot("/crm/v4/associations/meetings/contacts/batch/read", null, { inputs: inputs }).catch(function(e) {
        console.warn("[HS] Batch association error:", e.message);
        return { results: [] };
      });
    });
    var results = await Promise.all(promises);
    for (var ri = 0; ri < results.length; ri++) {
      var batchData = results[ri];
      if (batchData.results) {
        for (var r = 0; r < batchData.results.length; r++) {
          var item = batchData.results[r];
          var fromId = item.from && item.from.id;
          if (fromId && item.to && item.to.length > 0) {
            assocMap[fromId] = item.to.map(function(t) { return { id: String(t.toObjectId) }; });
          }
        }
      }
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

// Batch-read contacts by IDs (up to 3 batches in parallel)
export async function fetchContactsByIds(contactIds) {
  var all = [];
  var BATCH = 100;
  var CONCURRENCY = 3;
  var chunks = [];
  for (var i = 0; i < contactIds.length; i += BATCH) {
    chunks.push(contactIds.slice(i, i + BATCH));
  }
  for (var ci = 0; ci < chunks.length; ci += CONCURRENCY) {
    var group = chunks.slice(ci, ci + CONCURRENCY);
    var promises = group.map(function(batch) {
      var inputs = batch.map(function(id) { return { id: id }; });
      return callHubSpot("/crm/v3/objects/contacts/batch/read", null, {
        inputs: inputs,
        properties: ["firstname", "lastname", "phone", "mobilephone", "email", "createdate", "hs_lead_status", "lifecyclestage", "company"]
      });
    });
    var results = await Promise.all(promises);
    for (var ri = 0; ri < results.length; ri++) {
      if (results[ri].results) all = all.concat(results[ri].results);
    }
  }
  return all;
}

// Search leads (object) from a date onwards, filtered by pipeline
// Tries Search API first, falls back to list+filter if search fails
export async function fetchLeadsSince(sinceIso, pipelineId) {
  var sinceMs = String(new Date(sinceIso).getTime());
  var properties = ["hs_pipeline", "hs_pipeline_stage", "hs_lead_name", "createdate", "hs_createdate"];

  // Try search API first (server-side filtering = fewer pages)
  try {
    var filters = [{ propertyName: "hs_createdate", operator: "GTE", value: sinceMs }];
    if (pipelineId) filters.push({ propertyName: "hs_pipeline", operator: "EQ", value: pipelineId });
    var all = [];
    var after = undefined;
    while (true) {
      var searchBody = {
        filterGroups: [{ filters: filters }],
        properties: properties,
        limit: 100,
      };
      if (after) searchBody.after = after;
      var data = await callHubSpot("/crm/v3/objects/0-136/search", null, searchBody);
      if (data.results) all = all.concat(data.results);
      if (!data.paging || !data.paging.next || !data.paging.next.after) break;
      after = data.paging.next.after;
    }
    console.log("[HS] Leads via search API:", all.length);
    return all;
  } catch (e) {
    console.warn("[HS] Leads search API failed, falling back to list+filter:", e.message);
  }

  // Fallback: list all + filter client-side
  var all = [];
  var after = undefined;
  while (true) {
    var params = { limit: "100", properties: properties.join(",") };
    if (after) params.after = after;
    var data = await callHubSpot("/crm/v3/objects/0-136", params);
    if (data.results) all = all.concat(data.results);
    if (!data.paging || !data.paging.next || !data.paging.next.after) break;
    after = data.paging.next.after;
  }
  console.log("[HS] Total leads fetched (fallback):", all.length);

  var sinceDate = new Date(sinceIso);
  var filtered = all.filter(function(lead) {
    var props = lead.properties || {};
    if (pipelineId && props.hs_pipeline !== pipelineId) return false;
    var cd = props.createdate || props.hs_createdate || lead.createdAt;
    if (!cd) return false;
    return new Date(cd) >= sinceDate;
  });
  console.log("[HS] Leads after filter (fallback, pipeline=" + pipelineId + ", since=" + sinceIso + "):", filtered.length);
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
  // Map contactId → array of ALL clean phone numbers (phone + mobilephone)
  var contactPhonesMap = {};
  for (var i = 0; i < contacts.length; i++) {
    var c = contacts[i];
    var phones = [];
    if (c.properties) {
      if (c.properties.phone) { var p1 = c.properties.phone.replace(/\D/g, ""); if (p1) phones.push(p1); }
      if (c.properties.mobilephone) { var p2 = c.properties.mobilephone.replace(/\D/g, ""); if (p2 && phones.indexOf(p2) < 0) phones.push(p2); }
    }
    if (phones.length > 0) contactPhonesMap[c.id] = phones;
  }
  var meetingPhones = {};
  for (var j = 0; j < meetings.length; j++) {
    var m = meetings[j];
    var assoc = m.associations && m.associations.contacts && m.associations.contacts.results;
    if (!assoc) continue;
    for (var k = 0; k < assoc.length; k++) {
      var contactId = assoc[k].id;
      var cPhones = contactPhonesMap[contactId];
      if (cPhones) { for (var pi = 0; pi < cPhones.length; pi++) meetingPhones[cPhones[pi]] = true; }
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

// Fetch leads (0-136) for Growth tab — uses denormalized properties on the lead itself
// Tries Search API first, falls back to list+filter if search fails
export async function fetchGrowthLeads(sinceIso, pipelineId) {
  var properties = [
    "hs_pipeline", "hs_pipeline_stage", "hs_lead_name", "createdate", "hs_createdate",
    "hubspot_owner_id", "prioridad_plg", "prioridad_plg_mqlpql",
    "hs_contact_analytics_source", "hs_contact_analytics_source_data_1",
    "email", "numero_de_telefono", "industria", "lead_sales_channels",
    "fuente_original_de_trafico", "fuente_yavendio", "hs_lead_label"
  ];
  var sinceMs = String(new Date(sinceIso).getTime());
  var filtered;

  // Try search API first
  try {
    var filters = [{ propertyName: "hs_createdate", operator: "GTE", value: sinceMs }];
    if (pipelineId) filters.push({ propertyName: "hs_pipeline", operator: "EQ", value: pipelineId });
    var all = [];
    var after = undefined;
    while (true) {
      var searchBody = {
        filterGroups: [{ filters: filters }],
        properties: properties,
        limit: 100,
      };
      if (after) searchBody.after = after;
      var data = await callHubSpot("/crm/v3/objects/0-136/search", null, searchBody);
      if (data.results) all = all.concat(data.results);
      if (!data.paging || !data.paging.next || !data.paging.next.after) break;
      after = data.paging.next.after;
    }
    console.log("[HS Growth] Leads via search API:", all.length);
    filtered = all;
  } catch (e) {
    console.warn("[HS Growth] Search API failed, falling back to list+filter:", e.message);
    // Fallback: list all + filter client-side
    var all = [];
    var after = undefined;
    while (true) {
      var params = { limit: "100", properties: properties.join(",") };
      if (after) params.after = after;
      var data = await callHubSpot("/crm/v3/objects/0-136", params);
      if (data.results) all = all.concat(data.results);
      if (!data.paging || !data.paging.next || !data.paging.next.after) break;
      after = data.paging.next.after;
    }
    console.log("[HS Growth] Total leads fetched (fallback):", all.length);
    var sinceDate = new Date(sinceIso);
    filtered = all.filter(function(lead) {
      var p = lead.properties || {};
      if (pipelineId && p.hs_pipeline !== pipelineId) return false;
      var cd = p.createdate || p.hs_createdate || lead.createdAt;
      if (!cd) return false;
      return new Date(cd) >= sinceDate;
    });
    console.log("[HS Growth] Leads after filter (fallback):", filtered.length);
  }

  // Map lead properties into _contactProps for compatibility with UI code
  for (var i = 0; i < filtered.length; i++) {
    var lp = filtered[i].properties || {};
    filtered[i]._contactProps = {
      hubspot_owner_id: lp.hubspot_owner_id || "",
      prioridad_plg: lp.prioridad_plg || "",
      hs_analytics_source: lp.hs_contact_analytics_source || lp.fuente_original_de_trafico || "",
      hs_analytics_source_data_1: lp.hs_contact_analytics_source_data_1 || "",
      initial_utm_campaign: lp.fuente_yavendio || "",
      email: lp.email || "",
      phone: lp.numero_de_telefono || "",
      industria: lp.industria || "",
    };
  }

  return filtered;
}

// Fetch owner names by IDs (parallel, max 5 at a time)
export async function fetchOwnersByIds(ownerIds) {
  var map = {};
  if (!ownerIds || ownerIds.length === 0) return map;
  var CONCURRENCY = 5;
  for (var i = 0; i < ownerIds.length; i += CONCURRENCY) {
    var batch = ownerIds.slice(i, i + CONCURRENCY);
    var promises = batch.map(function(oid) {
      return callHubSpot("/crm/v3/owners/" + oid).then(function(data) {
        var name = ((data.firstName || "") + " " + (data.lastName || "")).trim();
        map[oid] = name || data.email || ("Owner " + oid);
      }).catch(function() {
        map[oid] = "Owner " + oid;
      });
    });
    await Promise.all(promises);
  }
  return map;
}

export function extractHubSpotPhones(contacts) {
  var phones = {};
  function addPhone(raw) {
    if (!raw) return;
    var clean = raw.replace(/\D/g, "");
    if (!clean) return;
    phones[clean] = true;
    if (clean.length > 11) phones[clean.slice(-11)] = true;
    if (clean.length > 10) phones[clean.slice(-10)] = true;
    if (clean.length > 9) phones[clean.slice(-9)] = true;
    if (clean.length > 8) phones[clean.slice(-8)] = true;
  }
  for (var i = 0; i < contacts.length; i++) {
    var c = contacts[i];
    if (c.properties) {
      addPhone(c.properties.phone);
      addPhone(c.properties.mobilephone);
    }
  }
  return phones;
}
