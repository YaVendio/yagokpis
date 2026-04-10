import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  getSupabaseAdmin,
  hsGet,
  hsPost,
  fetchAllPaginated,
  fetchAllList,
  fetchBatchAssociations,
  fetchBatchRead,
  batchUpsert,
  corsHeaders,
} from "../_shared/hubspot-helpers.ts";

const MEETING_PROPS = [
  "hs_meeting_title", "hs_meeting_start_time", "hs_meeting_end_time",
  "hs_meeting_outcome", "hubspot_owner_id", "hs_meeting_source",
  "hs_createdate", "hs_activity_type",
];

const CONTACT_PROPS = [
  "firstname", "lastname", "phone", "mobilephone", "hs_whatsapp_phone_number",
  "email", "hs_additional_emails", "createdate", "hs_lead_status", "lifecyclestage", "company",
  "hs_analytics_source", "prioridad_plg", "registro_plg", "country",
];

const DEAL_PROPS = [
  "dealname", "dealstage", "amount", "pipeline", "createdate", "closedate",
  "days_to_close", "hs_is_closed_won", "hs_is_closed_lost", "hubspot_owner_id",
  "hs_analytics_source", "hs_analytics_source_data_1",
];

const LEAD_PROPS = [
  "hs_pipeline", "hs_pipeline_stage", "hs_lead_name", "createdate", "hs_createdate",
  "hubspot_owner_id", "prioridad_plg", "prioridad_plg_mqlpql",
  "hs_contact_analytics_source", "hs_contact_analytics_source_data_1",
  "email", "numero_de_telefono", "industria", "lead_sales_channels",
  "fuente_original_de_trafico", "fuente_yavendio", "hs_lead_label",
];

const DEAL_PIPELINES = ["720627716", "833703951"];
const LEAD_PIPELINE = "808581652";

/**
 * Cleanup: reads all IDs from a Supabase table, batch-verifies them against
 * HubSpot, and deletes any that no longer exist. Processes up to 1000 at a time.
 */
