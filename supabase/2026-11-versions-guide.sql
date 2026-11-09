-- NEW PHONE: version explanations (editable in the admin "גרסאות" screen) and real interest numbers on the product page.
-- Run AFTER 2026-11-analytics.sql. Safe to run again.

-- 1) What each version includes
alter table public.versions add column if not exists description text;
alter table public.versions add column if not exists features jsonb not null default '{}'::jsonb;

-- 2) How many people looked at / added a product in the last 24 hours (numbers only, no personal data).
--    Small numbers are hidden (returned as 0) so the page never shows "1 person is looking".
create or replace function public.product_interest(p_product uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'viewers', case when x.viewers >= 3 then x.viewers else 0 end,
    'carts', case when x.carts >= 2 then x.carts else 0 end
  )
  from (
    select count(distinct visitor_id) filter (where type = 'product_view') as viewers,
           count(distinct visitor_id) filter (where type = 'add_to_cart') as carts
      from public.analytics_events
     where product_id = p_product and created_at > now() - interval '24 hours'
  ) x
$$;
revoke all on function public.product_interest(uuid) from public;
grant execute on function public.product_interest(uuid) to anon, authenticated;
