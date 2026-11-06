-- NEW PHONE: "לקוחות שקנו את זה קנו גם" - מוצרים שהופיעו יחד באותן הזמנות.
-- מחזיר רק מזהי מוצרים (בלי פרטי לקוחות). בטוח להריץ שוב.
create or replace function public.also_bought(p_product_id uuid, p_limit int default 6)
returns table (product_id uuid, times bigint)
language sql
stable
security definer
set search_path to 'public'
as $$
  with with_product as (
    select o.id, o.items
      from public.orders o
     where o.status is distinct from 'מבוטל'
       and jsonb_typeof(o.items) = 'array'
       and exists (select 1 from jsonb_array_elements(o.items) i where i->>'product_id' = p_product_id::text)
  )
  select (i->>'product_id')::uuid, count(distinct w.id)
    from with_product w
    cross join lateral jsonb_array_elements(w.items) i
    join public.products p on p.id::text = i->>'product_id'
   where i->>'product_id' is not null
     and i->>'product_id' <> p_product_id::text
     and coalesce(p.is_published, true)
   group by 1
   order by 2 desc
   limit least(greatest(coalesce(p_limit, 6), 1), 12);
$$;
revoke all on function public.also_bought(uuid, int) from public;
grant execute on function public.also_bought(uuid, int) to anon, authenticated;
