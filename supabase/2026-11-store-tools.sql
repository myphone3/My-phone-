-- NEW PHONE: tables for product costs, campaign links, reviews and FAQs.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again.

-- 1) Product cost: separate table that only admins can read (products is public)
create table if not exists public.product_costs (
  product_id uuid primary key references public.products(id) on delete cascade,
  cost numeric not null check (cost >= 0),
  updated_at timestamptz not null default now()
);
alter table public.product_costs enable row level security;
drop policy if exists "admins manage product costs" on public.product_costs;
create policy "admins manage product costs" on public.product_costs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 2) Campaign links (?ref=code)
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_-]{1,40}$'),
  name text not null,
  start_date date,
  end_date date,
  budget numeric check (budget is null or budget >= 0),
  created_at timestamptz not null default now()
);
alter table public.campaigns enable row level security;
drop policy if exists "admins manage campaigns" on public.campaigns;
create policy "admins manage campaigns" on public.campaigns
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.campaign_visits (
  id bigint generated always as identity primary key,
  code text not null,
  visited_at timestamptz not null default now()
);
create index if not exists campaign_visits_code_idx on public.campaign_visits (code);
create index if not exists campaign_visits_code_time_idx on public.campaign_visits (code, visited_at);
alter table public.campaign_visits enable row level security;
drop policy if exists "admins read campaign visits" on public.campaign_visits;
create policy "admins read campaign visits" on public.campaign_visits
  for select to authenticated using (public.is_admin());

alter table public.orders add column if not exists ref text;
create index if not exists orders_ref_idx on public.orders (ref) where ref is not null;

-- Count a visit, only for a code that exists.
-- Rate limit: at most 30 visits per code per minute, so repeated direct calls can't inflate the numbers.
create or replace function public.track_campaign_visit(p_code text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_code text := lower(p_code);
begin
  if not exists (select 1 from public.campaigns c where c.code = v_code) then
    return;
  end if;
  -- serialize per code so concurrent calls can't exceed the limit
  perform pg_advisory_xact_lock(hashtext('campaign_visit:' || v_code));
  if (select count(*) from public.campaign_visits v
       where v.code = v_code and v.visited_at > now() - interval '1 minute') >= 30 then
    return;
  end if;
  insert into public.campaign_visits (code) values (v_code);
end;
$$;
revoke all on function public.track_campaign_visit(text) from public;
grant execute on function public.track_campaign_visit(text) to anon, authenticated;

-- Tag a just-placed order with its campaign (needs the order's confirmation token)
create or replace function public.attach_order_ref(p_id uuid, p_token uuid, p_ref text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.orders o
     set ref = lower(p_ref)
   where o.id = p_id
     and o.confirmation_token = p_token
     and o.ref is null
     and o.created_at > now() - interval '30 minutes'
     and exists (select 1 from public.campaigns c where c.code = lower(p_ref));
end;
$$;
revoke all on function public.attach_order_ref(uuid, uuid, text) from public;
grant execute on function public.attach_order_ref(uuid, uuid, text) to anon, authenticated;

-- Visits per campaign, for the admin screen
create or replace function public.campaign_visit_counts()
returns table (code text, visits bigint)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    return;
  end if;
  return query select v.code, count(*)::bigint from public.campaign_visits v group by v.code;
end;
$$;
revoke all on function public.campaign_visit_counts() from public;
grant execute on function public.campaign_visit_counts() to authenticated;

-- 3) Customer reviews (entered by an admin)
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rating int not null check (rating between 1 and 5),
  text text not null,
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.reviews enable row level security;
drop policy if exists "anyone reads active reviews" on public.reviews;
create policy "anyone reads active reviews" on public.reviews
  for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "admins manage reviews" on public.reviews;
create policy "admins manage reviews" on public.reviews
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 4) FAQ (general, or tied to one product)
create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  product_id uuid references public.products(id) on delete cascade,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.faqs enable row level security;
drop policy if exists "anyone reads active faqs" on public.faqs;
create policy "anyone reads active faqs" on public.faqs
  for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "admins manage faqs" on public.faqs;
create policy "admins manage faqs" on public.faqs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
