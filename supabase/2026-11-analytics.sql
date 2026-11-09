-- NEW PHONE: site statistics (visitors, live now, products, funnel, sources, searches),
-- daily report, review requests after delivery, deal of the week, product video, review photos.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again.

-- =========================================================
-- 1) Tracking tables
-- =========================================================

-- Every visit (one browser tab session). last_seen is refreshed by a heartbeat while the page is open.
create table if not exists public.analytics_sessions (
  session_id text primary key,
  visitor_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  path text,
  product_id uuid,
  source text,
  referrer text,
  landing text,
  device text,
  browser text,
  page_views int not null default 0,
  cart_items int not null default 0,
  cart_value numeric not null default 0
);
create index if not exists analytics_sessions_last_seen_idx on public.analytics_sessions (last_seen);
create index if not exists analytics_sessions_started_idx on public.analytics_sessions (started_at);
create index if not exists analytics_sessions_visitor_idx on public.analytics_sessions (visitor_id);
alter table public.analytics_sessions enable row level security;
drop policy if exists "admins read sessions" on public.analytics_sessions;
create policy "admins read sessions" on public.analytics_sessions
  for select to authenticated using (public.is_admin());

-- Every action: page view, product view, add to cart, checkout, order, search...
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  session_id text not null,
  visitor_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('page_view','product_view','add_to_cart','checkout_start','order','search','compare','favorite','quiz_done','whatsapp_click')),
  path text,
  product_id uuid,
  query text,
  results int,
  value numeric,
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_time_idx on public.analytics_events (created_at);
create index if not exists analytics_events_product_idx on public.analytics_events (product_id, created_at) where product_id is not null;
create index if not exists analytics_events_visitor_idx on public.analytics_events (visitor_id, created_at);
create index if not exists analytics_events_session_idx on public.analytics_events (session_id);
alter table public.analytics_events enable row level security;
drop policy if exists "admins read events" on public.analytics_events;
create policy "admins read events" on public.analytics_events
  for select to authenticated using (public.is_admin());

