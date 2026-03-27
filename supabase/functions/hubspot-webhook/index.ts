import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  getSupabaseAdmin,
  hsGet,
  fetchBatchAssociations,
  fetchBatchRead,
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // HubSpot sends webhooks as POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Validate HMAC signature (v3)
  const signature = req.headers.get("x-hubspot-signature-v3");
  const timestamp = req.headers.get("x-hubspot-request-timestamp");
  const clientSecret = Deno.env.get("HUBSPOT_CLIENT_SECRET");

  const rawBody = await req.text();

  if (clientSecret && signature && timestamp) {
    // Reject if timestamp > 5 minutes old
    const tsMs = parseInt(timestamp, 10);
    if (Date.now() - tsMs > 300000) {
      console.warn("[webhook] Rejected: timestamp too old");
      return new Response("Timestamp expired", { status: 401 });
    }

    // Verify HMAC-SHA256: method + url + body + timestamp
    // req.url returns internal Deno runtime URL (http://0.0.0.0:8000/...), not the public URL HubSpot signed against
    const requestUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/hubspot-webhook`;
    const sourceString = req.method + requestUri + rawBody + timestamp;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(clientSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(sourceString));
    const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));

    if (expected !== signature) {
      console.warn("[webhook] Rejected: invalid signature");
      return new Response("Invalid signature", { status: 401 });
    }
  } else if (clientSecret) {
    // Secret is set but no signature headers = skip validation (dev mode)
    console.warn("[webhook] No signature headers, processing anyway");
  }

  let events: any[];
  try {
    events = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!Array.isArray(events) || events.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), { headers: corsHeaders });
  }

  const supabase = getSupabaseAdmin();

  // Deduplicate by objectType + objectId
  const seen = new Set<string>();
  const deduped: any[] = [];
  for (const evt of events) {
    const key = `${evt.objectTypeId || evt.subscriptionType}:${evt.objectId}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(evt);
    }
  }

  console.log(`[webhook] HMAC validated OK — processing ${deduped.length} events (from ${events.length} raw)`);

  for (const evt of deduped) {
    try {
      await processEvent(supabase, evt);
    } catch (e) {
      console.error(`[webhook] Error processing event ${evt.subscriptionType} ${evt.objectId}:`, e);
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: deduped.length }), { headers: corsHeaders });
});

async function processEvent(supabase: any, evt: any) {
  const { subscriptionType, objectId } = evt;
  const id = String(objectId);

  // Parse event type: "contact.creation", "contact.propertyChange", "deal.deletion", etc.
  const [objectType, action] = subscriptionType.split(".");

  if (action === "deletion") {
    await handleDeletion(supabase, objectType, id);
    return;
  }

  // For creation, propertyChange, associationChange: re-fetch full object and upsert
  if (objectType === "contact") {
    await syncContact(supabase, id);
  } else if (objectType === "deal") {
    await syncDeal(supabase, id);
  } else if (objectType === "lead") {
    await syncLead(supabase, id);
  } else if (objectType === "meeting") {
    await syncMeeting(supabase, id);
  }
}

async function handleDeletion(supabase: any, objectType: string, id: string) {
  if (objectType === "contact") {
    await supabase.from("hs_contacts").delete().eq("id", id);
  } else if (objectType === "deal") {
    await supabase.from("hs_deals").delete().eq("id", id);
  } else if (objectType === "lead") {
    await supabase.from("hs_leads").delete().eq("id", id);
  } else if (objectType === "meeting") {
    await supabase.from("hs_meetings").delete().eq("id", id);
  }
  console.log(`[webhook] Deleted ${objectType} ${id}`);
}

async function syncContact(supabase: any, id: string) {
  const contacts = await fetchBatchRead("contacts", [id], CONTACT_PROPS);
  if (contacts.length > 0) {
    const c = contacts[0];
    await supabase.from("hs_contacts").upsert({ id: c.id, data: c, email: (c.properties?.email || "").toLowerCase().trim() || null });
    console.log(`[webhook] Upserted contact ${id}`);
  }
}

