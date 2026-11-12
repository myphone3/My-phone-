-- NEW PHONE: order tracking without signing in (order number + phone number).
-- The order number is the same 8 digits the site shows (computed from the order id, see lib/orders.ts).
-- Returns only what the customer needs to see: status, dates, items and totals. No address, email or name.
-- Safe to run again.

create or replace function public.order_number(p_id uuid)
returns text
language plpgsql
immutable
parallel safe
set search_path to 'public'
as $$
declare
  t text := p_id::text;
  h bigint := 0;
  i int;
begin
  for i in 1..length(t) loop
    h := (h * 31 + ascii(substr(t, i, 1))) % 4294967296;
  end loop;
  return (10000000 + h % 90000000)::text;
end;
$$;

create index if not exists orders_order_number_idx on public.orders (public.order_number(id));

create or replace function public.track_order(p_number text, p_phone text)
returns table (
  order_number text,
  created_at timestamptz,
  status text,
  items jsonb,
  subtotal numeric,
  discount_amount numeric,
  shipping_cost numeric,
  total_price numeric,
  shipped_at timestamptz,
  completed_at timestamptz,
  city text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with q as (
    select regexp_replace(coalesce(p_number, ''), '\D', '', 'g') as num,
           right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9) as ph
  )
  select public.order_number(o.id),
         o.created_at,
         coalesce(o.status, 'חדש'),
         coalesce((
           select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                    'name', e ->> 'name',
                    'quantity', e -> 'quantity',
                    'price', e -> 'price',
                    'sale_price', e -> 'sale_price',
                    'version', e ->> 'version',
                    'color', e ->> 'color',
                    'gift', e -> 'gift',
                    'kind', e ->> 'kind',
                    'original_price', e -> 'original_price',
                    'image', coalesce(e ->> 'image', e ->> 'image_url'))))
             from jsonb_array_elements(case when jsonb_typeof(o.items::jsonb) = 'array' then o.items::jsonb else '[]'::jsonb end) e
         ), '[]'::jsonb),
         o.subtotal::numeric,
         o.discount_amount::numeric,
         o.shipping_cost::numeric,
         coalesce(o.total_price, o.total)::numeric,
         o.shipped_at,
         o.completed_at,
         o.city
    from public.orders o, q
   where length(q.num) = 8
     and length(q.ph) = 9
     and public.order_number(o.id) = q.num
     and right(regexp_replace(coalesce(o.phone, o.customer_phone, ''), '\D', '', 'g'), 9) = q.ph
   limit 1;
$$;
revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;
