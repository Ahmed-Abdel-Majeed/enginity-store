-- ==========================================
-- 0006_protect_product_deliverables.sql
-- Restrict public exposure of paid deliverable URLs (file_url)
-- and internal admin notes on public.products (TASK-001)
-- ==========================================

-- 1. Create a dedicated admin/fulfillment table for paid deliverable assets & internal notes
create table if not exists public.product_deliverables (
  product_id uuid primary key references public.products(id) on delete cascade,
  file_url text not null default '',
  admin_notes text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.product_deliverables
  add column if not exists admin_notes text not null default '';

-- 2. Migrate any existing file_url / admin_notes values from public.products into public.product_deliverables
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'file_url'
  ) then
    insert into public.product_deliverables (product_id, file_url, admin_notes, updated_at)
    select id, coalesce(file_url, ''), coalesce(admin_notes, ''), coalesce(updated_at, now())
    from public.products
    where coalesce(file_url, '') <> '' or coalesce(admin_notes, '') <> ''
    on conflict (product_id) do update
      set file_url = case when excluded.file_url <> '' then excluded.file_url else public.product_deliverables.file_url end,
          admin_notes = case when excluded.admin_notes <> '' then excluded.admin_notes else public.product_deliverables.admin_notes end,
          updated_at = excluded.updated_at;

    -- Nullify/clear file_url on public.products so anon SELECT never receives paid asset URLs
    alter table public.products alter column file_url drop not null;
    alter table public.products alter column file_url set default null;
    update public.products set file_url = null where file_url is not null;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'admin_notes'
  ) then
    insert into public.product_deliverables (product_id, file_url, admin_notes, updated_at)
    select id, '', coalesce(admin_notes, ''), coalesce(updated_at, now())
    from public.products
    where coalesce(admin_notes, '') <> ''
    on conflict (product_id) do update
      set admin_notes = excluded.admin_notes,
          updated_at = excluded.updated_at;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'admin_notes'
  ) then
    update public.products set admin_notes = '' where coalesce(admin_notes, '') <> '';
  end if;
end $$;

-- 3. Enable strict Row Level Security on public.product_deliverables
alter table public.product_deliverables enable row level security;

revoke all on public.product_deliverables from anon;

drop policy if exists "Admins can view product deliverables" on public.product_deliverables;
create policy "Admins can view product deliverables"
on public.product_deliverables for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert product deliverables" on public.product_deliverables;
create policy "Admins can insert product deliverables"
on public.product_deliverables for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update product deliverables" on public.product_deliverables;
create policy "Admins can update product deliverables"
on public.product_deliverables for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete product deliverables" on public.product_deliverables;
create policy "Admins can delete product deliverables"
on public.product_deliverables for delete
to authenticated
using (public.is_admin());

-- 4. Create a safe public catalog view excluding file_url and admin_notes
create or replace view public.public_catalog_products as
select
  id,
  slug,
  status,
  category_id,
  name_ar,
  name_en,
  short_ar,
  short_en,
  description_ar,
  description_en,
  price_egp,
  original_price_egp,
  sale_price_egp,
  xpay_url,
  cover_path,
  diagram_path,
  video_url,
  tools,
  level,
  includes_ar,
  includes_en,
  requirements_ar,
  requirements_en,
  steps_ar,
  steps_en,
  faq,
  sort_order,
  expected_launch_date,
  launch_announcement,
  waitlist_enabled,
  created_at,
  updated_at
from public.products
where status in ('published', 'coming_soon');
