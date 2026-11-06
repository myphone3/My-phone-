-- NEW PHONE: price per product version (e.g. "נגן מצלמה + הודעות sms" +₪100).
-- products.version_prices = {"<version name>": <extra ₪>}; place_order adds the extra to the unit price.
-- Safe to run again.

alter table public.products add column if not exists version_prices jsonb not null default '{}'::jsonb;

create or replace function public.place_order(p_items jsonb, p_customer jsonb, p_coupon text, p_confirmation_token uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  it jsonb;
  prod record;
  parent record;
  qty int;
  unit numeric;
  items jsonb := '[]'::jsonb;
  subtotal numeric := 0;
  discount numeric := 0;
  shipping numeric := 29;
  s record;
  promo jsonb;
  coupon record;
  uid uuid := auth.uid();
  user_email text;
  user_created timestamptz;
  gift record;
  new_id uuid;
  result jsonb;
  bundle jsonb;
  upsell_disc jsonb;
  v_extra numeric;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty cart';
  end if;
  if coalesce(trim(p_customer->>'name'), '') = '' or coalesce(trim(p_customer->>'phone'), '') = '' or coalesce(trim(p_customer->>'email'), '') = '' then
    raise exception 'missing customer details';
  end if;

  -- מוצרים
  for it in select * from jsonb_array_elements(p_items) loop
    qty := least(greatest(coalesce((it->>'quantity')::int, 1), 1), 99);

    if it->>'kind' = 'bundle' then
      -- מוצר נלווה ("נקנה יחד"): המחיר נלקח מהגדרות מוצר האב לפי השם
      select * into parent from products where id = (it->>'parent_id')::uuid;
      if not found then continue; end if;
      select b into bundle from jsonb_array_elements(coalesce(parent.frequently_bought_together, '[]'::jsonb)) b
        where b->>'name' = it->>'name' limit 1;
      if bundle is null then continue; end if;
      unit := coalesce((bundle->>'price')::numeric, 0);
      items := items || jsonb_build_object('kind', 'bundle', 'name', bundle->>'name', 'price', unit, 'quantity', qty);
      subtotal := subtotal + unit * qty;

    else
      select * into prod from products where id = (it->>'product_id')::uuid;
      if not found then continue; end if;
      unit := coalesce(prod.sale_price, prod.price, 0);

      -- תוספת מחיר לגרסה שנבחרה (רק גרסה שקיימת במוצר)
      if coalesce(it->>'kind', 'product') = 'product' and coalesce(it->>'version', '') <> '' then
        v_extra := 0;
        if prod.version_prices ? (it->>'version') then
          begin
            v_extra := greatest(0, coalesce((prod.version_prices->>(it->>'version'))::numeric, 0));
          exception when others then
            v_extra := 0;
          end;
        end if;
        unit := unit + v_extra;
      end if;

      if it->>'kind' = 'upsell' then
        -- הטבת "קנה גם": ההנחה מוגדרת במוצר אחר שנמצא בעגלה
        select p.upsell_discount_item into upsell_disc from products p
          where p.upsell_discount_item->>'productId' = prod.id::text
            and p.id::text in (select x->>'product_id' from jsonb_array_elements(p_items) x where coalesce(x->>'kind','product') = 'product')
          limit 1;
        if upsell_disc is not null then
          if upsell_disc->>'discountType' = 'percent' then
            unit := unit * (1 - coalesce((upsell_disc->>'discountValue')::numeric, 0) / 100);
          else
            unit := greatest(0, unit - coalesce((upsell_disc->>'discountValue')::numeric, 0));
          end if;
        end if;
        qty := 1;
      end if;

      items := items || jsonb_build_object(
        'kind', coalesce(it->>'kind', 'product'),
        'product_id', prod.id,
        'name', prod.name || case when it->>'kind' = 'upsell' then ' (הטבת מבצע)' else '' end,
        'price', round(unit, 2),
        'quantity', qty,
        'version', nullif(it->>'version', ''),
        'color', nullif(it->>'color', ''),
        'image', coalesce(prod.image_url, prod.images->>0)
      );
      subtotal := subtotal + round(unit, 2) * qty;
    end if;
  end loop;

  if jsonb_array_length(items) = 0 then
    raise exception 'no valid items';
  end if;

  -- הגדרות החנות (השורה שבה שמור מבצע ההצטרפות)
  select * into s from settings order by (announcement_text like '{%') desc, id desc limit 1;

  -- קופון
  if coalesce(trim(p_coupon), '') <> '' then
    select * into coupon from coupons c
      where lower(c.code) = lower(trim(p_coupon)) and (c.expires_at is null or c.expires_at > now()) limit 1;
    if found then
      if coupon.discount_type in ('percent', 'percentage') then
        discount := discount + subtotal * coupon.discount_value / 100;
      else
        discount := discount + coupon.discount_value;
      end if;
    end if;
  end if;

  -- מתנת / הנחת הצטרפות: לקוח רשום, בלי הזמנות קודמות, בתוך מספר הימים, מעל סכום המינימום
  begin
    promo := s.announcement_text::jsonb;
  exception when others then
    promo := null;
  end;
  if uid is not null and promo is not null and coalesce((promo->>'welcome_active')::boolean, false) then
    select email, created_at into user_email, user_created from auth.users where id = uid;
    if (coalesce(nullif(promo->>'welcome_days_valid', '')::numeric, 0) = 0
          or user_created + make_interval(days => (promo->>'welcome_days_valid')::int) > now())
       and subtotal >= coalesce(nullif(promo->>'welcome_min_purchase', '')::numeric, 0)
       and not exists (
         select 1 from orders o
          where lower(o.email) in (lower(user_email), lower(p_customer->>'email'))
       ) then
      if promo->>'welcome_type' = 'מתנה' then
        select * into gift from products where id = nullif(promo->>'welcome_gift_product_id', '')::uuid;
        if found then
          items := items || jsonb_build_object(
            'kind', 'gift', 'product_id', gift.id, 'name', gift.name, 'price', 0,
            'original_price', coalesce(gift.sale_price, gift.price), 'quantity', 1, 'gift', true,
            'image', coalesce(gift.image_url, gift.images->>0)
          );
        end if;
      else
        discount := discount + subtotal * coalesce(nullif(promo->>'welcome_discount_value', '')::numeric, 0) / 100;
      end if;
    end if;
  end if;

  -- משלוח חינם מעל סכום (כשהמבצע פעיל ולא פג תוקפו)
  if coalesce(s.threshold_active, false)
     and (coalesce(s.announcement_end_time, '') = '' or s.announcement_end_time::timestamptz > now())
     and subtotal >= coalesce(nullif(s.threshold_amount, '')::numeric, 400) then
    shipping := 0;
  end if;

  discount := round(least(discount, subtotal), 2);

  insert into orders (
    confirmation_token, customer_name, phone, email, city, street, building, address, notes,
    payment_method, items, subtotal, discount_amount, shipping_cost, total_price, status
  ) values (
    p_confirmation_token,
    trim(p_customer->>'name'), trim(p_customer->>'phone'), trim(p_customer->>'email'),
    trim(p_customer->>'city'), trim(p_customer->>'street'), trim(p_customer->>'building'),
    format('עיר: %s, רחוב: %s, מס'' בניין/דירה: %s', trim(p_customer->>'city'), trim(p_customer->>'street'), trim(p_customer->>'building')),
    nullif(trim(p_customer->>'notes'), ''),
    'credit', items, round(subtotal, 2), discount, shipping,
    round(greatest(0, subtotal - discount + shipping), 2), 'חדש'
  )
  returning id into new_id;

  select jsonb_build_object(
    'id', o.id, 'created_at', o.created_at, 'customer_name', o.customer_name, 'phone', o.phone,
    'email', o.email, 'address', o.address, 'notes', o.notes, 'items', o.items, 'subtotal', o.subtotal,
    'discount_amount', o.discount_amount, 'shipping_cost', o.shipping_cost, 'total_price', o.total_price,
    'status', o.status
  ) into result from orders o where o.id = new_id;
  return result;
end;
$function$;
