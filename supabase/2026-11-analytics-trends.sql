-- NEW PHONE: activity over time for the statistics screen (by hour / day / week / month).
-- Run AFTER 2026-11-analytics.sql. Safe to run again.
create or replace function public.admin_timeseries(p_from timestamptz, p_to timestamptz, p_bucket text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_unit text := case when p_bucket in ('hour', 'day', 'week', 'month') then p_bucket else 'day' end;
  v_step interval := case v_unit when 'hour' then interval '1 hour' when 'day' then interval '1 day' when 'week' then interval '1 week' else interval '1 month' end;
  r jsonb;
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;
  -- at most ~400 points
  if (extract(epoch from (p_to - p_from)) / extract(epoch from v_step)) > 400 then
    raise exception 'range too long for this bucket';
  end if;

  with buckets as (
    select b as local_start
      from generate_series(
        date_trunc(v_unit, p_from at time zone 'Asia/Jerusalem'),
        (p_to - interval '1 second') at time zone 'Asia/Jerusalem',
        v_step) b
  ),
  ev as (
    select date_trunc(v_unit, created_at at time zone 'Asia/Jerusalem') as k, visitor_id, type
      from public.analytics_events
     where created_at >= p_from and created_at < p_to
  ),
  ord as (
    select date_trunc(v_unit, created_at at time zone 'Asia/Jerusalem') as k, coalesce(total_price, total, 0) as amount
      from public.orders
     where created_at >= p_from and created_at < p_to and coalesce(status, '') <> 'מבוטל'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'start', to_char(b.local_start, 'YYYY-MM-DD"T"HH24:MI'),
           'visitors', coalesce(e.visitors, 0),
           'views', coalesce(e.views, 0),
           'product_views', coalesce(e.product_views, 0),
           'carts', coalesce(e.carts, 0),
           'orders', coalesce(o.orders, 0),
           'revenue', coalesce(o.revenue, 0)
         ) order by b.local_start), '[]'::jsonb)
    into r
    from buckets b
    left join (
      select k, count(distinct visitor_id) as visitors,
             count(*) filter (where type = 'page_view') as views,
             count(*) filter (where type = 'product_view') as product_views,
             count(*) filter (where type = 'add_to_cart') as carts
        from ev group by k
    ) e on e.k = b.local_start
    left join (select k, count(*) as orders, sum(amount) as revenue from ord group by k) o on o.k = b.local_start;
  return r;
end;
$$;
revoke all on function public.admin_timeseries(timestamptz, timestamptz, text) from public, anon;
grant execute on function public.admin_timeseries(timestamptz, timestamptz, text) to authenticated;
