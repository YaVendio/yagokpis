-- Add hs_meeting_source to get_meetings_lean so the dashboard can filter by scheduling link
-- Must DROP first because CREATE OR REPLACE cannot change RETURNS TABLE columns

DROP FUNCTION IF EXISTS get_meetings_lean(timestamptz);

CREATE OR REPLACE FUNCTION get_meetings_lean(since_iso timestamptz)
RETURNS TABLE (
  id text,
  created_at text,
  hs_createdate text,
  hubspot_owner_id text,
  hs_meeting_outcome text,
  hs_activity_type text,
  hs_meeting_title text,
  hs_meeting_source text,
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
    m.data->'properties'->>'hs_meeting_source',
    m.data->'properties'->>'hs_meeting_start_time',
    COALESCE(m.data->'associations'->'contacts'->'results', '[]'::jsonb)
  FROM hs_meetings m
  WHERE m.hs_createdate >= since_iso
  ORDER BY m.hs_createdate DESC;
$$;

GRANT EXECUTE ON FUNCTION get_meetings_lean(timestamptz) TO anon;