-- =========================================================
-- 2) The site calls track(): updates the visit and stores up to 20 actions.
--    The customer's account is attached only when they agreed to statistics cookies.
--    Rate limit: 300 actions per visit per 10 minutes.
-- =========================================================
create or replace function public.track(p_session text, p_visitor text, p_info jsonb, p_events jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := case when coalesce((p_info->>'consent')::boolean, false) then auth.uid() else null end;
  v_uuid_re text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_product uuid := case when coalesce(p_info->>'product_id', '') ~ v_uuid_re then (p_info->>'product_id')::uuid end;
  v_events jsonb := case when jsonb_typeof(p_events) = 'array' then p_events else '[]'::jsonb end;
  v_views int;
  e jsonb;
begin
  if p_session is null or p_session !~ '^[A-Za-z0-9-]{8,64}$' or p_visitor is null or p_visitor !~ '^[A-Za-z0-9-]{8,64}$' then
    return;
  end if;

  select count(*) into v_views from jsonb_array_elements(v_events) x where x->>'type' = 'page_view';

  insert into public.analytics_sessions as s
    (session_id, visitor_id, user_id, path, product_id, source, referrer, landing, device, browser, page_views, cart_items, cart_value)
  values (
    p_session, p_visitor, v_uid,
    left(p_info->>'path', 300), v_product,
    left(p_info->>'source', 40), left(p_info->>'referrer', 300), left(p_info->>'landing', 300),
    left(p_info->>'device', 20), left(p_info->>'browser', 30),
    least(v_views, 20),
    greatest(0, least(999, coalesce((p_info->>'cart_items')::int, 0))),
    greatest(0, least(1000000, coalesce((p_info->>'cart_value')::numeric, 0)))
  )
  on conflict (session_id) do update set
    last_seen = now(),
    user_id = coalesce(excluded.user_id, s.user_id),
    path = coalesce(excluded.path, s.path),
    product_id = excluded.product_id,
    page_views = s.page_views + excluded.page_views,
    cart_items = excluded.cart_items,
    cart_value = excluded.cart_value
  where s.visitor_id = excluded.visitor_id;

  if jsonb_array_length(v_events) = 0 then
    return;
  end if;
  if (select count(*) from public.analytics_events a
       where a.session_id = p_session and a.created_at > now() - interval '10 minutes') >= 300 then
    return;
  end if;

  for e in select * from jsonb_array_elements(v_events) limit 20 loop
    if e->>'type' in ('page_view','product_view','add_to_cart','checkout_start','order','search','compare','favorite','quiz_done','whatsapp_click') then
      insert into public.analytics_events (session_id, visitor_id, user_id, type, path, product_id, query, results, value)
      values (
        p_session, p_visitor, v_uid, e->>'type',
        left(e->>'path', 300),
        case when coalesce(e->>'product_id', '') ~ v_uuid_re then (e->>'product_id')::uuid end,
        nullif(left(lower(trim(e->>'query')), 100), ''),
        case when coalesce(e->>'results', '') ~ '^\d{1,6}$' then (e->>'results')::int end,
        case when coalesce(e->>'value', '') ~ '^\d{1,7}(\.\d+)?$' then (e->>'value')::numeric end
      );
    end if;
  end loop;
end;
$$;
revoke all on function public.track(text, text, jsonb, jsonb) from public;
grant execute on function public.track(text, text, jsonb, jsonb) to anon, authenticated;

-- Statistics older than 13 months are deleted (privacy: keep only what's needed)
create or replace function public.analytics_cleanup()
returns void language sql security definer set search_path to 'public' as $$
  delete from public.analytics_events where created_at < now() - interval '13 months';
  delete from public.analytics_sessions where last_seen < now() - interval '13 months';
$$;
revoke all on function public.analytics_cleanup() from public, anon, authenticated;

-- Product id of an order line (new orders keep product_id; older ones kept the product's id)
create or replace function public.order_line_product(item jsonb)
returns uuid language sql immutable set search_path to 'public' as $$
  select case
    when coalesce(item->>'product_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (item->>'product_id')::uuid
    when coalesce(item->>'productId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (item->>'productId')::uuid
    when left(coalesce(item->>'id', ''), 36) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then left(item->>'id', 36)::uuid
  end
$$;

-- =========================================================
-- 3) Admin reports
-- =========================================================

-- Everything for a period in one call
create or replace function public.admin_analytics(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  r jsonb;
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;

  with ev as (
    select * from public.analytics_events where created_at >= p_from and created_at < p_to
  ),
  ses as (
    select * from public.analytics_sessions where started_at >= p_from and started_at < p_to
  ),
  ord as (
    select o.* from public.orders o
     where o.created_at >= p_from and o.created_at < p_to and coalesce(o.status, '') <> 'מבוטל'
  ),
  sold as (
    select public.order_line_product(i) as product_id, sum(coalesce((i->>'quantity')::numeric, 1)) as qty
      from ord, jsonb_array_elements(case when jsonb_typeof(ord.items) = 'array' then ord.items else '[]'::jsonb end) i
     where coalesce(i->>'kind', 'product') in ('product', 'upsell')
     group by 1
  ),
  prod as (
    select p.id, p.name, coalesce(p.image_url, p.images->>0) as image, coalesce(p.sale_price, p.price) as price,
           coalesce(v.views, 0) as views, coalesce(v.viewers, 0) as viewers, coalesce(v.carts, 0) as carts,
           coalesce(s.qty, 0) as sold
      from public.products p
      left join (
        select product_id,
               count(*) filter (where type = 'product_view') as views,
               count(distinct visitor_id) filter (where type = 'product_view') as viewers,
               count(*) filter (where type = 'add_to_cart') as carts
          from ev where product_id is not null group by product_id
      ) v on v.product_id = p.id
      left join sold s on s.product_id = p.id
     where coalesce(v.views, 0) + coalesce(v.carts, 0) + coalesce(s.qty, 0) > 0
  )
  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'visitors', (select count(distinct visitor_id) from ev),
      'sessions', (select count(*) from ses),
      'page_views', (select count(*) from ev where type = 'page_view'),
      'product_views', (select count(*) from ev where type = 'product_view'),
      'add_to_cart', (select count(*) from ev where type = 'add_to_cart'),
      'orders', (select count(*) from ord),
      'revenue', (select coalesce(sum(coalesce(total_price, total, 0)), 0) from ord),
      'avg_seconds', (select coalesce(round(avg(extract(epoch from (last_seen - started_at)))), 0) from ses),
      'avg_pages', (select coalesce(round(avg(page_views)::numeric, 1), 0) from ses),
      'bounce', (select case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where page_views <= 1) / count(*)) end from ses),
      'returning', (select count(distinct e.visitor_id) from ev e
                     where exists (select 1 from public.analytics_events b where b.visitor_id = e.visitor_id and b.created_at < p_from)),
      'signed_in', (select count(distinct user_id) from ev where user_id is not null)
    ),
    'daily', coalesce((
      select jsonb_agg(d order by d->>'day') from (
        select jsonb_build_object(
                 'day', to_char((created_at at time zone 'Asia/Jerusalem')::date, 'YYYY-MM-DD'),
                 'visitors', count(distinct visitor_id),
                 'views', count(*) filter (where type = 'page_view')) d
          from ev group by (created_at at time zone 'Asia/Jerusalem')::date
      ) x), '[]'::jsonb),
    'funnel', jsonb_build_object(
      'visit', (select count(distinct session_id) from ev),
      'product', (select count(distinct session_id) from ev where type = 'product_view'),
      'cart', (select count(distinct session_id) from ev where type = 'add_to_cart'),
      'checkout', (select count(distinct session_id) from ev where type = 'checkout_start'),
      'order', (select count(distinct session_id) from ev where type = 'order')
    ),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('source', src, 'sessions', n, 'orders', o, 'revenue', rev) order by n desc) from (
        select coalesce(s.source, 'ישיר') as src, count(*) as n,
               count(*) filter (where exists (select 1 from ev e where e.session_id = s.session_id and e.type = 'order')) as o,
               coalesce(sum((select sum(e.value) from ev e where e.session_id = s.session_id and e.type = 'order')), 0) as rev
          from ses s group by 1
      ) x), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('name', k, 'n', n) order by n desc) from (
        select coalesce(device, 'לא ידוע') k, count(*) n from ses group by 1) x), '[]'::jsonb),
    'browsers', coalesce((select jsonb_agg(jsonb_build_object('name', k, 'n', n) order by n desc) from (
        select coalesce(browser, 'לא ידוע') k, count(*) n from ses group by 1) x), '[]'::jsonb),
    'hours', coalesce((select jsonb_agg(jsonb_build_object('dow', dow, 'hour', hr, 'n', n)) from (
        select extract(dow from created_at at time zone 'Asia/Jerusalem')::int dow,
               extract(hour from created_at at time zone 'Asia/Jerusalem')::int hr, count(*) n
          from ev where type = 'page_view' group by 1, 2) x), '[]'::jsonb),
    'order_hours', coalesce((select jsonb_agg(jsonb_build_object('hour', hr, 'n', n)) from (
        select extract(hour from created_at at time zone 'Asia/Jerusalem')::int hr, count(*) n from ord group by 1) x), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('path', path, 'n', n) order by n desc) from (
        select path, count(*) n from ev where type = 'page_view' and path is not null group by 1 order by 2 desc limit 25) x), '[]'::jsonb),
    'searches', coalesce((select jsonb_agg(jsonb_build_object('query', query, 'n', n, 'results', res) order by n desc) from (
        select query, count(*) n, max(results) res from ev where type = 'search' and query is not null group by 1 order by 2 desc limit 50) x), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(to_jsonb(prod) order by prod.views desc, prod.sold desc) from prod), '[]'::jsonb),
    'actions', jsonb_build_object(
      'compare', (select count(*) from ev where type = 'compare'),
      'favorite', (select count(*) from ev where type = 'favorite'),
      'quiz_done', (select count(*) from ev where type = 'quiz_done'),
      'whatsapp_click', (select count(*) from ev where type = 'whatsapp_click')
    )
  ) into r;
  return r;