async function syncMeeting(supabase: any, id: string) {
  const props = MEETING_PROPS.join(",");
  const meeting = await hsGet(`/crm/v3/objects/meetings/${id}`, { properties: props });

  // Fetch contact associations
  const assocMap = await fetchBatchAssociations("meetings", "contacts", [id]);
  if (assocMap[id]) {
    meeting.associations = { contacts: { results: assocMap[id] } };
  }

  await supabase.from("hs_meetings").upsert({
    id: meeting.id,
    data: meeting,
    hs_createdate: meeting.properties?.hs_createdate || null,
    hubspot_owner_id: meeting.properties?.hubspot_owner_id || null,
  });
  console.log(`[webhook] Upserted meeting ${id}`);

  // Upsert associated contacts
  const contactIds = assocMap[id]?.map((a: any) => a.id) || [];
  if (contactIds.length > 0) {
    const contacts = await fetchBatchRead("contacts", contactIds, CONTACT_PROPS);
    for (const c of contacts) {
      await supabase.from("hs_contacts").upsert({ id: c.id, data: c, email: (c.properties?.email || "").toLowerCase().trim() || null });
    }
    console.log(`[webhook] Upserted ${contacts.length} associated contacts for meeting ${id}`);
  }
}

async function syncLead(supabase: any, id: string) {
  // Fetch lead (object type 0-136)
  const props = LEAD_PROPS.join(",");
  const lead = await hsGet(`/crm/v3/objects/0-136/${id}`, { properties: props });

  // Fetch contact association (0-136 -> 0-1)
  const assocMap = await fetchBatchAssociations("0-136", "0-1", [id]);
  const assocContactId = assocMap[id]?.[0]?.id;

  // Enrich with _contactProps from associated contact
  let contactData: any = null;
  if (assocContactId) {
    const contacts = await fetchBatchRead("contacts", [assocContactId], ["prioridad_plg", "email"]);
    if (contacts.length > 0) {
      contactData = {
        prioridad_plg: contacts[0].properties?.prioridad_plg || "",
        email: contacts[0].properties?.email || "",
      };
    }
  }

  const lp = lead.properties || {};
  lead._contactProps = {
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

  await supabase.from("hs_leads").upsert({
    id: lead.id,
    data: lead,
    hs_pipeline: lp.hs_pipeline || null,
    hs_createdate: lp.hs_createdate || null,
  });
  console.log(`[webhook] Upserted lead ${id}`);
}

async function syncDeal(supabase: any, id: string) {
  // Fetch deal
  const props = DEAL_PROPS.join(",");
  const deal = await hsGet(`/crm/v3/objects/deals/${id}`, { properties: props });

  // Fetch associations
  const assocMap = await fetchBatchAssociations("deals", "contacts", [id]);
  if (assocMap[id]) {
    deal.associations = { contacts: { results: assocMap[id] } };
  }

  await supabase.from("hs_deals").upsert({
    id: deal.id,
    data: deal,
    pipeline: deal.properties?.pipeline || null,
    createdate: deal.properties?.createdate || null,
    hubspot_owner_id: deal.properties?.hubspot_owner_id || null,
  });
  console.log(`[webhook] Upserted deal ${id}`);

  // Upsert any new contacts from associations
  const contactIds = assocMap[id]?.map((a: any) => a.id) || [];
  if (contactIds.length > 0) {
    const contacts = await fetchBatchRead("contacts", contactIds, CONTACT_PROPS);
    for (const c of contacts) {
      await supabase.from("hs_contacts").upsert({ id: c.id, data: c, email: (c.properties?.email || "").toLowerCase().trim() || null });
    }
    console.log(`[webhook] Upserted ${contacts.length} associated contacts for deal ${id}`);
  }

  // Upsert owner if new
  const ownerId = deal.properties?.hubspot_owner_id;
  if (ownerId) {
    const { data: existing } = await supabase.from("hs_owners").select("id").eq("id", ownerId).single();
    if (!existing) {
      try {
        const owner = await hsGet(`/crm/v3/owners/${ownerId}`);
        const name = ((owner.firstName || "") + " " + (owner.lastName || "")).trim() || owner.email || `Owner ${ownerId}`;
        await supabase.from("hs_owners").upsert({ id: ownerId, name, email: owner.email || null });
        console.log(`[webhook] Upserted new owner ${ownerId}`);
      } catch (e) {
        console.warn(`[webhook] Owner ${ownerId} fetch failed:`, e);
      }
    }
  }
}
