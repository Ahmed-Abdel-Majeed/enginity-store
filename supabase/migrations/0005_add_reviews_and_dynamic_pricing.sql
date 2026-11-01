-- Migration: 0005_add_reviews_and_dynamic_pricing.sql
-- Additive migration for Product Ratings & Customer Reviews + Dynamic Pricing (Original Price, Sale Price, Automatic Discount)

-- 1. Add Dynamic Pricing Columns to public.products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS original_price_egp NUMERIC(10,2) DEFAULT NULL CHECK (original_price_egp IS NULL OR original_price_egp >= 0),
  ADD COLUMN IF NOT EXISTS sale_price_egp NUMERIC(10,2) DEFAULT NULL CHECK (sale_price_egp IS NULL OR sale_price_egp >= 0);

-- Ensure sale_price_egp is strictly less than original_price_egp when both are present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_sale_less_than_original_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_sale_less_than_original_check
      CHECK (
        sale_price_egp IS NULL
        OR original_price_egp IS NULL
        OR sale_price_egp < original_price_egp
      );
  END IF;
END $$;

-- Backfill original_price_egp with price_egp for existing products where original_price_egp is null
UPDATE public.products
SET original_price_egp = price_egp
WHERE original_price_egp IS NULL;

-- 2. Create public.product_reviews Table
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL CHECK (char_length(trim(customer_name)) BETWEEN 2 AND 100),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT DEFAULT NULL CHECK (review_text IS NULL OR char_length(review_text) <= 2000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_product_reviews_updated_at ON public.product_reviews;
CREATE TRIGGER set_product_reviews_updated_at
BEFORE UPDATE ON public.product_reviews
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for fast product review lookups and admin moderation filtering
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_status
  ON public.product_reviews(product_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_reviews_status_created
  ON public.product_reviews(status, created_at DESC);

-- 3. Row Level Security (RLS) Policies for public.product_reviews
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- Public users can read ONLY approved reviews
DROP POLICY IF EXISTS "Public approved product reviews read" ON public.product_reviews;
CREATE POLICY "Public approved product reviews read" ON public.product_reviews
  FOR SELECT USING (status = 'approved');

-- Public users can insert new reviews ONLY with status = 'pending' and valid rating/name
DROP POLICY IF EXISTS "Public product reviews insert pending" ON public.product_reviews;
CREATE POLICY "Public product reviews insert pending" ON public.product_reviews
  FOR INSERT WITH CHECK (
    status = 'pending'
    AND rating >= 1
    AND rating <= 5
    AND char_length(trim(customer_name)) BETWEEN 2 AND 100
    AND (review_text IS NULL OR char_length(review_text) <= 2000)
  );

-- Authenticated admins can read all reviews (pending, approved, rejected)
DROP POLICY IF EXISTS "Admin product reviews select" ON public.product_reviews;
CREATE POLICY "Admin product reviews select" ON public.product_reviews
  FOR SELECT USING (public.is_admin());

-- Authenticated admins can update review status or moderate reviews
DROP POLICY IF EXISTS "Admin product reviews update" ON public.product_reviews;
CREATE POLICY "Admin product reviews update" ON public.product_reviews
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Authenticated admins can delete reviews
DROP POLICY IF EXISTS "Admin product reviews delete" ON public.product_reviews;
CREATE POLICY "Admin product reviews delete" ON public.product_reviews
  FOR DELETE USING (public.is_admin());
