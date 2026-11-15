-- שלב 3: חשבוניות, ותמונות שנזכרות לפי שם מוצר

alter table public.sl_history add column if not exists image_url text;

create table if not exists public.sl_receipts (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.sl_lists(id) on delete cascade,
  store text,
  bought_on date,
  total numeric,
  lines jsonb not null default '[]'::jsonb,   -- [{name,key,qty,unit,unit_price,total,item_id}]
  photos jsonb not null default '[]'::jsonb,
  by_name text,
  at timestamptz not null default now()
);
create index if not exists sl_receipts_list_idx on public.sl_receipts(list_id, at desc);
alter table public.sl_receipts enable row level security;
revoke all on public.sl_receipts from anon, authenticated;

-- הוספת פריטים: מוצר שכבר הייתה לו תמונה מקבל אותה אוטומטית
create or replace function public.sl_add_items(p_list uuid, p_items jsonb, p_by text)
returns setof public.sl_items language plpgsql security definer set search_path = public as $$
declare it jsonb; existing sl_items; r sl_items;
begin
  if not exists (select 1 from sl_lists where id = p_list) then raise exception 'list not found'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    select * into existing from sl_items
      where list_id = p_list and lower(trim(name)) = lower(trim(it->>'name')) and status <> 'found'
      limit 1;
    if found then
      update sl_items set qty = qty + coalesce((it->>'qty')::numeric,1),
        note = coalesce(nullif(it->>'note',''), note), updated_at = now()
        where id = existing.id returning * into r;
    else
      insert into sl_items(list_id,name,qty,unit,category,emoji,note,added_by,image_url,status,price,found_qty,done_by)
      values (p_list, left(trim(it->>'name'),120), coalesce((it->>'qty')::numeric,1), nullif(it->>'unit',''),
              coalesce(nullif(it->>'category',''),'אחר'), nullif(it->>'emoji',''), nullif(it->>'note',''), left(p_by,40),
              (select h.image_url from sl_history h where h.list_id = p_list and h.key = lower(trim(it->>'name'))),
              coalesce(nullif(it->>'status',''),'need'), (it->>'price')::numeric, (it->>'found_qty')::numeric,
              case when it->>'status' = 'found' then left(p_by,40) end)
      returning * into r;
      if r.price is not null then
        insert into sl_prices(list_id,item_id,key,name,price,qty,unit,store)
        values (p_list, r.id, lower(trim(r.name)), r.name, r.price, coalesce(r.found_qty, r.qty), r.unit, sl_store_name(p_list))
        on conflict (item_id) do nothing;
      end if;
    end if;
    insert into sl_history(list_id,key,name,category,emoji,unit)
      values (p_list, lower(trim(r.name)), r.name, r.category, r.emoji, r.unit)
      on conflict (list_id,key) do update set times = sl_history.times + 1, last_at = now(),
        category = excluded.category, emoji = excluded.emoji;
    return next r;
  end loop;
  update sl_lists set updated_at = now() where id = p_list;
end $$;

create or replace function public.sl_update_item(p_list uuid, p_item uuid, p jsonb)
returns public.sl_items language plpgsql security definer set search_path = public as $$
declare r sl_items;
begin
  update sl_items set
    name      = case when p ? 'name' then left(p->>'name',120) else name end,
    qty       = case when p ? 'qty' then coalesce((p->>'qty')::numeric,1) else qty end,
    unit      = case when p ? 'unit' then nullif(p->>'unit','') else unit end,
    category  = case when p ? 'category' then coalesce(nullif(p->>'category',''),'אחר') else category end,
    emoji     = case when p ? 'emoji' then nullif(p->>'emoji','') else emoji end,
    note      = case when p ? 'note' then nullif(p->>'note','') else note end,
    status    = case when p ? 'status' then p->>'status' else status end,
    found_qty = case when p ? 'found_qty' then (p->>'found_qty')::numeric else found_qty end,
    price     = case when p ? 'price' then (p->>'price')::numeric else price end,
    photo_url = case when p ? 'photo_url' then nullif(p->>'photo_url','') else photo_url end,
    image_url = case when p ? 'image_url' then nullif(p->>'image_url','') else image_url end,
    claimed_by= case when p ? 'claimed_by' then nullif(p->>'claimed_by','') else claimed_by end,
    done_by   = case when p ? 'done_by' then nullif(p->>'done_by','') else done_by end,
    assigned_to = case when p ? 'assigned_to' then nullif(p->>'assigned_to','') else assigned_to end,
    updated_at = now()
  where id = p_item and list_id = p_list
  returning * into r;
  if r.id is null then return r; end if;
  if p ? 'image_url' then
    update sl_history set image_url = r.image_url where list_id = p_list and key = lower(trim(r.name));
  end if;
  if p ? 'price' or p ? 'qty' or p ? 'found_qty' then
    if r.price is null then
      delete from sl_prices where item_id = r.id;
    else
      insert into sl_prices(list_id,item_id,key,name,price,qty,unit,store)
      values (p_list, r.id, lower(trim(r.name)), r.name, r.price, coalesce(nullif(r.found_qty,0), r.qty), r.unit, sl_store_name(p_list))
      on conflict (item_id) do update set price = excluded.price, qty = excluded.qty, unit = excluded.unit,
        name = excluded.name, key = excluded.key, store = excluded.store, at = now();
    end if;
  end if;
  return r;
