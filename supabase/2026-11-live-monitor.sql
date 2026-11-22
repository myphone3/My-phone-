-- NEW PHONE: live site monitoring.
-- Adds the visitor's city/region (from the IP, via the site's own server, city level only),
-- and extends admin_live with: today's numbers and funnel, a live activity feed, cities and sources today,
-- and which pages people are on right now. Safe to run again.

alter table public.analytics_sessions add column if not exists city text;
alter table public.analytics_sessions add column if not exists region text;
alter table public.analytics_sessions add column if not exists country text;

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
  v_city text := nullif(left(trim(p_info->>'city'), 60), '');
  v_region text := nullif(left(trim(p_info->>'region'), 60), '');
  v_country text := nullif(left(upper(trim(p_info->>'country')), 2), '');
  v_views int;
  e jsonb;
begin
  if p_session is null or p_session !~ '^[A-Za-z0-9-]{8,64}$' or p_visitor is null or p_visitor !~ '^[A-Za-z0-9-]{8,64}$' then
    return;
  end if;

  select count(*) into v_views from jsonb_array_elements(v_events) x where x->>'type' = 'page_view';

  insert into public.analytics_sessions as s
    (session_id, visitor_id, user_id, path, product_id, source, referrer, landing, device, browser, page_views, cart_items, cart_value,
     city, region, country)
  values (
    p_session, p_visitor, v_uid,
    left(p_info->>'path', 300), v_product,
    left(p_info->>'source', 40), left(p_info->>'referrer', 300), left(p_info->>'landing', 300),
    left(p_info->>'device', 20), left(p_info->>'browser', 30),
    least(v_views, 20),
    greatest(0, least(999, coalesce((p_info->>'cart_items')::int, 0))),
    greatest(0, least(1000000, coalesce((p_info->>'cart_value')::numeric, 0))),
    v_city, v_region, v_country
  )
  on conflict (session_id) do update set
    last_seen = now(),
    user_id = coalesce(excluded.user_id, s.user_id),
    path = coalesce(excluded.path, s.path),
    product_id = excluded.product_id,
    page_views = s.page_views + excluded.page_views,
    cart_items = excluded.cart_items,
    cart_value = excluded.cart_value,
    city = coalesce(s.city, excluded.city),
    region = coalesce(s.region, excluded.region),
    country = coalesce(s.country, excluded.country)
  where s.visitor_id = excluded.visitor_id;

  if jsonb_array_length(v_events) = 0 then
    return;
  end if;
  if (select count(*) from public.analytics_events a
       where a.session_id = p_session and a.created_at > now() - interval '10 minutes') >= 300 then
    return;
  end if;

  for e in select * from jsonb_array_elements(v_events) limit 20 loop
    if e->>'type' in ('page_view','product_view','add_to_cart','checkout_start','order','search','compare','favorite','quiz_done',
                      'whatsapp_click','assistant_open','track_order') then
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

create index if not exists analytics_events_created_idx on public.analytics_events (created_at desc);
create index if not exists analytics_sessions_last_seen_idx on public.analytics_sessions (last_seen desc);

