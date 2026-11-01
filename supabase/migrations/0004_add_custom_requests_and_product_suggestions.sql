-- Migration: 0004_add_custom_requests_and_product_suggestions.sql
-- Additive migration for Feature B (Custom Automation Requests) and Feature C (Customer Product Suggestions & Demand Validation)

-- 1. Create custom_automation_requests Table
CREATE TABLE IF NOT EXISTS public.custom_automation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT DEFAULT '',
  email TEXT NOT NULL CHECK (email <> ''),
  whatsapp_number TEXT DEFAULT '',
  business_type TEXT NOT NULL CHECK (business_type <> ''),
  business_problem TEXT NOT NULL CHECK (business_problem <> ''),
  desired_outcome TEXT NOT NULL CHECK (desired_outcome <> ''),
  current_tools TEXT[] DEFAULT '{}',
  expected_features TEXT DEFAULT '',
  budget_range TEXT DEFAULT '',
  delivery_timeframe TEXT DEFAULT '',
  additional_notes TEXT DEFAULT '',
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'new' CHECK (
    status IN ('new', 'reviewing', 'needs_clarification', 'quoted', 'accepted', 'rejected', 'completed')
  ),
  estimated_quote_egp NUMERIC(10,2) DEFAULT NULL CHECK (estimated_quote_egp IS NULL OR estimated_quote_egp >= 0),
  admin_notes TEXT DEFAULT '',
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_custom_automation_requests_updated_at ON public.custom_automation_requests;
CREATE TRIGGER set_custom_automation_requests_updated_at
BEFORE UPDATE ON public.custom_automation_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_custom_requests_status ON public.custom_automation_requests(status);
CREATE INDEX IF NOT EXISTS idx_custom_requests_email ON public.custom_automation_requests(email);
CREATE INDEX IF NOT EXISTS idx_custom_requests_created_at ON public.custom_automation_requests(created_at DESC);

ALTER TABLE public.custom_automation_requests ENABLE ROW LEVEL SECURITY;

-- Public can submit a custom automation request, but NEVER read, update, or delete requests
DROP POLICY IF EXISTS "Public custom requests insert" ON public.custom_automation_requests;
CREATE POLICY "Public custom requests insert" ON public.custom_automation_requests
  FOR INSERT WITH CHECK (
    email <> '' AND business_type <> '' AND business_problem <> '' AND desired_outcome <> ''
  );

-- Only authenticated admins can view, update, or delete custom automation requests
DROP POLICY IF EXISTS "Admin custom requests select" ON public.custom_automation_requests;
CREATE POLICY "Admin custom requests select" ON public.custom_automation_requests
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admin custom requests update" ON public.custom_automation_requests;
CREATE POLICY "Admin custom requests update" ON public.custom_automation_requests
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admin custom requests delete" ON public.custom_automation_requests;
CREATE POLICY "Admin custom requests delete" ON public.custom_automation_requests
  FOR DELETE USING (public.is_admin());


-- 2. Create product_suggestions Table
CREATE TABLE IF NOT EXISTS public.product_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_name TEXT NOT NULL CHECK (proposed_name <> ''),
  problem_solved TEXT NOT NULL CHECK (problem_solved <> ''),
  target_audience TEXT NOT NULL CHECK (target_audience <> ''),
  expected_features TEXT DEFAULT '',
  platforms_integrations TEXT[] DEFAULT '{}',
  email TEXT DEFAULT '',
  whatsapp_number TEXT DEFAULT '',
  purchase_likelihood TEXT NOT NULL CHECK (
    purchase_likelihood IN ('very_likely', 'likely', 'not_sure', 'unlikely')
  ),
  preferred_price_range TEXT DEFAULT '',
  additional_context TEXT DEFAULT '',
  contact_consent BOOLEAN NOT NULL DEFAULT false,
  fingerprint_hash TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'under_review' CHECK (
    status IN ('under_review', 'planned', 'converted_coming_soon', 'rejected')
  ),
  converted_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  admin_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_product_suggestions_updated_at ON public.product_suggestions;
CREATE TRIGGER set_product_suggestions_updated_at
BEFORE UPDATE ON public.product_suggestions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_product_suggestions_status ON public.product_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_product_suggestions_likelihood ON public.product_suggestions(purchase_likelihood);
CREATE INDEX IF NOT EXISTS idx_product_suggestions_fingerprint ON public.product_suggestions(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_product_suggestions_created_at ON public.product_suggestions(created_at DESC);

ALTER TABLE public.product_suggestions ENABLE ROW LEVEL SECURITY;

-- Public can submit a product suggestion, but NEVER read private submissions or contact details
DROP POLICY IF EXISTS "Public product suggestions insert" ON public.product_suggestions;
CREATE POLICY "Public product suggestions insert" ON public.product_suggestions
  FOR INSERT WITH CHECK (
    proposed_name <> '' AND problem_solved <> '' AND target_audience <> ''
  );

-- Only authenticated admins can view, update, or delete product suggestions
DROP POLICY IF EXISTS "Admin product suggestions select" ON public.product_suggestions;
CREATE POLICY "Admin product suggestions select" ON public.product_suggestions
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admin product suggestions update" ON public.product_suggestions;
CREATE POLICY "Admin product suggestions update" ON public.product_suggestions
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admin product suggestions delete" ON public.product_suggestions;
CREATE POLICY "Admin product suggestions delete" ON public.product_suggestions
  FOR DELETE USING (public.is_admin());