end;
$$;
revoke all on function public.admin_analytics(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_analytics(timestamptz, timestamptz) to authenticated;

-- Who is on the site right now (seen in the last 2 minutes)
create or replace function public.admin_live()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;
  return jsonb_build_object(
    'online', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_id', s.session_id, 'visitor_id', s.visitor_id,
        'name', coalesce(u.raw_user_meta_data->>'full_name', pr.full_name),
        'email', u.email,
        'path', s.path, 'product', p.name, 'source', s.source, 'device', s.device, 'browser', s.browser,
        'started_at', s.started_at, 'last_seen', s.last_seen, 'page_views', s.page_views,
        'cart_items', s.cart_items, 'cart_value', s.cart_value
      ) order by s.last_seen desc)
      from public.analytics_sessions s
      left join auth.users u on u.id = s.user_id
      left join public.profiles pr on pr.id = s.user_id
      left join public.products p on p.id = s.product_id
     where s.last_seen > now() - interval '2 minutes'), '[]'::jsonb),
    'open_carts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'visitor_id', s.visitor_id, 'name', coalesce(u.raw_user_meta_data->>'full_name', pr.full_name), 'email', u.email,
        'cart_items', s.cart_items, 'cart_value', s.cart_value, 'last_seen', s.last_seen
      ) order by s.last_seen desc)
      from (
        select distinct on (visitor_id) * from public.analytics_sessions
         where last_seen > now() - interval '24 hours'
         order by visitor_id, last_seen desc
      ) s
      left join auth.users u on u.id = s.user_id
      left join public.profiles pr on pr.id = s.user_id
     where s.cart_items > 0
       and not exists (select 1 from public.analytics_events e where e.visitor_id = s.visitor_id and e.type = 'order' and e.created_at > s.last_seen - interval '1 hour')
    ), '[]'::jsonb),
    'today_visitors', (select count(distinct visitor_id) from public.analytics_events
                        where created_at >= (date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem'))
  );
end;
$$;
revoke all on function public.admin_live() from public, anon;
grant execute on function public.admin_live() to authenticated;

-- List of visitors in a period (signed-in customers appear by name)
create or replace function public.admin_visitors(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;
  return coalesce((
    select jsonb_agg(v order by v->>'last_seen' desc) from (
      select jsonb_build_object(
        'visitor_id', e.visitor_id,
        'name', max(coalesce(u.raw_user_meta_data->>'full_name', pr.full_name)),
        'email', max(u.email),
        'first_seen', (select min(b.created_at) from public.analytics_events b where b.visitor_id = e.visitor_id),
        'last_seen', max(e.created_at),
        'sessions', count(distinct e.session_id),
        'page_views', count(*) filter (where e.type = 'page_view'),
        'products', count(distinct e.product_id) filter (where e.type = 'product_view'),
        'carts', count(*) filter (where e.type = 'add_to_cart'),
        'orders', count(*) filter (where e.type = 'order'),
        'source', (select s.source from public.analytics_sessions s where s.visitor_id = e.visitor_id order by s.started_at limit 1),
        'device', (select s.device from public.analytics_sessions s where s.visitor_id = e.visitor_id order by s.last_seen desc limit 1)
      ) v
      from public.analytics_events e
      left join auth.users u on u.id = e.user_id
      left join public.profiles pr on pr.id = e.user_id
     where e.created_at >= p_from and e.created_at < p_to
     group by e.visitor_id
     order by max(e.created_at) desc
     limit 500
    ) x), '[]'::jsonb);
end;
$$;
revoke all on function public.admin_visitors(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_visitors(timestamptz, timestamptz) to authenticated;

-- Everything one visitor did, newest first
create or replace function public.admin_visitor_timeline(p_visitor text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'type', e.type, 'path', e.path, 'product', p.name, 'query', e.query, 'results', e.results, 'value', e.value,
      'created_at', e.created_at, 'session_id', e.session_id
    ) order by e.created_at desc)
    from (select * from public.analytics_events where visitor_id = p_visitor order by created_at desc limit 300) e
    left join public.products p on p.id = e.product_id), '[]'::jsonb);
