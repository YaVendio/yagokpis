CREATE TABLE IF NOT EXISTS public.mb_activated_phones (
  phone_number text PRIMARY KEY,
  activated_at timestamptz NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mb_activated_phones_activated_at
  ON public.mb_activated_phones(activated_at);

ALTER TABLE public.mb_activated_phones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mb_activated_phones_read" ON public.mb_activated_phones;
CREATE POLICY "mb_activated_phones_read"
  ON public.mb_activated_phones
  FOR SELECT
  USING (true);