create or replace function public.admin_live()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_today timestamptz := date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem';
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
        'city', s.city, 'region', s.region, 'country', s.country,
        'started_at', s.started_at, 'last_seen', s.last_seen, 'page_views', s.page_views,
        'cart_items', s.cart_items, 'cart_value', s.cart_value,
        'returning', exists (select 1 from public.analytics_sessions o where o.visitor_id = s.visitor_id and o.started_at < s.started_at),
        'last_action', (select e.type from public.analytics_events e where e.session_id = s.session_id order by e.created_at desc limit 1)
      ) order by s.last_seen desc)
      from public.analytics_sessions s
      left join auth.users u on u.id = s.user_id
      left join public.profiles pr on pr.id = s.user_id
      left join public.products p on p.id = s.product_id
     where s.last_seen > now() - interval '2 minutes'), '[]'::jsonb),
    'open_carts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'visitor_id', s.visitor_id, 'name', coalesce(u.raw_user_meta_data->>'full_name', pr.full_name), 'email', u.email,
        'cart_items', s.cart_items, 'cart_value', s.cart_value, 'last_seen', s.last_seen, 'city', s.city
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
    'today_visitors', (select count(distinct visitor_id) from public.analytics_events where created_at >= v_today),
    -- היום עד עכשיו: משפך ומספרים
    'today', (
      select jsonb_build_object(
        'visitors', count(distinct e.visitor_id),
        'page_views', count(*) filter (where e.type = 'page_view'),
        'viewed_product', count(distinct e.visitor_id) filter (where e.type = 'product_view'),
        'added_to_cart', count(distinct e.visitor_id) filter (where e.type = 'add_to_cart'),
        'started_checkout', count(distinct e.visitor_id) filter (where e.type = 'checkout_start'),
        'ordered', count(distinct e.visitor_id) filter (where e.type = 'order'),
        'searches', count(*) filter (where e.type = 'search'),
        'whatsapp', count(*) filter (where e.type = 'whatsapp_click'),
        'returning', (select count(distinct s.visitor_id) from public.analytics_sessions s
                       where s.started_at >= v_today
                         and exists (select 1 from public.analytics_sessions o where o.visitor_id = s.visitor_id and o.started_at < v_today)),
        'orders', (select count(*) from public.orders o where o.created_at >= v_today and o.status is distinct from 'מבוטל'),
        'revenue', (select coalesce(sum(coalesce(o.total_price, o.total)), 0) from public.orders o where o.created_at >= v_today and o.status is distinct from 'מבוטל')
      )
      from public.analytics_events e where e.created_at >= v_today
    ),
    -- מה קורה עכשיו: 40 הפעולות האחרונות
    'feed', coalesce((
      select jsonb_agg(f order by (f->>'created_at') desc) from (
        select jsonb_build_object(
          'type', e.type, 'path', e.path, 'product', p.name, 'query', e.query, 'results', e.results, 'value', e.value,
          'created_at', e.created_at, 'visitor_id', e.visitor_id, 'session_id', e.session_id,
          'name', coalesce(u.raw_user_meta_data->>'full_name', pr.full_name), 'email', u.email,
          'city', s.city, 'device', s.device
        ) f
        from (select * from public.analytics_events where created_at > now() - interval '6 hours' order by created_at desc limit 40) e
        left join public.analytics_sessions s on s.session_id = e.session_id
        left join auth.users u on u.id = e.user_id
        left join public.profiles pr on pr.id = e.user_id
        left join public.products p on p.id = e.product_id
      ) x), '[]'::jsonb),
    'cities_today', coalesce((
      select jsonb_agg(jsonb_build_object('city', city, 'n', n) order by n desc) from (
        select coalesce(nullif(city, ''), 'לא ידוע') as city, count(distinct visitor_id) as n
          from public.analytics_sessions where started_at >= v_today
         group by 1 order by 2 desc limit 12) c), '[]'::jsonb),
    'sources_today', coalesce((
      select jsonb_agg(jsonb_build_object('source', source, 'n', n, 'ordered', ordered) order by n desc) from (
        select coalesce(s.source, 'ישיר') as source, count(distinct s.visitor_id) as n,
               count(distinct s.visitor_id) filter (where exists (select 1 from public.analytics_events e where e.session_id = s.session_id and e.type = 'order')) as ordered
          from public.analytics_sessions s where s.started_at >= v_today
         group by 1 order by 2 desc limit 8) c), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.admin_live() from public;
grant execute on function public.admin_live() to authenticated;

-- city in the visitors list
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
        'device', (select s.device from public.analytics_sessions s where s.visitor_id = e.visitor_id order by s.last_seen desc limit 1),
        'city', (select s.city from public.analytics_sessions s where s.visitor_id = e.visitor_id and s.city is not null order by s.last_seen desc limit 1)
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
revoke all on function public.admin_visitors(timestamptz, timestamptz) from public;
grant execute on function public.admin_visitors(timestamptz, timestamptz) to authenticated;
