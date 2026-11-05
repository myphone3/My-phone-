-- NEW PHONE: marketing email consent (spam law). Customers opt in at signup and can opt out any time.
-- Safe to run again.

create table if not exists public.marketing_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  consent boolean not null default false,
  consented_at timestamptz,
  updated_at timestamptz not null default now(),
  unsubscribe_token uuid not null default gen_random_uuid() unique
);
alter table public.marketing_consents enable row level security;
drop policy if exists "admins read consents" on public.marketing_consents;
create policy "admins read consents" on public.marketing_consents
  for select to authenticated using (public.is_admin());

-- Every change is kept, as proof of when consent was given or withdrawn
create table if not exists public.marketing_consent_log (
  id bigint generated always as identity primary key,
  user_id uuid,
  email text,
  consent boolean not null,
  source text not null,
  created_at timestamptz not null default now()
);
alter table public.marketing_consent_log enable row level security;
drop policy if exists "admins read consent log" on public.marketing_consent_log;
create policy "admins read consent log" on public.marketing_consent_log
  for select to authenticated using (public.is_admin());

-- The signed-in customer sets their own choice (signup window or personal menu)
create or replace function public.set_my_marketing_consent(p_consent boolean, p_source text default 'menu')
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_name text := auth.jwt() -> 'user_metadata' ->> 'full_name';
  v_source text := case when p_source in ('signup', 'menu') then p_source else 'menu' end;
begin
  if v_uid is null or v_email = '' then
    return false;
  end if;
  insert into public.marketing_consents as m (user_id, email, name, consent, consented_at, updated_at)
  values (v_uid, v_email, v_name, p_consent, case when p_consent then now() end, now())
  on conflict (user_id) do update
    set consent = excluded.consent,
        email = excluded.email,
        name = coalesce(excluded.name, m.name),
        consented_at = case when excluded.consent then now() else m.consented_at end,
        updated_at = now();
  insert into public.marketing_consent_log (user_id, email, consent, source) values (v_uid, v_email, p_consent, v_source);
  return p_consent;
end;
$$;
revoke all on function public.set_my_marketing_consent(boolean, text) from public;
grant execute on function public.set_my_marketing_consent(boolean, text) to authenticated;

create or replace function public.get_my_marketing_consent()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select m.consent from public.marketing_consents m where m.user_id = auth.uid()), false);
$$;
revoke all on function public.get_my_marketing_consent() from public;
grant execute on function public.get_my_marketing_consent() to authenticated;

-- Unsubscribe link in emails (works without signing in)
create or replace function public.unsubscribe_marketing(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row public.marketing_consents;
begin
  update public.marketing_consents
     set consent = false, updated_at = now()
   where unsubscribe_token = p_token
  returning * into v_row;
  if v_row.user_id is null then
    return false;
  end if;
  insert into public.marketing_consent_log (user_id, email, consent, source) values (v_row.user_id, v_row.email, false, 'email_link');
  return true;
end;
$$;
revoke all on function public.unsubscribe_marketing(uuid) from public;
grant execute on function public.unsubscribe_marketing(uuid) to anon, authenticated;

-- Admin removes a customer from the list (e.g. asked by phone)
create or replace function public.admin_unsubscribe_marketing(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email text;
begin
  if not public.is_admin() then
    return false;
  end if;
  update public.marketing_consents
     set consent = false, updated_at = now()
   where user_id = p_user_id
  returning email into v_email;
  if v_email is null then
    return false;
  end if;
  insert into public.marketing_consent_log (user_id, email, consent, source) values (p_user_id, v_email, false, 'admin');
  return true;
end;
$$;
revoke all on function public.admin_unsubscribe_marketing(uuid) from public;
grant execute on function public.admin_unsubscribe_marketing(uuid) to authenticated;

-- Customers screen in the admin panel: registered customers and customers who only ordered,
-- with signup date, number of orders and mailing consent
create or replace function public.admin_list_customers()
returns table (
  user_id uuid,
  email text,
  name text,
  phone text,
  registered boolean,
  signed_up_at timestamptz,
  first_order_at timestamptz,
  orders_count bigint,
  consent boolean,
  consented_at timestamptz
)
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
     where coalesce(o.email, '') <> ''
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
   order by coalesce(reg.created_at, ord.first_order_at) desc;
end;
$$;
revoke all on function public.admin_list_customers() from public;
grant execute on function public.admin_list_customers() to authenticated;