end $$;

-- שמירת חשבונית. extra = שורות שלא ברשימה, נשמרות רק להיסטוריית מחירים
create or replace function public.sl_save_receipt(p_list uuid, p jsonb, p_by text)
returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid; ln jsonb; st text;
begin
  if not exists (select 1 from sl_lists where id = p_list) then raise exception 'list not found'; end if;
  st := coalesce(nullif(p->>'store',''), sl_store_name(p_list));
  insert into sl_receipts(list_id, store, bought_on, total, lines, photos, by_name)
  values (p_list, left(st,60), nullif(p->>'date','')::date, (p->>'total')::numeric,
          coalesce(p->'lines','[]'::jsonb), coalesce(p->'photos','[]'::jsonb), left(p_by,40))
  returning id into rid;
  for ln in select * from jsonb_array_elements(coalesce(p->'extra','[]'::jsonb)) loop
    if (ln->>'total') is not null and coalesce(ln->>'name','') <> '' then
      insert into sl_prices(list_id,item_id,key,name,price,qty,unit,store)
      values (p_list, null, lower(trim(ln->>'name')), left(ln->>'name',120), (ln->>'total')::numeric,
              coalesce((ln->>'qty')::numeric,1), nullif(ln->>'unit',''), st);
    end if;
  end loop;
  return rid;
end $$;

create or replace function public.sl_receipts_list(p_list uuid)
returns setof public.sl_receipts language sql security definer set search_path = public as $$
  select * from sl_receipts where list_id = p_list order by at desc limit 30;
$$;

create or replace function public.sl_delete_receipt(p_list uuid, p_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from sl_receipts where id = p_id and list_id = p_list;
$$;

-- סיכום קנייה: אם צולמו חשבוניות מאז הקנייה הקודמת — הסכום מהן (מדויק יותר)
create or replace function public.sl_new_trip(p_list uuid, p_clear_all boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_since timestamptz; v_rt numeric;
begin
  select max(at) into v_since from sl_trips where list_id = p_list;
  select sum(total) into v_rt from sl_receipts where list_id = p_list and at > coalesce(v_since, '-infinity'::timestamptz);
  if v_rt is not null or exists (select 1 from sl_items where list_id = p_list and status in ('found','partial')) then
    insert into sl_trips(list_id,total,found,missing,store)
    select p_list, coalesce(v_rt, sum(price), 0), count(*) filter (where status in ('found','partial')),
           count(*) filter (where status in ('missing','partial')), sl_store_name(p_list)
    from sl_items where list_id = p_list;
  end if;
  if p_clear_all then
    delete from sl_items where list_id = p_list;
  else
    delete from sl_items where list_id = p_list and status = 'found';
    update sl_items set status = 'need', found_qty = null, claimed_by = null, done_by = null, price = null,
      assigned_to = null, photo_url = null, updated_at = now()
      where list_id = p_list;
  end if;
  update sl_lists set assignments = '{}'::jsonb where id = p_list;
end $$;

revoke all on function public.sl_save_receipt(uuid,jsonb,text), public.sl_receipts_list(uuid), public.sl_delete_receipt(uuid,uuid) from public;
grant execute on function public.sl_save_receipt(uuid,jsonb,text), public.sl_receipts_list(uuid), public.sl_delete_receipt(uuid,uuid) to anon, authenticated;
