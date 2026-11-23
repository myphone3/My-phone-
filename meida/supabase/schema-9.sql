-- שדרוג 9: מלאי מעבדה — חלקים, מסכים, סוללות. בנפרד ממלאי החנות, עם כמות.
-- place: shop | lab. part: screen | battery | port | part | tool (רק במעבדה). qty: כמה צריך.

alter table public.kb_stock add column if not exists place text not null default 'shop';
alter table public.kb_stock add column if not exists part text not null default '';
alter table public.kb_stock add column if not exists qty int;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kb_stock_place_chk') then
    alter table public.kb_stock add constraint kb_stock_place_chk check (place in ('shop','lab'));
  end if;
end $$;

create or replace function public.kb_save_stock(p_shop uuid, p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; x kb_stock; st text; nm text; pl text; pt text; q int;
begin
  perform kb_need(p_shop);
  st := coalesce(nullif(p->>'status',''),'out');
  if st not in ('out','low','ordered','arrived') then raise exception 'bad status'; end if;
  nm := left(trim(coalesce(p->>'name','')),200);
  pl := case when p->>'place' = 'lab' then 'lab' else 'shop' end;
  pt := case when pl = 'lab' and p->>'part' in ('screen','battery','port','part','tool') then p->>'part' else '' end;
  q := case when coalesce(p->>'qty','') ~ '^\d{1,4}$' and (p->>'qty')::int > 0 then (p->>'qty')::int end;
  v_id := nullif(p->>'id','')::uuid;
  if v_id is null then
    if nm = '' then raise exception 'empty'; end if;
    -- אותו מוצר כבר פתוח (באותו מקום)? מעדכנים אותו במקום כפילות
    select * into x from kb_stock where shop_id = p_shop and place = pl and lower(name) = lower(nm) and status in ('out','low','ordered') and deleted_at is null limit 1;
    if x.id is not null then
      update kb_stock set status = st, note = coalesce(nullif(left(p->>'note',500),''), note), company_id = coalesce(kb_company(p_shop, p->>'company_id'), company_id),
        qty = coalesce(q, qty), status_by_name = kb_me_name(), updated_at = now() where id = x.id returning * into x;
      return row_to_json(x);
    end if;
    insert into kb_stock(shop_id, name, company_id, status, note, place, part, qty, created_by, created_by_name, status_by_name)
      values (p_shop, nm, kb_company(p_shop, p->>'company_id'), st, left(coalesce(p->>'note',''),500), pl, pt, q, auth.uid(), kb_me_name(), kb_me_name())
      returning * into x;
  else
    update kb_stock set name = coalesce(nullif(nm,''), name), company_id = case when p ? 'company_id' then kb_company(p_shop, p->>'company_id') else company_id end,
      status = st, note = case when p ? 'note' then left(coalesce(p->>'note',''),500) else note end,
      qty = case when p ? 'qty' then q else qty end,
      status_by_name = case when status <> st then kb_me_name() else status_by_name end, updated_at = now()
    where id = v_id and shop_id = p_shop returning * into x;
  end if;
  return row_to_json(x);
end $$;
