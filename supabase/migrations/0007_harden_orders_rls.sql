-- ==========================================
-- 0007_harden_orders_rls.sql
-- Create and harden public.orders table, constraints, and RLS policies (TASK-003)
-- ==========================================

-- 1. Create public.orders table if it does not already exist
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null default '',
  customer_whatsapp text not null default '',
  amount_egp numeric(10,2) not null check (amount_egp > 0),
  original_price_egp numeric(10,2),
  sale_price_egp numeric(10,2),
  discount_percentage integer not null default 0,
  currency text not null default 'EGP',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  xpay_transaction_id text,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure columns exist if table was created by an earlier script
alter table public.orders
  add column if not exists customer_whatsapp text not null default '',
  add column if not exists original_price_egp numeric(10,2),
  add column if not exists sale_price_egp numeric(10,2),
  add column if not exists discount_percentage integer not null default 0,
  add column if not exists currency text not null default 'EGP',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists fulfilled_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_status_valid_check'
  ) then
    alter table public.orders
      add constraint orders_status_valid_check
      check (status in ('pending', 'paid', 'failed', 'refunded'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'orders_amount_positive_check'
  ) then
    alter table public.orders
      add constraint orders_amount_positive_check
      check (amount_egp > 0);
  end if;
end $$;

create index if not exists idx_orders_product_id on public.orders(product_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_xpay_transaction_id on public.orders(xpay_transaction_id);

-- 2. Replace permissive anonymous INSERT policy on public.orders
alter table public.orders enable row level security;

drop policy if exists "Public can create pending orders" on public.orders;
drop policy if exists "Anon can insert validated pending orders via catalog price" on public.orders;

-- Only allow pending order creation when the product is published and amount_egp matches the canonical catalog price
create policy "Anon can insert validated pending orders via catalog price"
on public.orders for insert
to anon, authenticated
with check (
  status = 'pending'
  and xpay_transaction_id is null
  and fulfilled_at is null
  and length(trim(customer_name)) between 2 and 120
  and customer_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  and exists (
    select 1
    from public.products p
    where p.id = orders.product_id
      and p.status = 'published'
      and orders.amount_egp = coalesce(p.sale_price_egp, p.original_price_egp, p.price_egp)
  )
);

-- Keep SELECT and UPDATE strictly restricted to admins (and service_role which bypasses RLS)
drop policy if exists "Admins can view orders" on public.orders;
create policy "Admins can view orders"
on public.orders for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders"
on public.orders for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
