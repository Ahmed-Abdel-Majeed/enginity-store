-- ==========================================
-- 0009_harden_public_submissions.sql
-- Add database constraints, deduplication, and validation for public forms (TASK-007)
-- ==========================================

-- 1. Deduplicate any existing duplicate (product_id, lower(email)) rows in product_waitlist
delete from public.product_waitlist a
using public.product_waitlist b
where a.id > b.id
  and a.product_id = b.product_id
  and trim(a.email) <> ''
  and lower(trim(a.email)) = lower(trim(b.email));

-- Create case-insensitive unique index on (product_id, lower(email)) where email is provided
create unique index if not exists idx_waitlist_product_email
on public.product_waitlist (product_id, lower(email))
where email <> '';

-- 2. Add length and format constraints on product_waitlist
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'waitlist_email_length_check'
  ) then
    alter table public.product_waitlist
      add constraint waitlist_email_length_check
      check (email = '' or char_length(trim(email)) between 5 and 254);
  end if;
end $$;

-- 3. Add length constraints on custom_automation_requests (matching 0004 column names: name, business_problem, desired_outcome)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'custom_requests_name_length_check'
  ) then
    alter table public.custom_automation_requests
      add constraint custom_requests_name_length_check
      check (char_length(trim(name)) <= 120);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'custom_requests_problem_length_check'
  ) then
    alter table public.custom_automation_requests
      add constraint custom_requests_problem_length_check
      check (char_length(trim(business_problem)) between 3 and 2000);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'custom_requests_outcome_length_check'
  ) then
    alter table public.custom_automation_requests
      add constraint custom_requests_outcome_length_check
      check (char_length(trim(desired_outcome)) between 3 and 2000);
  end if;
end $$;

-- 4. Add length constraints on product_suggestions
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'product_suggestions_name_length_check'
  ) then
    alter table public.product_suggestions
      add constraint product_suggestions_name_length_check
      check (char_length(trim(proposed_name)) between 2 and 200);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'product_suggestions_problem_length_check'
  ) then
    alter table public.product_suggestions
      add constraint product_suggestions_problem_length_check
      check (char_length(trim(problem_solved)) between 5 and 3000);
  end if;
end $$;

-- 5. Add length constraints on product_reviews
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'product_reviews_name_length_check'
  ) then
    alter table public.product_reviews
      add constraint product_reviews_name_length_check
      check (char_length(trim(customer_name)) between 2 and 100);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'product_reviews_text_length_check'
  ) then
    alter table public.product_reviews
      add constraint product_reviews_text_length_check
      check (review_text is null or char_length(trim(review_text)) between 3 and 2000);
  end if;
end $$;
