import { supabase, retryQuery } from "./supabase";

var PAGE_SIZE = 1000;
var MAX_PARALLEL = 3;

// Generic paginated fetch with retry + parallel pages
// Accepts a factory function that returns a fresh query builder for each page
async function fetchAllRows(queryFactory) {
  var { data, error } = await retryQuery(function() {
    return queryFactory().range(0, PAGE_SIZE - 1);
  });
  if (error) { return { rows: [], error: error }; }
  if (!data || data.length === 0) return { rows: [], error: null };

  var all = data.slice();
  if (data.length < PAGE_SIZE) return { rows: all, error: null };

  var from = PAGE_SIZE;
  var done = false;
  while (!done) {
    var batch = [];
    for (var b = 0; b < MAX_PARALLEL; b++) {
      var start = from + b * PAGE_SIZE;
      batch.push((function(s) {
        return retryQuery(function() { return queryFactory().range(s, s + PAGE_SIZE - 1); });
      })(start));
    }
    var results = await Promise.all(batch);
    for (var ri = 0; ri < results.length; ri++) {
      if (results[ri].error) { return { rows: all, error: results[ri].error }; }
      var pageData = results[ri].data;
      if (!pageData || pageData.length === 0) { done = true; break; }
      for (var i = 0; i < pageData.length; i++) all.push(pageData[i]);
      if (pageData.length < PAGE_SIZE) { done = true; break; }
    }
    from += MAX_PARALLEL * PAGE_SIZE;
  }
  return { rows: all, error: null };
}

// --- Adapters: reconstruct the shape App.jsx expects ---

function adaptMeeting(r) {
  return {
    id: r.id,
    createdAt: r.created_at,
    properties: {
      hs_createdate: r.hs_createdate,
      hubspot_owner_id: r.hubspot_owner_id,
      hs_meeting_outcome: r.hs_meeting_outcome,
      hs_activity_type: r.hs_activity_type,
      hs_meeting_title: r.hs_meeting_title,
      hs_meeting_source: r.hs_meeting_source,
      hs_meeting_start_time: r.hs_meeting_start_time
    },
    associations: {
      contacts: {
        results: (r.contact_ids || []).map(function(c) { return { id: String(c.id) }; })
      }
    }
  };
}

function adaptDeal(r) {
  return {
    id: r.id,
    properties: {
      dealname: r.dealname,
      dealstage: r.dealstage,
      amount: r.amount,
      pipeline: r.pipeline,
      createdate: r.createdate,
      closedate: r.closedate,
      days_to_close: r.days_to_close,
      hs_is_closed_won: r.hs_is_closed_won,
      hs_is_closed_lost: r.hs_is_closed_lost,
      hubspot_owner_id: r.hubspot_owner_id,
      hs_analytics_source: r.hs_analytics_source
    },
    associations: {
      contacts: {
        results: (r.contact_ids || []).map(function(c) { return { id: String(c.id) }; })
      }
    }
  };
}

function adaptContact(r) {
  return {
    id: r.id,
    properties: {
      firstname: r.firstname,
      lastname: r.lastname,
      phone: r.phone,
      mobilephone: r.mobilephone,
      hs_whatsapp_phone_number: r.hs_whatsapp_phone_number,
      email: r.email,
      company: r.company,
      hs_analytics_source: r.hs_analytics_source,
      prioridad_plg: r.prioridad_plg,
      registro_plg: r.registro_plg
    }
  };
}

function adaptLead(r) {
  return {
    id: r.id,
    createdAt: r.created_at,
    properties: {
      hs_pipeline: r.hs_pipeline,
      hs_pipeline_stage: r.hs_pipeline_stage,
      hs_lead_name: r.hs_lead_name,
      hs_lead_label: r.hs_lead_label,
      createdate: r.prop_createdate,
      hs_createdate: r.prop_hs_createdate
    },
    _contactProps: {
      hubspot_owner_id: r.cp_hubspot_owner_id,
      prioridad_plg: r.cp_prioridad_plg,
      hs_analytics_source: r.cp_hs_analytics_source,
      email: r.cp_email,
      createdate: r.cp_createdate
    }
  };
}

// --- Public functions (same signatures as before) ---

// Load meetings from Supabase via lean RPC (direct, no cache)
export async function loadMeetingsFromDb(sinceIso) {
  var { rows, error } = await fetchAllRows(function() {
    return supabase.rpc("get_meetings_lean", { since_iso: sinceIso });
  });
  if (error) { console.error("[sync] meetings error:", error.message); return []; }
  return rows.map(adaptMeeting);
}