async function cleanupDeleted(
  supabase: any,
  table: string,
  objectType: string,
  label: string,
): Promise<number> {
  // Get all IDs from Supabase (paginate past 1000-row limit)
  const allDbIds: string[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data } = await supabase.from(table).select("id").range(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    for (const r of data) allDbIds.push(r.id);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`[cleanup] ${label}: ${allDbIds.length} records in DB, batch-verifying...`);

  // Batch read from HubSpot (100 per request, 3 concurrent)
  const confirmedDeleted: string[] = [];
  const chunks: string[][] = [];
  for (let i = 0; i < allDbIds.length; i += 100) {
    chunks.push(allDbIds.slice(i, i + 100));
  }
  for (let ci = 0; ci < chunks.length; ci += 3) {
    const group = chunks.slice(ci, ci + 3);
    const results = await Promise.all(
      group.map((batch) =>
        hsPost(`/crm/v3/objects/${objectType}/batch/read`, {
          inputs: batch.map(id => ({ id })),
          properties: ["hs_createdate"],
        }).catch(() => ({ results: [] }))
      )
    );
    for (let gi = 0; gi < group.length; gi++) {
      const batch = group[gi];
      const found = new Set((results[gi]?.results || []).map((r: any) => String(r.id)));
      for (const id of batch) {
        if (!found.has(id)) confirmedDeleted.push(id);
      }
    }
  }

  if (confirmedDeleted.length > 0) {
    for (let i = 0; i < confirmedDeleted.length; i += 100) {
      await supabase.from(table).delete().in("id", confirmedDeleted.slice(i, i + 100));
    }
    console.log(`[cleanup] ${label}: cleaned ${confirmedDeleted.length} deleted records`);
  } else {
    console.log(`[cleanup] ${label}: all records valid`);
  }

  return confirmedDeleted.length;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const { password, mode } = await req.json();
  if (!password || password !== Deno.env.get("DASHBOARD_PASSWORD")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: corsHeaders,
    });
  }

  const supabase = getSupabaseAdmin();

  // Cleanup mode: lightweight pass that only removes deleted records
  if (mode === "cleanup") {
    console.log("[cleanup] Starting cleanup pass...");
    const counts: Record<string, number> = {};
    try {
      counts.meetings_cleaned = await cleanupDeleted(supabase, "hs_meetings", "meetings", "meetings");
      counts.contacts_cleaned = await cleanupDeleted(supabase, "hs_contacts", "contacts", "contacts");
      counts.deals_cleaned = await cleanupDeleted(supabase, "hs_deals", "deals", "deals");
      console.log("[cleanup] done:", counts);
      return new Response(JSON.stringify({ ok: true, counts }), { headers: corsHeaders });
    } catch (e) {
      console.error("[cleanup] error:", e);
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
    }
  }

  const isIncremental = mode === "incremental";
  const syncType = isIncremental ? "incremental" : "full";

  // Log sync start
  const { data: logRow } = await supabase.from("hs_sync_log")
    .insert({ sync_type: syncType }).select("id").single();
  const logId = logRow?.id;

  try {
    // Determine "since" date
    let sinceIso: string;
    if (isIncremental) {
      // Last successful sync timestamp
      const { data: lastSync } = await supabase.from("hs_sync_log")
        .select("completed_at")
        .eq("status", "done")
        .order("completed_at", { ascending: false })
        .limit(1)
        .single();
      sinceIso = lastSync?.completed_at || getThreeMonthsAgo();
    } else {
      sinceIso = getThreeMonthsAgo();
    }
    const sinceMs = String(new Date(sinceIso).getTime());

    console.log(`[sync] ${syncType} since ${sinceIso}`);
    const counts: Record<string, number> = {};

    // 1. Meetings — by createdate OR lastmodifieddate (to catch outcome changes)
    const meetingsRaw = await fetchAllPaginated("/crm/v3/objects/meetings/search", {
      filterGroups: [
        { filters: [{ propertyName: "hs_createdate", operator: "GTE", value: sinceMs }] },
        { filters: [{ propertyName: "hs_lastmodifieddate", operator: "GTE", value: sinceMs }] },
      ],
      properties: MEETING_PROPS,
    });
    // Deduplicate by meeting ID
    const meetingMap = new Map<string, any>();
    for (const m of meetingsRaw) meetingMap.set(m.id, m);
    const meetings = Array.from(meetingMap.values());
    console.log(`[sync] meetings: ${meetings.length} (raw ${meetingsRaw.length})`);

    // Meeting associations
    if (meetings.length > 0) {
      const meetingIds = meetings.map((m: any) => m.id);
      const meetingAssoc = await fetchBatchAssociations("meetings", "contacts", meetingIds);
      for (const m of meetings) {
        if (meetingAssoc[m.id]) {
          m.associations = { contacts: { results: meetingAssoc[m.id] } };
        }
      }
    }

    const meetingRows = meetings.map((m: any) => ({
      id: m.id,
      data: m,
      hs_createdate: m.properties?.hs_createdate || null,
      hubspot_owner_id: m.properties?.hubspot_owner_id || null,
    }));
    await batchUpsert(supabase, "hs_meetings", meetingRows);
    counts.meetings = meetings.length;

    // 2. Deals (both pipelines) — by createdate OR lastmodifieddate
    const dealFilterGroups = [];
    for (const pid of DEAL_PIPELINES) {
      dealFilterGroups.push({
        filters: [
          { propertyName: "createdate", operator: "GTE", value: sinceMs },
          { propertyName: "pipeline", operator: "EQ", value: pid },
        ],
      });
      dealFilterGroups.push({
        filters: [
          { propertyName: "hs_lastmodifieddate", operator: "GTE", value: sinceMs },
          { propertyName: "pipeline", operator: "EQ", value: pid },
        ],
      });
    }
    const dealsRaw = await fetchAllPaginated("/crm/v3/objects/deals/search", {
      filterGroups: dealFilterGroups,
      properties: DEAL_PROPS,
    });
    // Deduplicate by deal ID
    const dealMap = new Map<string, any>();
    for (const d of dealsRaw) dealMap.set(d.id, d);
    const deals = Array.from(dealMap.values());
    console.log(`[sync] deals: ${deals.length} (raw ${dealsRaw.length})`);

    // Deal associations
    if (deals.length > 0) {
      const dealIds = deals.map((d: any) => d.id);
      const dealAssoc = await fetchBatchAssociations("deals", "contacts", dealIds);
      for (const d of deals) {
        if (dealAssoc[d.id]) {
          d.associations = { contacts: { results: dealAssoc[d.id] } };
        }
      }
    }

    const dealRows = deals.map((d: any) => ({
      id: d.id,
      data: d,
      pipeline: d.properties?.pipeline || null,
      createdate: d.properties?.createdate || null,
      closedate: d.properties?.closedate || null,
      hubspot_owner_id: d.properties?.hubspot_owner_id || null,
    }));
    await batchUpsert(supabase, "hs_deals", dealRows);
    counts.deals = deals.length;

    // 3. Contacts (from meeting + deal associations)
    const contactIdSet = new Set<string>();
    for (const m of meetings) {
      const assoc = m.associations?.contacts?.results;
      if (assoc) for (const a of assoc) contactIdSet.add(a.id);
    }
    for (const d of deals) {
      const assoc = d.associations?.contacts?.results;
      if (assoc) for (const a of assoc) contactIdSet.add(a.id);
    }
    const contactIds = Array.from(contactIdSet);
    let contacts: any[] = [];
    if (contactIds.length > 0) {
      contacts = await fetchBatchRead("contacts", contactIds, CONTACT_PROPS);
    }
    console.log(`[sync] contacts: ${contacts.length}`);

    const contactRows: any[] = contacts.map((c: any) => ({
      id: c.id,
      data: c,
      email: (c.properties?.email || "").toLowerCase().trim() || null,
    }));
    await batchUpsert(supabase, "hs_contacts", contactRows);
    counts.contacts = contacts.length;

    // 3b. Enrich: find sibling contacts by email (for phoneless meeting contacts)
    const phonelessEmails: string[] = [];
    for (const c of contacts) {
      const p = c.properties;
      if (p?.email && !p.phone && !p.mobilephone && !p.hs_whatsapp_phone_number) {
        phonelessEmails.push(p.email);
      }
    }
    if (phonelessEmails.length > 0) {
      console.log(`[sync] phoneless contacts with email: ${phonelessEmails.length}`);
      const siblingContacts: any[] = [];
      // HubSpot search allows max 5 filterGroups — batch emails in groups of 5
      for (let ei = 0; ei < phonelessEmails.length; ei += 5) {
        const emailBatch = phonelessEmails.slice(ei, ei + 5);
        const filterGroups = emailBatch.map((email: string) => ({
          filters: [
            { propertyName: "email", operator: "EQ", value: email },
            { propertyName: "phone", operator: "HAS_PROPERTY" },
          ],
        }));
        const batch = await fetchAllPaginated("/crm/v3/objects/contacts/search", {
          filterGroups,
          properties: CONTACT_PROPS,
        });
        for (const sc of batch) siblingContacts.push(sc);
      }
      // Deduplicate and add to contactRows
      const newSiblings: any[] = [];
      for (const sc of siblingContacts) {
        if (!contactIdSet.has(sc.id)) {
          contactIdSet.add(sc.id);
          const row = { id: sc.id, data: sc, email: (sc.properties?.email || "").toLowerCase().trim() || null };
          contactRows.push(row);
          contacts.push(sc);
          newSiblings.push(row);
        }
      }
      if (newSiblings.length > 0) {
        await batchUpsert(supabase, "hs_contacts", newSiblings);
        console.log(`[sync] sibling contacts added: ${newSiblings.length}`);
      }
      counts.sibling_contacts = newSiblings.length;
    }

    // 4. Leads
    const leads = await fetchAllPaginated("/crm/v3/objects/0-136/search", {
      filterGroups: [{ filters: [
        { propertyName: "hs_createdate", operator: "GTE", value: sinceMs },
        { propertyName: "hs_pipeline", operator: "EQ", value: LEAD_PIPELINE },
      ] }],
      properties: LEAD_PROPS,
    });
    console.log(`[sync] leads: ${leads.length}`);

    // Lead associations + contact enrichment
    if (leads.length > 0) {
      const leadIds = leads.map((l: any) => l.id);
      const leadAssoc = await fetchBatchAssociations("0-136", "0-1", leadIds);

      // Collect associated contact IDs
      const leadContactIds = new Set<string>();
      const leadContactMap: Record<string, string> = {};
      for (const l of leads) {
        const assocContactId = leadAssoc[l.id]?.[0]?.id;
        if (assocContactId) {
          leadContactMap[l.id] = assocContactId;
          leadContactIds.add(assocContactId);
        }
      }

      // Batch-read contacts for prioridad_plg + email
      const leadContactArr = Array.from(leadContactIds);
      const contactPropsMap: Record<string, any> = {};
      if (leadContactArr.length > 0) {
        const contactBatch = await fetchBatchRead("contacts", leadContactArr, ["prioridad_plg", "email"]);
        for (const c of contactBatch) {
          contactPropsMap[c.id] = {
            prioridad_plg: c.properties?.prioridad_plg || "",
            email: c.properties?.email || "",
          };
        }
      }

      // Stitch _contactProps onto leads (same format as fetchGrowthLeads)
      for (const l of leads) {
        const lp = l.properties || {};
        const assocContactId = leadContactMap[l.id];
        const contactData = assocContactId ? contactPropsMap[assocContactId] : null;
        l._contactProps = {
          hubspot_owner_id: lp.hubspot_owner_id || "",
          prioridad_plg: contactData?.prioridad_plg || "",
          hs_analytics_source: lp.hs_contact_analytics_source || lp.fuente_original_de_trafico || "",
          hs_analytics_source_data_1: lp.hs_contact_analytics_source_data_1 || "",
          initial_utm_campaign: lp.fuente_yavendio || "",
          email: lp.email || contactData?.email || "",
          createdate: lp.createdate || lp.hs_createdate || "",
          phone: lp.numero_de_telefono || "",
          industria: lp.industria || "",
        };
      }
    }

    const leadRows = leads.map((l: any) => ({
      id: l.id,
      data: l,
      hs_pipeline: l.properties?.hs_pipeline || null,
      hs_createdate: l.properties?.hs_createdate || null,
    }));
    await batchUpsert(supabase, "hs_leads", leadRows);
    counts.leads = leads.length;

    // 5. Pipelines
    const pipelines = await hsGet("/crm/v3/pipelines/deals");
    await supabase.from("hs_pipelines").upsert({ id: "deals", data: pipelines });
    counts.pipelines = pipelines.results?.length || 0;

    // 6. Owners — collect from meetings + deals
    const ownerIdSet = new Set<string>();
    for (const m of meetings) {
      const oid = m.properties?.hubspot_owner_id;
      if (oid) ownerIdSet.add(oid);
    }
    for (const d of deals) {
      const oid = d.properties?.hubspot_owner_id;
      if (oid) ownerIdSet.add(oid);
    }
    const ownerRows: any[] = [];
    for (const oid of ownerIdSet) {
      try {
        const owner = await hsGet(`/crm/v3/owners/${oid}`);
        const name = ((owner.firstName || "") + " " + (owner.lastName || "")).trim() || owner.email || `Owner ${oid}`;
        ownerRows.push({ id: oid, name, email: owner.email || null });
      } catch (e) {
        console.warn(`Owner ${oid} fetch failed:`, e.message);
        ownerRows.push({ id: oid, name: `Owner ${oid}`, email: null });
      }
    }
    if (ownerRows.length > 0) {
      await batchUpsert(supabase, "hs_owners", ownerRows);
    }
    counts.owners = ownerRows.length;

    // Mark sync done
    if (logId) {
      await supabase.from("hs_sync_log").update({
        completed_at: new Date().toISOString(),
        status: "done",
        details: counts,
      }).eq("id", logId);
    }

    console.log("[sync] done:", counts);
    return new Response(JSON.stringify({ ok: true, counts }), { headers: corsHeaders });

  } catch (e) {
    console.error("[sync] error:", e);
    if (logId) {
      await supabase.from("hs_sync_log").update({
        completed_at: new Date().toISOString(),
        status: "error",
        details: { error: (e as Error).message },
      }).eq("id", logId);
    }
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: corsHeaders,
    });
  }
});

function getThreeMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 3, 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