end;
$$;
revoke all on function public.admin_visitor_timeline(text) from public, anon;
grant execute on function public.admin_visitor_timeline(text) to authenticated;

-- =========================================================
-- 4) Best sellers (for the "הכי נמכר" badge): product ids only, no numbers
-- =========================================================
create or replace function public.best_sellers(p_days int default 30, p_limit int default 6)
returns table (product_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.order_line_product(i)
    from public.orders o,
         jsonb_array_elements(case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end) i
   where o.created_at > now() - make_interval(days => least(greatest(p_days, 1), 365))
     and coalesce(o.status, '') <> 'מבוטל'
     and coalesce(i->>'kind', 'product') = 'product'
     and public.order_line_product(i) is not null
   group by 1
  having sum(coalesce((i->>'quantity')::numeric, 1)) >= 2
   order by sum(coalesce((i->>'quantity')::numeric, 1)) desc
   limit least(greatest(p_limit, 1), 20)
$$;
revoke all on function public.best_sellers(int, int) from public;
grant execute on function public.best_sellers(int, int) to anon, authenticated;

-- =========================================================
-- 5) Daily report (sent by the daily cron, protected by the cron secret)
-- =========================================================
create or replace function public.daily_report(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_to timestamptz := date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem';
  v_from timestamptz := v_to - interval '1 day';
  r jsonb;
begin
  if p_secret is null or p_secret is distinct from (select s.value from public.app_secrets s where s.name = 'cron') then
    return null;
  end if;
  perform public.analytics_cleanup();

  select jsonb_build_object(
    'day', to_char(v_from at time zone 'Asia/Jerusalem', 'DD/MM/YYYY'),
    'visitors', (select count(distinct visitor_id) from public.analytics_events where created_at >= v_from and created_at < v_to),
    'page_views', (select count(*) from public.analytics_events where type = 'page_view' and created_at >= v_from and created_at < v_to),
    'add_to_cart', (select count(*) from public.analytics_events where type = 'add_to_cart' and created_at >= v_from and created_at < v_to),
    'orders', (select count(*) from public.orders where created_at >= v_from and created_at < v_to and coalesce(status, '') <> 'מבוטל'),
    'revenue', (select coalesce(sum(coalesce(total_price, total, 0)), 0) from public.orders where created_at >= v_from and created_at < v_to and coalesce(status, '') <> 'מבוטל'),
    'pending', (select count(*) from public.orders where coalesce(status, 'חדש') in ('חדש', 'pending')),
    'top_products', coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'views', x.n) order by x.n desc) from (
        select product_id, count(*) n from public.analytics_events
         where type = 'product_view' and created_at >= v_from and created_at < v_to and product_id is not null
         group by 1 order by 2 desc limit 5) x join public.products p on p.id = x.product_id), '[]'::jsonb),
    'zero_searches', coalesce((select jsonb_agg(query) from (
        select query from public.analytics_events
         where type = 'search' and results = 0 and created_at >= v_from and created_at < v_to and query is not null
         group by 1 order by count(*) desc limit 10) x), '[]'::jsonb),
    'low_stock', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'stock', stock) order by stock) from (
        select name, stock from public.products where stock is not null and stock <= 3 and coalesce(is_published, true) order by stock limit 10) x), '[]'::jsonb),
    'recipients', coalesce((select jsonb_agg(distinct a.email) from public.admins a where a.email is not null), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;
revoke all on function public.daily_report(text) from public;
grant execute on function public.daily_report(text) to anon, authenticated;

-- =========================================================
-- 6) Review request after delivery
-- =========================================================
alter table public.orders add column if not exists shipped_at timestamptz;
alter table public.orders add column if not exists completed_at timestamptz;
alter table public.orders add column if not exists review_requested_at timestamptz;

