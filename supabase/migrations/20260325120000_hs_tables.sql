-- HubSpot sync tables for real-time webhook + incremental sync architecture
-- Browser reads from these tables instead of paginating HubSpot API directly

CREATE TABLE IF NOT EXISTS hs_meetings (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  hs_createdate TIMESTAMPTZ,
  hubspot_owner_id TEXT,
  synced_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hs_meetings_createdate ON hs_meetings(hs_createdate);

CREATE TABLE IF NOT EXISTS hs_contacts (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hs_deals (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  pipeline TEXT,
  createdate TIMESTAMPTZ,
  hubspot_owner_id TEXT,
  synced_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hs_deals_pipeline ON hs_deals(pipeline);
CREATE INDEX IF NOT EXISTS idx_hs_deals_createdate ON hs_deals(createdate);

CREATE TABLE IF NOT EXISTS hs_leads (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  hs_pipeline TEXT,
  hs_createdate TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hs_leads_pipeline ON hs_leads(hs_pipeline);

CREATE TABLE IF NOT EXISTS hs_owners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  synced_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hs_pipelines (
  id TEXT PRIMARY KEY DEFAULT 'deals',
  data JSONB NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hs_sync_log (
  id SERIAL PRIMARY KEY,
  sync_type TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',
  details JSONB
);

-- RLS: browser (anon) can only read
ALTER TABLE hs_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hs_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hs_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE hs_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE hs_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE hs_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE hs_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read" ON hs_meetings FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON hs_contacts FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON hs_deals FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON hs_leads FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON hs_owners FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON hs_pipelines FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read" ON hs_sync_log FOR SELECT TO anon USING (true);

-- Service role (edge functions) gets full access via default policies
CREATE POLICY "service_all" ON hs_meetings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON hs_contacts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON hs_deals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON hs_leads FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON hs_owners FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON hs_pipelines FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON hs_sync_log FOR ALL TO service_role USING (true) WITH CHECK (true);
