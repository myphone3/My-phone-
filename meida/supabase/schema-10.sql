-- שדרוג 10: מלאי — מאיזה ספק הגיע, מתי הגיע, וסיכום חודשי.
-- supplier: שם הספק (חופשי, לא חובה). arrived_at: מתי סומן "הגיע" (לממוצע ימים עד שמגיע).

alter table public.kb_stock add column if not exists supplier text not null default '';
alter table public.kb_stock add column if not exists arrived_at timestamptz;
update public.kb_stock set arrived_at = updated_at where status = 'arrived' and arrived_at is null;

create or replace function public.kb_save_stock(p_shop uuid, p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; x kb_stock; st text; nm text; pl text; pt text; q int; sp text;
begin
  perform kb_need(p_shop);
  st := coalesce(nullif(p->>'status',''),'out');
  if st not in ('out','low','ordered','arrived') then raise exception 'bad status'; end if;
  nm := left(trim(coalesce(p->>'name','')),200);
  pl := case when p->>'place' = 'lab' then 'lab' else 'shop' end;
  pt := case when pl = 'lab' and p->>'part' in ('screen','battery','port','part','tool') then p->>'part' else '' end;
  q := case when coalesce(p->>'qty','') ~ '^\d{1,4}$' and (p->>'qty')::int > 0 then (p->>'qty')::int end;
  sp := left(trim(coalesce(p->>'supplier','')),80);
  v_id := nullif(p->>'id','')::uuid;
  if v_id is null then
    if nm = '' then raise exception 'empty'; end if;
    -- אותו מוצר כבר פתוח (באותו מקום)? מעדכנים אותו במקום כפילות
    select * into x from kb_stock where shop_id = p_shop and place = pl and lower(name) = lower(nm) and status in ('out','low','ordered') and deleted_at is null limit 1;
    if x.id is not null then
      update kb_stock set status = st, note = coalesce(nullif(left(p->>'note',500),''), note), company_id = coalesce(kb_company(p_shop, p->>'company_id'), company_id),
        qty = coalesce(q, qty), status_by_name = kb_me_name(), updated_at = now(),
        arrived_at = case when st = 'arrived' then now() else null end where id = x.id returning * into x;
      return row_to_json(x);
    end if;
    insert into kb_stock(shop_id, name, company_id, status, note, place, part, qty, created_by, created_by_name, status_by_name, supplier, arrived_at)
      values (p_shop, nm, kb_company(p_shop, p->>'company_id'), st, left(coalesce(p->>'note',''),500), pl, pt, q, auth.uid(), kb_me_name(), kb_me_name(), sp,
        case when st = 'arrived' then now() end)
      returning * into x;
  else
    update kb_stock set name = coalesce(nullif(nm,''), name), company_id = case when p ? 'company_id' then kb_company(p_shop, p->>'company_id') else company_id end,
      note = case when p ? 'note' then left(coalesce(p->>'note',''),500) else note end,
      qty = case when p ? 'qty' then q else qty end,
      supplier = case when p ? 'supplier' then sp else supplier end,
      arrived_at = case when st = 'arrived' then coalesce(case when status = 'arrived' then arrived_at end, now()) else null end,
      status_by_name = case when status <> st then kb_me_name() else status_by_name end,
      status = st, updated_at = now()
    where id = v_id and shop_id = p_shop returning * into x;
  end if;
  return row_to_json(x);
end $$;

create or replace function public.kb_stock_status(p_shop uuid, p_ids uuid[], p_status text)
returns json language plpgsql security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  if p_status not in ('out','low','ordered','arrived') then raise exception 'bad status'; end if;
  update kb_stock set
    arrived_at = case when p_status = 'arrived' then coalesce(case when status = 'arrived' then arrived_at end, now()) else null end,
    status = p_status, status_by_name = kb_me_name(), updated_at = now()
  where shop_id = p_shop and id = any(p_ids) and deleted_at is null;
  return coalesce((select json_agg(x) from kb_stock x where x.shop_id = p_shop and x.id = any(p_ids)), '[]'::json);
end $$;

-- סיכום חודשי: כל מה שדווח או הגיע בטווח (בטעינה הרגילה יש רק 30 יום של "הגיע")
create or replace function public.kb_stock_range(p_shop uuid, p_from timestamptz, p_to timestamptz)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  return coalesce((select json_agg(x order by x.created_at) from kb_stock x where x.shop_id = p_shop and x.deleted_at is null
    and (x.created_at >= p_from and x.created_at < p_to or x.arrived_at >= p_from and x.arrived_at < p_to)), '[]'::json);
end $$;

-- ספקים שכבר נרשמו (הכי שכיחים קודם) — לבחירה מהירה כשמסמנים "הגיע"
create or replace function public.kb_stock_suppliers(p_shop uuid)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  return coalesce((select json_agg(s order by n desc, s) from (
    select supplier s, count(*) n from kb_stock where shop_id = p_shop and supplier <> '' and deleted_at is null
      and updated_at > now() - interval '365 days' group by supplier limit 30) t), '[]'::json);
end $$;

do $$
declare f text;
begin
  foreach f in array array['kb_stock_range(uuid,timestamptz,timestamptz)','kb_stock_suppliers(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
