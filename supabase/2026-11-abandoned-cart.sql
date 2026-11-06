-- NEW PHONE: abandoned cart reminder email (registered customers who agreed to marketing email only).
-- Safe to run again.

-- The cart of a signed-in customer, kept so it shows on every device and so a reminder can be sent
create table if not exists public.saved_carts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  reminded_at timestamptz
);
alter table public.saved_carts enable row level security;
drop policy if exists "admins read saved carts" on public.saved_carts;
create policy "admins read saved carts" on public.saved_carts
  for select to authenticated using (public.is_admin());

-- Server-only secrets (no policies: not readable through the API)
create table if not exists public.app_secrets (
  name text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;
insert into public.app_secrets (name, value)
values ('cron', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (name) do nothing;

create or replace function public.save_my_cart(p_items jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_items jsonb := coalesce(p_items, '[]'::jsonb);
begin
  if v_uid is null or v_email = '' then
    return;
  end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) > 100 or octet_length(v_items::text) > 100000
     or exists (select 1 from jsonb_array_elements(v_items) e where jsonb_typeof(e) <> 'object') then
    raise exception 'invalid cart';
  end if;
  insert into public.saved_carts as c (user_id, email, name, items, updated_at)
  values (v_uid, v_email, auth.jwt() -> 'user_metadata' ->> 'full_name', v_items, now())
  on conflict (user_id) do update
    set items = excluded.items,
        email = excluded.email,
        name = coalesce(excluded.name, c.name),
        -- the reminder clock restarts only when the cart actually changed
        updated_at = case when c.items is distinct from excluded.items then now() else c.updated_at end;
end;
$$;
revoke all on function public.save_my_cart(jsonb) from public;
grant execute on function public.save_my_cart(jsonb) to authenticated;

create or replace function public.get_my_cart()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select c.items from public.saved_carts c where c.user_id = auth.uid() and c.updated_at > now() - interval '30 days'), '[]'::jsonb);
$$;
revoke all on function public.get_my_cart() from public;
grant execute on function public.get_my_cart() to authenticated;

-- Called once a day by the site's scheduled job (with the secret). Returns carts to remind and marks them,
-- so each cart gets at most one reminder: idle 3 hours to 7 days, customer agreed to marketing email,
-- and no order from that customer since the cart changed.
create or replace function public.claim_abandoned_carts(p_secret text)
returns table (email text, name text, items jsonb, unsubscribe_token uuid)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- null-safe: a missing secret row (or a missing argument) must never let the call through
  if p_secret is null or p_secret is distinct from (select s.value from public.app_secrets s where s.name = 'cron') then
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