// Load contacts by IDs via lean RPC (batched 300, not cached — depends on dynamic IDs)
export async function loadContactsFromDb(contactIds) {
  if (!contactIds || contactIds.length === 0) return [];
  var all = [];
  for (var i = 0; i < contactIds.length; i += 300) {
    var chunk = contactIds.slice(i, i + 300);
    var { data, error } = await retryQuery(function() {
      return supabase.rpc("get_contacts_lean", { p_contact_ids: chunk });
    });
    if (error) { console.error("[sync] contacts error:", error.message); continue; }
    if (data) for (var j = 0; j < data.length; j++) all.push(data[j]);
  }
  return all.map(adaptContact);
}

// Load deals from Supabase via lean RPC (direct, no cache)
export async function loadDealsFromDb(sinceIso) {
  var { rows, error } = await fetchAllRows(function() {
    return supabase.rpc("get_deals_lean", { since_iso: sinceIso });
  });
  if (error) { console.error("[sync] deals error:", error.message); return []; }
  return rows.map(adaptDeal);
}

// Load leads from Supabase via lean RPC (direct, no cache)
export async function loadLeadsFromDb(sinceIso, pipelineId) {
  var { rows, error } = await fetchAllRows(function() {
    return supabase.rpc("get_leads_lean", { since_iso: sinceIso, p_pipeline_id: pipelineId || null });
  });
  if (error) { console.error("[sync] leads error:", error.message); return []; }
  return rows.map(adaptLead);
}

// Load owners from Supabase hs_owners table (already lean)
export async function loadOwnersFromDb() {
  var { data, error } = await retryQuery(function() {
    return supabase.from("hs_owners").select("id, name");
  });
  if (error) { console.error("[sync] owners error:", error.message); return {}; }
  var map = {};
  for (var i = 0; i < (data || []).length; i++) {
    map[data[i].id] = data[i].name;
  }
  return map;
}

// Load pipelines from Supabase hs_pipelines table (already lean)
export async function loadPipelinesFromDb() {
  var { data, error } = await retryQuery(function() {
    return supabase.from("hs_pipelines").select("data").eq("id", "deals").single();
  });
  if (error) { console.error("[sync] pipelines error:", error.message); return null; }
  return data ? data.data : null;
}

// Load contacts by email via lean RPC (batched 50)
export async function loadContactsByEmail(emails) {
  if (!emails || emails.length === 0) return [];
  var all = [];
  for (var i = 0; i < emails.length; i += 50) {
    var chunk = emails.slice(i, i + 50);
    var { data, error } = await retryQuery(function() {
      return supabase.rpc("get_contacts_by_email_lean", { p_emails: chunk });
    });
    if (error) { console.error("[sync] email contacts error:", error.message); continue; }
    if (data) for (var j = 0; j < data.length; j++) all.push(data[j]);
  }
  return all.map(adaptContact);
}

// Targeted phone search: find contacts matching specific phone numbers via Supabase RPC
// Returns a phone lookup map { cleanedPhone: true } like extractHubSpotPhones
export async function loadContactPhoneMatches(phoneNumbers) {
  if (!phoneNumbers || phoneNumbers.length === 0) return {};
  // Clean and deduplicate
  var cleaned = [];
  var seen = {};
  for (var i = 0; i < phoneNumbers.length; i++) {
    var p = (phoneNumbers[i] || "").replace(/\D/g, "");
    if (p && !seen[p]) { seen[p] = true; cleaned.push(p); }
  }
  if (cleaned.length === 0) return {};
  // Batch in chunks of 200
  var phones = {};
  for (var b = 0; b < cleaned.length; b += 200) {
    var chunk = cleaned.slice(b, b + 200);
    var { data, error } = await retryQuery(function() {
      return supabase.rpc("get_contacts_by_phones_fast", { p_phones: chunk });
    });
    if (error) { console.error("[sync] phone match error:", error.message); continue; }
    if (data) {
      for (var j = 0; j < data.length; j++) {
        var r = data[j];
        addPhoneVariants(phones, r.phone_digits);
        addPhoneVariants(phones, r.mobile_digits);
        addPhoneVariants(phones, r.whatsapp_digits);
      }
    }
  }
  console.log("[sync] Phone matches found:", Object.keys(phones).length, "variants from", cleaned.length, "input phones");
  return phones;
}

function addPhoneVariants(map, raw) {
  if (!raw) return;
  var clean = raw.replace(/\D/g, "");
  if (!clean) return;
  map[clean] = true;
  if (clean.length > 11) map[clean.slice(-11)] = true;
  if (clean.length > 10) map[clean.slice(-10)] = true;
  if (clean.length > 9) map[clean.slice(-9)] = true;
  if (clean.length > 8) map[clean.slice(-8)] = true;
}

// Trigger incremental sync on server (fire-and-forget from browser)
export async function triggerIncrementalSync() {
  var password = sessionStorage.getItem("dashboard_password") || "";
  try {
    await supabase.functions.invoke("hubspot-sync", {
      body: { password: password, mode: "incremental" }
    });
    console.log("[sync] Incremental sync triggered");
  } catch (e) {
    console.warn("[sync] Incremental sync trigger failed:", e.message);
  }
}
