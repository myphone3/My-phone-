-- NEW PHONE: one admin screen for customers and email ("לקוחות ומיילים").
-- On/off switches for the automatic emails, abandoned carts list with "send reminder now",
-- marketing email to customers who agreed (each with its own unsubscribe link), and a short send log.
-- Safe to run again.

-- 1) On/off switches (settings row)
alter table public.settings add column if not exists abandoned_cart_enabled boolean not null default true;
alter table public.settings add column if not exists review_requests_enabled boolean not null default true;

-- 2) Short log of emails sent from the admin screen
create table if not exists public.email_log (
  id bigint generated always as identity primary key,
  sent_at timestamptz not null default now(),
  kind text not null,              -- 'campaign' | 'cart' | 'personal' | 'test'
  subject text,
  recipients int not null default 0,
  failed int not null default 0
);
alter table public.email_log enable row level security;
drop policy if exists "admins read email log" on public.email_log;
create policy "admins read email log" on public.email_log for select to authenticated using (public.is_admin());
drop policy if exists "admins write email log" on public.email_log;
create policy "admins write email log" on public.email_log for insert to authenticated with check (public.is_admin());

-- 3) The daily jobs respect the switches
create or replace function public.claim_abandoned_carts(p_secret text)
returns table (email text, name text, items jsonb, unsubscribe_token uuid)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_secret is null or p_secret is distinct from (select s.value from public.app_secrets s where s.name = 'cron') then
    return;
  end if;
  if not coalesce((select st.abandoned_cart_enabled from public.settings st order by st.id limit 1), true) then
    return;
  end if;
  return query
  with due as (
    select c.user_id
      from public.saved_carts c
      join public.marketing_consents m on m.user_id = c.user_id and m.consent
     where jsonb_array_length(c.items) > 0
       and c.updated_at < now() - interval '3 hours'
       and c.updated_at > now() - interval '7 days'
       and (c.reminded_at is null or c.reminded_at < c.updated_at)
       and not exists (select 1 from public.orders o where lower(o.email) = c.email and o.created_at > c.updated_at)
     limit 200
     for update of c skip locked
  ),
  marked as (
    update public.saved_carts c set reminded_at = now()
      from due where c.user_id = due.user_id
    returning c.user_id, c.email, c.name, c.items
  )
  select marked.email, marked.name, marked.items, m.unsubscribe_token
    from marked
    join public.marketing_consents m on m.user_id = marked.user_id;
end;
$$;
revoke all on function public.claim_abandoned_carts(text) from public;
grant execute on function public.claim_abandoned_carts(text) to anon, authenticated;

create or replace function public.claim_review_requests(p_secret text)
returns table (id uuid, name text, email text)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_secret is null or p_secret is distinct from (select s.value from public.app_secrets s where s.name = 'cron') then
    return;
  end if;
  if not coalesce((select st.review_requests_enabled from public.settings st order by st.id limit 1), true) then
    return;
  end if;
  return query
  with due as (
    select o.id from public.orders o
     where o.review_requested_at is null
       and coalesce(o.email, '') like '%@%'
       and o.created_at > now() - interval '60 days'
       and ((o.status = 'הושלם' and o.completed_at < now() - interval '1 day')
         or (o.status = 'נשלח' and o.shipped_at < now() - interval '5 days'))
     limit 100
     for update skip locked
  )
  update public.orders o set review_requested_at = now()
    from due where o.id = due.id
  returning o.id, coalesce(o.customer_name, ''), lower(o.email);
end;
$$;
revoke all on function public.claim_review_requests(text) from public;
grant execute on function public.claim_review_requests(text) to anon, authenticated;

