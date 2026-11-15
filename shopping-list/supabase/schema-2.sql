-- שלב 2: חלוקה בין אנשים, סניפים עם סדר מחלקות, היסטוריית מחירים, סיכומי קניות, התראות

alter table public.sl_lists add column if not exists assignments jsonb not null default '{}'::jsonb; -- {מחלקה: שם}
alter table public.sl_lists add column if not exists stores jsonb not null default '[]'::jsonb;      -- [{id,name,order:[...]}]
alter table public.sl_lists add column if not exists store_id text;
alter table public.sl_items add column if not exists assigned_to text;

create table if not exists public.sl_prices (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.sl_lists(id) on delete cascade,
  item_id uuid unique,
  key text not null,
  name text not null,
  price numeric not null,
  qty numeric,
  unit text,
  store text,
  at timestamptz not null default now()
);
create index if not exists sl_prices_key_idx on public.sl_prices(list_id, key, at desc);

create table if not exists public.sl_trips (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.sl_lists(id) on delete cascade,
  total numeric not null default 0,
  found int not null default 0,
  missing int not null default 0,
  store text,
  at timestamptz not null default now()
);

create table if not exists public.sl_push (
  endpoint text primary key,
  list_id uuid not null references public.sl_lists(id) on delete cascade,
  name text,
  sub jsonb not null,
  at timestamptz not null default now()
);

alter table public.sl_prices enable row level security;
alter table public.sl_trips enable row level security;
alter table public.sl_push enable row level security;
revoke all on public.sl_prices, public.sl_trips, public.sl_push from anon, authenticated;

create or replace function public.sl_store_name(p_list uuid)
returns text language sql stable security definer set search_path = public as $$
  select s->>'name' from sl_lists l, jsonb_array_elements(l.stores) s
  where l.id = p_list and s->>'id' = l.store_id limit 1;
$$;

create or replace function public.sl_update_list(p_list uuid, p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare r sl_lists;
begin
  update sl_lists set
    name        = case when p ? 'name' then left(coalesce(nullif(trim(p->>'name'),''),'רשימת קניות'),80) else name end,
    assignments = case when p ? 'assignments' then coalesce(p->'assignments','{}'::jsonb) else assignments end,
    stores      = case when p ? 'stores' then coalesce(p->'stores','[]'::jsonb) else stores end,
    store_id    = case when p ? 'store_id' then nullif(p->>'store_id','') else store_id end,
    updated_at  = now()
  where id = p_list returning * into r;
  return row_to_json(r);
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
  if r.id is not null and (p ? 'price' or p ? 'qty' or p ? 'found_qty') then
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

-- קנייה חדשה: שומר סיכום, מוחק מה שנמצא, מחזיר חסרים ל"צריך"
create or replace function public.sl_new_trip(p_list uuid, p_clear_all boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from sl_items where list_id = p_list and status in ('found','partial')) then
    insert into sl_trips(list_id,total,found,missing,store)
    select p_list, coalesce(sum(price),0), count(*) filter (where status in ('found','partial')),
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

-- מחירים קודמים: לכל מוצר עד 5 הקניות האחרונות (בלי הקנייה הנוכחית)
create or replace function public.sl_price_history(p_list uuid)
returns json language sql security definer set search_path = public as $$
  select coalesce(json_object_agg(key, rows), '{}'::json) from (
    select key, json_agg(json_build_object('price',price,'qty',qty,'unit',unit,'store',store,'at',at) order by at desc) as rows
    from (
      select p.*, row_number() over (partition by key order by at desc) rn
      from sl_prices p
      where p.list_id = p_list and not exists (select 1 from sl_items i where i.id = p.item_id)
    ) x where rn <= 5 group by key
  ) y;
$$;

create or replace function public.sl_trips_list(p_list uuid)
returns setof public.sl_trips language sql security definer set search_path = public as $$
  select * from sl_trips where list_id = p_list order by at desc limit 12;
$$;

create or replace function public.sl_push_save(p_list uuid, p_sub jsonb, p_name text)
returns void language sql security definer set search_path = public as $$
  insert into sl_push(endpoint,list_id,name,sub) values (p_sub->>'endpoint', p_list, left(p_name,40), p_sub)
  on conflict (endpoint) do update set list_id = excluded.list_id, name = excluded.name, sub = excluded.sub, at = now();
$$;

create or replace function public.sl_push_delete(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from sl_push where endpoint = p_endpoint;
$$;

create or replace function public.sl_push_targets(p_list uuid, p_except text)
returns table(endpoint text, sub jsonb) language sql security definer set search_path = public as $$
  select endpoint, sub from sl_push where list_id = p_list and coalesce(name,'') <> coalesce(p_except,'');
$$;

revoke all on function public.sl_store_name(uuid), public.sl_update_list(uuid,jsonb), public.sl_price_history(uuid),
  public.sl_trips_list(uuid), public.sl_push_save(uuid,jsonb,text), public.sl_push_delete(text),
  public.sl_push_targets(uuid,text) from public;
grant execute on function public.sl_update_list(uuid,jsonb), public.sl_price_history(uuid),
  public.sl_trips_list(uuid), public.sl_push_save(uuid,jsonb,text), public.sl_push_delete(text),
  public.sl_push_targets(uuid,text) to anon, authenticated;