create or replace function public.orders_status_times()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'נשלח' and new.shipped_at is null then new.shipped_at := now(); end if;
    if new.status = 'הושלם' and new.completed_at is null then new.completed_at := now(); end if;
  end if;
  return new;
end;
$$;
drop trigger if exists orders_status_times on public.orders;
create trigger orders_status_times before update of status on public.orders
  for each row execute function public.orders_status_times();

-- Orders that were delivered (completed a day ago, or shipped 5 days ago) and weren't asked yet
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

-- =========================================================
-- 7) Deal of the week + product video
-- =========================================================
alter table public.settings add column if not exists deal_active boolean not null default false;
alter table public.settings add column if not exists deal_product_id text;
alter table public.settings add column if not exists deal_title text;
alter table public.settings add column if not exists deal_end timestamptz;
alter table public.products add column if not exists video_url text;

-- =========================================================
-- 8) Customer reviews with a photo
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-images', 'review-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic'];

drop policy if exists "customers upload own review photo" on storage.objects;
create policy "customers upload own review photo" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'review-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop function if exists public.submit_review(text, int, text);
create or replace function public.submit_review(p_name text, p_rating int, p_text text, p_image_url text default null)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := left(trim(coalesce(p_name, '')), 40);
  v_text text := left(trim(coalesce(p_text, '')), 600);
  v_image text := nullif(trim(coalesce(p_image_url, '')), '');
begin
  if v_uid is null then
    raise exception 'sign in required';
  end if;
  if v_name = '' or length(v_text) < 5 or p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'invalid review';
  end if;
  -- only a photo this customer uploaded to the review photos folder
  if v_image is not null and v_image !~ ('^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/review-images/' || v_uid::text || '/[A-Za-z0-9._-]+$') then
    v_image := null;
  end if;
  insert into public.reviews (user_id, source, name, rating, text, image_url, is_active, sort_order)
  values (v_uid, 'customer', v_name, p_rating, v_text, v_image, false, 100)
  on conflict (user_id) where source = 'customer' do update
    set name = excluded.name, rating = excluded.rating, text = excluded.text, image_url = excluded.image_url,
        is_active = false, created_at = now();
  return true;
end;
$$;
revoke all on function public.submit_review(text, int, text, text) from public, anon;
grant execute on function public.submit_review(text, int, text, text) to authenticated;
