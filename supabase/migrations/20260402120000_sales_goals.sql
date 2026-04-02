-- Monthly sales goals per salesperson (by HubSpot owner ID)
-- Used to track deal count and revenue targets vs actuals

CREATE TABLE IF NOT EXISTS sales_goals (
  id SERIAL PRIMARY KEY,
  month TEXT NOT NULL,              -- format "YYYY-MM"
  owner_id TEXT NOT NULL,           -- HubSpot owner ID
  owner_name TEXT,                  -- display name for convenience
  deals_goal INTEGER DEFAULT 0,    -- target number of deals won
  revenue_goal NUMERIC DEFAULT 0,  -- target revenue
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- One goal row per owner per month; enables upsert on (month, owner_id)
ALTER TABLE sales_goals
  ADD CONSTRAINT sales_goals_month_owner_unique UNIQUE (month, owner_id);

-- Index for the most common query pattern: filter by month
CREATE INDEX IF NOT EXISTS idx_sales_goals_month ON sales_goals(month);

-- RLS: permissive access for dashboard (anon + authenticated can read/write)
ALTER TABLE sales_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select"  ON sales_goals FOR SELECT TO anon          USING (true);
CREATE POLICY "anon_insert"  ON sales_goals FOR INSERT TO anon          WITH CHECK (true);
CREATE POLICY "anon_update"  ON sales_goals FOR UPDATE TO anon          USING (true) WITH CHECK (true);
CREATE POLICY "auth_select"  ON sales_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert"  ON sales_goals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update"  ON sales_goals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service_all"  ON sales_goals FOR ALL    TO service_role  USING (true) WITH CHECK (true);
