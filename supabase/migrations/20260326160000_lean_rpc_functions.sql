-- Lean RPC functions: return only fields used by the dashboard
-- This reduces payload by ~85% compared to returning full JSONB data column

-- 1. Meetings lean
CREATE OR REPLACE FUNCTION get_meetings_lean(since_iso timestamptz)
RETURNS TABLE (
  id text,
  created_at text,
  hs_createdate text,
  hubspot_owner_id text,
  hs_meeting_outcome text,
  hs_activity_type text,
  hs_meeting_title text,
  hs_meeting_start_time text,
  contact_ids jsonb
) LANGUAGE sql STABLE AS $$
  SELECT
    m.id,
    m.data->>'createdAt',
    m.data->'properties'->>'hs_createdate',
    m.data->'properties'->>'hubspot_owner_id',
    m.data->'properties'->>'hs_meeting_outcome',
    m.data->'properties'->>'hs_activity_type',
    m.data->'properties'->>'hs_meeting_title',
    m.data->'properties'->>'hs_meeting_start_time',
    COALESCE(m.data->'associations'->'contacts'->'results', '[]'::jsonb)
  FROM hs_meetings m
  WHERE m.hs_createdate >= since_iso
  ORDER BY m.hs_createdate DESC;
$$;

-- 2. Deals lean
CREATE OR REPLACE FUNCTION get_deals_lean(since_iso timestamptz)
RETURNS TABLE (
  id text, dealname text, dealstage text, amount text,
  pipeline text, createdate text, closedate text,
  days_to_close text, hs_is_closed_won text, hs_is_closed_lost text,
  hubspot_owner_id text, hs_analytics_source text, contact_ids jsonb
) LANGUAGE sql STABLE AS $$
  SELECT
    d.id,
    d.data->'properties'->>'dealname',
    d.data->'properties'->>'dealstage',
    d.data->'properties'->>'amount',
    d.data->'properties'->>'pipeline',
    d.data->'properties'->>'createdate',
    d.data->'properties'->>'closedate',
    d.data->'properties'->>'days_to_close',
    d.data->'properties'->>'hs_is_closed_won',
    d.data->'properties'->>'hs_is_closed_lost',
    d.data->'properties'->>'hubspot_owner_id',
    d.data->'properties'->>'hs_analytics_source',
    COALESCE(d.data->'associations'->'contacts'->'results', '[]'::jsonb)
  FROM hs_deals d
  WHERE d.pipeline IN ('720627716','833703951')
    AND d.createdate >= since_iso
  ORDER BY d.createdate DESC;
$$;

-- 3. Contacts lean (by IDs)
CREATE OR REPLACE FUNCTION get_contacts_lean(p_contact_ids text[])
RETURNS TABLE (
  id text, firstname text, lastname text,
  phone text, mobilephone text, hs_whatsapp_phone_number text,
  email text, company text, hs_analytics_source text,
  prioridad_plg text, registro_plg text
) LANGUAGE sql STABLE AS $$
  SELECT
    c.id,
    c.data->'properties'->>'firstname',
    c.data->'properties'->>'lastname',
    c.data->'properties'->>'phone',
    c.data->'properties'->>'mobilephone',
    c.data->'properties'->>'hs_whatsapp_phone_number',
    c.data->'properties'->>'email',
    c.data->'properties'->>'company',
    c.data->'properties'->>'hs_analytics_source',
    c.data->'properties'->>'prioridad_plg',
    c.data->'properties'->>'registro_plg'
  FROM hs_contacts c
  WHERE c.id = ANY(p_contact_ids);
$$;

-- 4. Contacts lean (by email)
CREATE OR REPLACE FUNCTION get_contacts_by_email_lean(p_emails text[])
RETURNS TABLE (
  id text, firstname text, lastname text,
  phone text, mobilephone text, hs_whatsapp_phone_number text,
  email text, company text, hs_analytics_source text,
  prioridad_plg text, registro_plg text
) LANGUAGE sql STABLE AS $$
  SELECT
    c.id,
    c.data->'properties'->>'firstname',
    c.data->'properties'->>'lastname',
    c.data->'properties'->>'phone',
    c.data->'properties'->>'mobilephone',
    c.data->'properties'->>'hs_whatsapp_phone_number',
    c.data->'properties'->>'email',
    c.data->'properties'->>'company',
    c.data->'properties'->>'hs_analytics_source',
    c.data->'properties'->>'prioridad_plg',
    c.data->'properties'->>'registro_plg'
  FROM hs_contacts c
  WHERE c.email = ANY(p_emails);
$$;

-- 5. Leads lean
CREATE OR REPLACE FUNCTION get_leads_lean(since_iso timestamptz, p_pipeline_id text DEFAULT NULL)
RETURNS TABLE (
  id text, created_at text,
  hs_pipeline text, hs_pipeline_stage text, hs_lead_name text,
  hs_lead_label text, prop_createdate text, prop_hs_createdate text,
  cp_hubspot_owner_id text, cp_prioridad_plg text,
  cp_hs_analytics_source text, cp_email text, cp_createdate text
) LANGUAGE sql STABLE AS $$
  SELECT
    l.id, l.data->>'createdAt',
    l.data->'properties'->>'hs_pipeline',
    l.data->'properties'->>'hs_pipeline_stage',
    l.data->'properties'->>'hs_lead_name',
    l.data->'properties'->>'hs_lead_label',
    l.data->'properties'->>'createdate',
    l.data->'properties'->>'hs_createdate',
    l.data->'_contactProps'->>'hubspot_owner_id',
    l.data->'_contactProps'->>'prioridad_plg',
    l.data->'_contactProps'->>'hs_analytics_source',
    l.data->'_contactProps'->>'email',
    l.data->'_contactProps'->>'createdate'
  FROM hs_leads l
  WHERE l.hs_createdate >= since_iso
    AND (p_pipeline_id IS NULL OR l.hs_pipeline = p_pipeline_id)
  ORDER BY l.hs_createdate DESC;
$$;

-- Grants for anon access
GRANT EXECUTE ON FUNCTION get_meetings_lean(timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION get_deals_lean(timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION get_contacts_lean(text[]) TO anon;
GRANT EXECUTE ON FUNCTION get_contacts_by_email_lean(text[]) TO anon;
GRANT EXECUTE ON FUNCTION get_leads_lean(timestamptz, text) TO anon;
