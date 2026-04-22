-- Cache tables for PostHog-sourced engagement KPIs (WhatsApp conectado, Productos creados)
-- Matched to leads by phone_number, same pattern as mb_activated_phones.

CREATE TABLE IF NOT EXISTS public.mb_whatsapp_connected_phones (
  phone_number text PRIMARY KEY,
  connected_at timestamptz NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mb_whatsapp_connected_phones_connected_at
  ON public.mb_whatsapp_connected_phones(connected_at);

ALTER TABLE public.mb_whatsapp_connected_phones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mb_whatsapp_connected_phones_read" ON public.mb_whatsapp_connected_phones;
CREATE POLICY "mb_whatsapp_connected_phones_read"
  ON public.mb_whatsapp_connected_phones
  FOR SELECT
  USING (true);


CREATE TABLE IF NOT EXISTS public.mb_products_created_phones (
  phone_number text PRIMARY KEY,
  created_at timestamptz NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mb_products_created_phones_created_at
  ON public.mb_products_created_phones(created_at);

ALTER TABLE public.mb_products_created_phones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mb_products_created_phones_read" ON public.mb_products_created_phones;
CREATE POLICY "mb_products_created_phones_read"
  ON public.mb_products_created_phones
  FOR SELECT
  USING (true);
