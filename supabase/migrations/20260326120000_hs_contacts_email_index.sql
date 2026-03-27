-- Add indexed email column to hs_contacts to eliminate expensive JSONB path scans
ALTER TABLE hs_contacts ADD COLUMN IF NOT EXISTS email TEXT;

UPDATE hs_contacts SET email = lower(trim(data->'properties'->>'email'))
  WHERE data->'properties'->>'email' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hs_contacts_email ON hs_contacts(email);