-- 4) Customers: registered customers and also people who ordered without registering
create or replace function public.admin_list_customers()
returns table (user_id uuid, email text, name text, phone text, registered boolean, signed_up_at timestamptz,
               first_order_at timestamptz, orders_count bigint, consent boolean, consented_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    return;
  end if;
  return query
  with reg as (
    select u.id, lower(u.email) as email, u.raw_user_meta_data ->> 'full_name' as name, u.created_at
      from auth.users u
     where u.email is not null
  ),
  ord as (
    select lower(o.email) as email,
           (array_agg(o.customer_name order by o.created_at desc))[1] as name,
           (array_agg(coalesce(o.phone, o.customer_phone) order by o.created_at desc))[1] as phone,
           count(*) filter (where o.status is distinct from 'מבוטל') as orders_count,
           min(o.created_at) as first_order_at
      from public.orders o
     where coalesce(o.email, '') like '%@%'
     group by lower(o.email)
  )
  select reg.id,
         coalesce(reg.email, ord.email),
         coalesce(reg.name, ord.name),
         ord.phone,
         reg.id is not null,
         reg.created_at,
         ord.first_order_at,
         coalesce(ord.orders_count, 0),
         coalesce(m.consent, false),
         m.consented_at
    from reg
    full join ord on ord.email = reg.email
    left join public.marketing_consents m on m.user_id = reg.id
   order by coalesce(reg.created_at, ord.first_order_at) desc nulls last, coalesce(reg.email, ord.email);
end;
$$;
revoke all on function public.admin_list_customers() from public;
grant execute on function public.admin_list_customers() to authenticated;

-- 5) Carts that were not completed (signed-in customers)
create or replace function public.admin_list_saved_carts()
returns table (user_id uuid, email text, name text, items jsonb, updated_at timestamptz, reminded_at timestamptz,
               consent boolean, ordered_since boolean)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    return;
  end if;
  return query
  select c.user_id, c.email, c.name, c.items, c.updated_at, c.reminded_at,
         coalesce(m.consent, false),
         exists (select 1 from public.orders o where lower(o.email) = c.email and o.created_at > c.updated_at)
    from public.saved_carts c
    left join public.marketing_consents m on m.user_id = c.user_id
   where jsonb_array_length(c.items) > 0
     and c.updated_at > now() - interval '30 days'
   order by c.updated_at desc;
end;
$$;
revoke all on function public.admin_list_saved_carts() from public;
grant execute on function public.admin_list_saved_carts() to authenticated;

-- 6) "Send reminder now" for one cart (only if the customer agreed to marketing email)
create or replace function public.admin_cart_for_reminder(p_user_id uuid)
returns table (email text, name text, items jsonb, unsubscribe_token uuid)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    return;
  end if;
  return query
  with marked as (
    update public.saved_carts c set reminded_at = now()
     where c.user_id = p_user_id
       and jsonb_array_length(c.items) > 0
       and exists (select 1 from public.marketing_consents m where m.user_id = c.user_id and m.consent)
    returning c.user_id, c.email, c.name, c.items
  )
  select marked.email, marked.name, marked.items, m.unsubscribe_token
    from marked
    join public.marketing_consents m on m.user_id = marked.user_id;
end;
$$;
revoke all on function public.admin_cart_for_reminder(uuid) from public;
grant execute on function public.admin_cart_for_reminder(uuid) to authenticated;

-- 7) Who may receive a marketing email: only customers who agreed (optionally only the chosen ones)
create or replace function public.admin_marketing_recipients(p_user_ids uuid[] default null)
returns table (email text, name text, unsubscribe_token uuid)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    return;
  end if;
  return query
  select lower(coalesce(m.email, u.email)), coalesce(m.name, u.raw_user_meta_data ->> 'full_name'), m.unsubscribe_token
    from public.marketing_consents m
    join auth.users u on u.id = m.user_id
   where m.consent
     and coalesce(m.email, u.email) like '%@%'
     and (p_user_ids is null or m.user_id = any (p_user_ids));
end;
$$;
revoke all on function public.admin_marketing_recipients(uuid[]) from public;
grant execute on function public.admin_marketing_recipients(uuid[]) to authenticated;
