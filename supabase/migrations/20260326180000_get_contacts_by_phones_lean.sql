-- Targeted phone search: given cleaned phone numbers (digits only),
-- return matching contacts' phone fields using last-10-digits comparison.
-- Replaces loading ALL 10K+ contacts just for inbound phone matching.

CREATE OR REPLACE FUNCTION get_contacts_by_phones_lean(p_phones text[])
RETURNS TABLE (
  phone text, mobilephone text, hs_whatsapp_phone_number text
) LANGUAGE sql STABLE AS $$
  SELECT
    c.data->'properties'->>'phone',
    c.data->'properties'->>'mobilephone',
    c.data->'properties'->>'hs_whatsapp_phone_number'
  FROM hs_contacts c
  WHERE EXISTS (
    SELECT 1 FROM unnest(p_phones) AS input_phone
    WHERE
      RIGHT(regexp_replace(COALESCE(c.data->'properties'->>'phone', ''), '\D', '', 'g'), 10) = RIGHT(input_phone, 10)
      OR RIGHT(regexp_replace(COALESCE(c.data->'properties'->>'mobilephone', ''), '\D', '', 'g'), 10) = RIGHT(input_phone, 10)
      OR RIGHT(regexp_replace(COALESCE(c.data->'properties'->>'hs_whatsapp_phone_number', ''), '\D', '', 'g'), 10) = RIGHT(input_phone, 10)
  );
$$;

GRANT EXECUTE ON FUNCTION get_contacts_by_phones_lean(text[]) TO anon;
