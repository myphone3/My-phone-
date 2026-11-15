-- רשימת קניות משותפת: טבלאות נפרדות (sl_) באותו פרויקט Supabase.
-- הגישה רק דרך פונקציות שמקבלות את מזהה הרשימה (הקישור הסודי) — אין גישה ישירה לטבלאות.

create table if not exists public.sl_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'רשימת קניות',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sl_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.sl_lists(id) on delete cascade,
  name text not null,
  qty numeric not null default 1,
  unit text,
  category text not null default 'אחר',
  emoji text,
  note text,
  status text not null default 'need' check (status in ('need','found','partial','missing','check')),
  found_qty numeric,
  price numeric,
  photo_url text,
  image_url text,
  claimed_by text,
  done_by text,
  added_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sl_items_list_idx on public.sl_items(list_id);

create table if not exists public.sl_history (
  list_id uuid not null references public.sl_lists(id) on delete cascade,
  key text not null,
  name text not null,
  category text,
  emoji text,
  unit text,
  times int not null default 1,
  last_at timestamptz not null default now(),
  primary key (list_id, key)
);

alter table public.sl_lists enable row level security;
alter table public.sl_items enable row level security;
alter table public.sl_history enable row level security;
revoke all on public.sl_lists, public.sl_items, public.sl_history from anon, authenticated;

create or replace function public.sl_create_list(p_name text)
returns uuid language sql security definer set search_path = public as $$
  insert into sl_lists(name) values (coalesce(nullif(trim(p_name),''),'רשימת קניות')) returning id;
$$;

create or replace function public.sl_get_list(p_list uuid)
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'list', (select row_to_json(l) from sl_lists l where l.id = p_list),
    'items', coalesce((select json_agg(i order by i.created_at) from sl_items i where i.list_id = p_list), '[]'::json)
  );
$$;

create or replace function public.sl_rename_list(p_list uuid, p_name text)
returns void language sql security definer set search_path = public as $$
  update sl_lists set name = left(coalesce(nullif(trim(p_name),''),'רשימת קניות'),80), updated_at = now() where id = p_list;
$$;

-- הוספת פריטים (מערך JSON). אם פריט באותו שם כבר פתוח ברשימה — מגדילים כמות במקום לשכפל.
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
      insert into sl_items(list_id,name,qty,unit,category,emoji,note,added_by)
      values (p_list, left(trim(it->>'name'),120), coalesce((it->>'qty')::numeric,1), nullif(it->>'unit',''),
              coalesce(nullif(it->>'category',''),'אחר'), nullif(it->>'emoji',''), nullif(it->>'note',''), left(p_by,40))
      returning * into r;
    end if;
    insert into sl_history(list_id,key,name,category,emoji,unit)
      values (p_list, lower(trim(r.name)), r.name, r.category, r.emoji, r.unit)
      on conflict (list_id,key) do update set times = sl_history.times + 1, last_at = now(),
        category = excluded.category, emoji = excluded.emoji;
    return next r;
  end loop;
  update sl_lists set updated_at = now() where id = p_list;
end $$;

-- עדכון שדות של פריט. רק המפתחות שנשלחו משתנים; null מוחק ערך.
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
    updated_at = now()
  where id = p_item and list_id = p_list
  returning * into r;
  if r.image_url is not null and p ? 'image_url' then
    update sl_history set emoji = coalesce(emoji, r.emoji) where list_id = p_list and key = lower(trim(r.name));
  end if;
  return r;
end $$;

create or replace function public.sl_delete_item(p_list uuid, p_item uuid)
returns void language sql security definer set search_path = public as $$
  delete from sl_items where id = p_item and list_id = p_list;
$$;

-- קנייה חדשה: מוחק מה שנמצא, ומחזיר את החסרים/לבדיקה למצב "צריך"
create or replace function public.sl_new_trip(p_list uuid, p_clear_all boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_clear_all then
    delete from sl_items where list_id = p_list;
  else
    delete from sl_items where list_id = p_list and status = 'found';
    update sl_items set status = 'need', found_qty = null, claimed_by = null, done_by = null, price = null, updated_at = now()
      where list_id = p_list;
  end if;
end $$;

-- מוצרים שקונים הרבה ולא נמצאים עכשיו ברשימה
create or replace function public.sl_suggestions(p_list uuid)
returns setof public.sl_history language sql security definer set search_path = public as $$
  select h.* from sl_history h
  where h.list_id = p_list
    and not exists (select 1 from sl_items i where i.list_id = p_list and lower(trim(i.name)) = h.key)
  order by h.times desc, h.last_at desc limit 24;
$$;

revoke all on function public.sl_create_list(text), public.sl_get_list(uuid), public.sl_rename_list(uuid,text),
  public.sl_add_items(uuid,jsonb,text), public.sl_update_item(uuid,uuid,jsonb), public.sl_delete_item(uuid,uuid),
  public.sl_new_trip(uuid,boolean), public.sl_suggestions(uuid) from public;
grant execute on function public.sl_create_list(text), public.sl_get_list(uuid), public.sl_rename_list(uuid,text),
  public.sl_add_items(uuid,jsonb,text), public.sl_update_item(uuid,uuid,jsonb), public.sl_delete_item(uuid,uuid),
  public.sl_new_trip(uuid,boolean), public.sl_suggestions(uuid) to anon, authenticated;

-- תמונות שמעלים מהחנות
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sl-photos','sl-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "sl photos upload" on storage.objects;
create policy "sl photos upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'sl-photos');
