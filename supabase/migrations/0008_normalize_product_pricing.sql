-- ==========================================
-- 0008_normalize_product_pricing.sql
-- Normalize product pricing source of truth in PostgreSQL (TASK-004)
-- ==========================================

alter table public.products
  add column if not exists original_price_egp numeric,
  add column if not exists sale_price_egp numeric,
  add column if not exists discount_percentage integer not null default 0;

-- 1. Backfill original_price_egp where null or <= 0
update public.products
set original_price_egp = price_egp
where original_price_egp is null or original_price_egp <= 0;

-- 2. Clear invalid sale_price_egp values
update public.products
set sale_price_egp = null
where sale_price_egp is not null
  and (sale_price_egp <= 0 or sale_price_egp >= original_price_egp);

-- 3. Create or replace canonical pricing trigger function
create or replace function public.sync_product_pricing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ensure original_price_egp is populated from price_egp if omitted
  if new.original_price_egp is null or new.original_price_egp <= 0 then
    new.original_price_egp := greatest(coalesce(new.price_egp, 0), 0);
  end if;

  -- Validate sale_price_egp and calculate discount_percentage + canonical price_egp
  if new.sale_price_egp is not null and new.sale_price_egp > 0 then
    if new.sale_price_egp >= new.original_price_egp then
      raise exception 'sale_price_egp (%) must be strictly less than original_price_egp (%)',
        new.sale_price_egp, new.original_price_egp;
    end if;

    new.price_egp := new.sale_price_egp;
    new.discount_percentage := round(
      ((new.original_price_egp - new.sale_price_egp)::numeric / new.original_price_egp::numeric) * 100
    )::integer;
  else
    new.sale_price_egp := null;
    new.price_egp := new.original_price_egp;
    new.discount_percentage := 0;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_product_pricing on public.products;
create trigger trg_sync_product_pricing
before insert or update of price_egp, original_price_egp, sale_price_egp
on public.products
for each row
execute function public.sync_product_pricing();

-- 4. Touch all existing rows so price_egp and discount_percentage are synchronized
update public.products
set original_price_egp = coalesce(original_price_egp, price_egp);

-- 5. Strip any legacy <!--ENGINITY_PRICING:...--> HTML comment metadata from admin_notes
update public.products
set admin_notes = trim(regexp_replace(admin_notes, '<!--ENGINITY_PRICING:\{[\s\S]*?\}-->', '', 'g'))
where admin_notes like '%<!--ENGINITY_PRICING:%';
