-- Migration: 0003_add_coming_soon_and_waitlist.sql
-- Additive migration for Coming Soon product status, waitlist registration, and consent tracking

-- 1. Update status check constraint on products table to include 'coming_soon' and 'archived'
ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS products_status_check;

ALTER TABLE public.products
ADD CONSTRAINT products_status_check CHECK (status IN ('draft', 'published', 'coming_soon', 'archived'));

-- 2. Add additive columns to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS expected_launch_date DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS launch_announcement TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS waitlist_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS admin_notes TEXT DEFAULT '';

-- 3. Create product_waitlist Table
CREATE TABLE IF NOT EXISTS public.product_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  email TEXT DEFAULT '',
  whatsapp_number TEXT DEFAULT '',
  email_consent BOOLEAN NOT NULL DEFAULT false,
  whatsapp_consent BOOLEAN NOT NULL DEFAULT false,
  consent_text_ar TEXT DEFAULT '',
  consent_text_en TEXT DEFAULT '',
  consent_timestamp TIMESTAMPTZ DEFAULT NOW(),
  email_status TEXT NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed', 'withdrawn')),
  whatsapp_status TEXT NOT NULL DEFAULT 'pending' CHECK (whatsapp_status IN ('pending', 'sent', 'failed', 'withdrawn')),
  email_attempts INT DEFAULT 0,
  whatsapp_attempts INT DEFAULT 0,
  email_last_attempt TIMESTAMPTZ,
  whatsapp_last_attempt TIMESTAMPTZ,
  email_delivery_time TIMESTAMPTZ,
  whatsapp_delivery_time TIMESTAMPTZ,
  email_provider_id TEXT DEFAULT '',
  whatsapp_provider_id TEXT DEFAULT '',
  last_error TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for product_waitlist updated_at
DROP TRIGGER IF EXISTS set_product_waitlist_updated_at ON public.product_waitlist;
CREATE TRIGGER set_product_waitlist_updated_at
BEFORE UPDATE ON public.product_waitlist
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance & search
CREATE INDEX IF NOT EXISTS idx_product_waitlist_product_id ON public.product_waitlist(product_id);
CREATE INDEX IF NOT EXISTS idx_product_waitlist_email ON public.product_waitlist(email) WHERE email != '';
CREATE INDEX IF NOT EXISTS idx_product_waitlist_whatsapp ON public.product_waitlist(whatsapp_number) WHERE whatsapp_number != '';

-- 4. Update Products RLS Policy
-- Drop previous policy and recreate to allow public read for 'published' AND 'coming_soon'
DROP POLICY IF EXISTS "Public products read published" ON public.products;

CREATE POLICY "Public products read published and coming soon" ON public.products
  FOR SELECT USING (status IN ('published', 'coming_soon') OR public.is_admin());

-- 5. Enable RLS on product_waitlist
ALTER TABLE public.product_waitlist ENABLE ROW LEVEL SECURITY;

-- Anonymous public INSERT policy: can register interest ONLY for coming_soon products with waitlist enabled
CREATE POLICY "Public waitlist insert" ON public.product_waitlist
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND p.status = 'coming_soon'
        AND p.waitlist_enabled = true
    )
    AND (
      (email_consent = true AND email != '') OR
      (whatsapp_consent = true AND whatsapp_number != '')
    )
  );

-- Public CANNOT read waitlist entries (prevents contact data harvesting)
-- Admin can inspect, update, and delete waitlist entries
CREATE POLICY "Admin waitlist select" ON public.product_waitlist
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admin waitlist update" ON public.product_waitlist
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admin waitlist delete" ON public.product_waitlist
  FOR DELETE USING (public.is_admin());
