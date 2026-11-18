-- מידע לחנות (meida): מאגר מידע משותף לעובדי החנות.
-- כל הגישה דרך פונקציות kb_* (security definer). אין גישה ישירה לטבלאות. אין פקודות delete: מחיקה = deleted_at.

create extension if not exists pgcrypto;

create table if not exists public.kb_shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null,
  join_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  allow_join boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kb_members (
  shop_id uuid not null references public.kb_shops(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member' check (role in ('owner','admin','member')),
  status text not null default 'pending' check (status in ('pending','active','removed','left')),
  email text, name text, avatar text,
  joined_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);
create index if not exists kb_members_user_idx on public.kb_members(user_id);

-- תגיות: חברה (company), מכשיר (device), נושא (topic). מכשיר יכול להשתייך לחברה (parent_id).
create table if not exists public.kb_tags (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.kb_shops(id) on delete cascade,
  kind text not null check (kind in ('company','device','topic')),
  name text not null,
  emoji text,
  parent_id uuid,
  sort int not null default 0,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists kb_tags_shop_idx on public.kb_tags(shop_id);

create table if not exists public.kb_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.kb_shops(id) on delete cascade,
  type text not null default 'note',
  title text not null default '',
  body text not null default '',
  fields jsonb not null default '{}'::jsonb,
  tag_ids uuid[] not null default '{}',
  photos text[] not null default '{}',
  pinned boolean not null default false,
  source text,
  created_by uuid, created_by_name text,
  updated_by uuid, updated_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists kb_items_shop_idx on public.kb_items(shop_id, updated_at);

create table if not exists public.kb_history (
  id bigserial primary key,
  item_id uuid not null,
  shop_id uuid not null,
  action text not null,
  snapshot jsonb not null,
  by_id uuid, by_name text,
  at timestamptz not null default now()
);
create index if not exists kb_history_item_idx on public.kb_history(item_id, at desc);

alter table public.kb_shops enable row level security;
alter table public.kb_members enable row level security;
alter table public.kb_tags enable row level security;
alter table public.kb_items enable row level security;
alter table public.kb_history enable row level security;
revoke all on public.kb_shops, public.kb_members, public.kb_tags, public.kb_items, public.kb_history from anon, authenticated;

-- ===== עזרים =====
create or replace function public.kb_me_name()
returns text language sql stable as $$
  select left(coalesce(auth.jwt()->'user_metadata'->>'full_name', auth.jwt()->'user_metadata'->>'name', split_part(auth.jwt()->>'email','@',1), ''), 80);
$$;

-- התפקיד שלי בחנות (רק חבר פעיל), אחרת null
create or replace function public.kb_role(p_shop uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from kb_members where shop_id = p_shop and user_id = auth.uid() and status = 'active';
$$;
revoke all on function public.kb_role(uuid) from public, anon;

create or replace function public.kb_need(p_shop uuid, p_admin boolean default false)
returns text language plpgsql stable security definer set search_path = public as $$
declare r text;
begin
  if auth.uid() is null then raise exception 'signin'; end if;
  r := kb_role(p_shop);
  if r is null then raise exception 'not-member'; end if;
  if p_admin and r not in ('owner','admin') then raise exception 'not-admin'; end if;
  return r;
end $$;
revoke all on function public.kb_need(uuid, boolean) from public, anon, authenticated;

-- ===== חנויות =====
create or replace function public.kb_my_shops()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', s.id, 'name', s.name, 'role', m.role, 'status', m.status) order by s.updated_at desc), '[]'::json)
  from kb_members m join kb_shops s on s.id = m.shop_id
  where m.user_id = auth.uid() and m.status in ('active','pending');
$$;

create or replace function public.kb_seed_tags(p_shop uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c record; i int := 0;
begin
  for c in select * from (values
    ('company','Apple','🍎'),('company','Samsung','📱'),('company','Xiaomi','📱'),('company','Google','📱'),
    ('company','Motorola','📱'),('company','Nokia','📱'),('company','OnePlus','📱'),('company','Huawei','📱'),
    ('company','פרטנר','📶'),('company','סלקום','📶'),('company','פלאפון','📶'),('company','הוט מובייל','📶'),
    ('company','גולן טלקום','📶'),('company','019','📶'),('company','012','📶'),('company','רמי לוי','📶'),('company','וי קום','📶'),
    ('topic','IMEI','🔢'),('topic','קודים וסיסמאות','🔑'),('topic','נקודות שירות','📍'),('topic','מעבדות ותיקונים','🔧'),
    ('topic','אחריות','🛡️'),('topic','ניוד מספר','🔄'),('topic','סים / eSIM','💳'),('topic','הגדרות','⚙️'),
    ('topic','פריצה / נעילה','🔓'),('topic','חשבון Google / iCloud','☁️'),('topic','מחירים ומבצעים','🏷️'),
    ('topic','ספקים','🚚'),('topic','טלפונים חשובים','☎️'),('topic','נהלי חנות','📋'),('topic','כשרים','✡️')
  ) as t(kind, name, emoji) loop
    i := i + 1;
    insert into kb_tags(shop_id, kind, name, emoji, sort) values (p_shop, c.kind, c.name, c.emoji, i);
  end loop;
end $$;
revoke all on function public.kb_seed_tags(uuid) from public, anon, authenticated;

create or replace function public.kb_create_shop(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'signin'; end if;
  insert into kb_shops(name, owner_id) values (left(coalesce(nullif(trim(p_name),''),'החנות'),60), auth.uid()) returning id into v_id;
  insert into kb_members(shop_id, user_id, role, status, email, name, avatar)
    values (v_id, auth.uid(), 'owner', 'active', auth.jwt()->>'email', kb_me_name(), auth.jwt()->'user_metadata'->>'avatar_url');
  perform kb_seed_tags(v_id);
  return v_id;
end $$;

-- דף הצטרפות: מה שם החנות לפי הקוד
create or replace function public.kb_join_info(p_code text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('id', s.id, 'name', s.name, 'allow_join', s.allow_join,
    'owner_name', (select name from kb_members where shop_id = s.id and user_id = s.owner_id),
    'my_status', (select status from kb_members where shop_id = s.id and user_id = auth.uid()))
  from kb_shops s where s.join_code = p_code;
$$;

-- בקשת הצטרפות: נכנסים כ"ממתין" עד שמנהל מאשר
create or replace function public.kb_join(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare s kb_shops; m kb_members;
begin
  if auth.uid() is null then raise exception 'signin'; end if;
  select * into s from kb_shops where join_code = p_code;
  if s.id is null then return json_build_object('error','missing'); end if;
  select * into m from kb_members where shop_id = s.id and user_id = auth.uid();
  if m.status in ('active','pending') then return json_build_object('ok', true, 'id', s.id, 'status', m.status); end if;
  if m.status = 'removed' then return json_build_object('error','removed'); end if;
  if not s.allow_join then return json_build_object('error','closed'); end if;
  insert into kb_members(shop_id, user_id, role, status, email, name, avatar)
    values (s.id, auth.uid(), 'member', 'pending', auth.jwt()->>'email', kb_me_name(), auth.jwt()->'user_metadata'->>'avatar_url')
  on conflict (shop_id, user_id) do update set status = 'pending', role = 'member', email = excluded.email, name = excluded.name, avatar = excluded.avatar, joined_at = now();
  return json_build_object('ok', true, 'id', s.id, 'status', 'pending');
end $$;

-- כל מה שצריך כדי לפתוח את האפליקציה. p_since = רק מה שהשתנה מאז (כולל מחוקים) לסנכרון מהיר.
create or replace function public.kb_load(p_shop uuid, p_since timestamptz default null)
returns json language plpgsql stable security definer set search_path = public as $$
declare r text; s kb_shops;
begin
  r := kb_need(p_shop);
  select * into s from kb_shops where id = p_shop;
  return json_build_object(
    'now', now(),
    'shop', json_build_object('id', s.id, 'name', s.name, 'join_code', case when r in ('owner','admin') then s.join_code end,
      'allow_join', s.allow_join, 'role', r,
      'pending', case when r in ('owner','admin') then (select count(*) from kb_members where shop_id = s.id and status = 'pending') else 0 end),
    'tags', coalesce((select json_agg(t order by t.sort, t.name) from kb_tags t where t.shop_id = p_shop
        and (p_since is null and t.deleted_at is null or p_since is not null and t.updated_at > p_since)), '[]'::json),
    'items', coalesce((select json_agg(i order by i.updated_at desc) from kb_items i where i.shop_id = p_shop
        and (p_since is null and i.deleted_at is null or p_since is not null and i.updated_at > p_since)), '[]'::json)
  );
end $$;

-- ===== פריטי מידע =====
create or replace function public.kb_clean_item(p_shop uuid, p jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'type', left(coalesce(nullif(p->>'type',''),'note'),20),
    'title', left(coalesce(p->>'title',''),200),
    'body', left(coalesce(p->>'body',''),20000),
    'fields', case when jsonb_typeof(p->'fields') = 'object' then p->'fields' else '{}'::jsonb end,
    'tag_ids', coalesce((select jsonb_agg(t.id) from kb_tags t where t.shop_id = p_shop and t.deleted_at is null
        and t.id::text in (select jsonb_array_elements_text(case when jsonb_typeof(p->'tag_ids') = 'array' then p->'tag_ids' else '[]'::jsonb end))), '[]'::jsonb),
    'photos', coalesce((select jsonb_agg(x) from jsonb_array_elements_text(case when jsonb_typeof(p->'photos') = 'array' then p->'photos' else '[]'::jsonb end) x
        where x ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/kb-photos/'), '[]'::jsonb),
    'pinned', coalesce((p->>'pinned')::boolean, false)
  );
$$;
revoke all on function public.kb_clean_item(uuid, jsonb) from public, anon, authenticated;

create or replace function public.kb_save_item(p_shop uuid, p_item jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare c jsonb; v_id uuid; r kb_items; is_new boolean;
begin
  perform kb_need(p_shop);
  c := kb_clean_item(p_shop, p_item);
  v_id := nullif(p_item->>'id','')::uuid;
  is_new := v_id is null or not exists (select 1 from kb_items where id = v_id and shop_id = p_shop);
  if is_new then
    insert into kb_items(id, shop_id, type, title, body, fields, tag_ids, photos, pinned, source, created_by, created_by_name, updated_by, updated_by_name)
    values (coalesce(v_id, gen_random_uuid()), p_shop, c->>'type', c->>'title', c->>'body', c->'fields',
      array(select jsonb_array_elements_text(c->'tag_ids'))::uuid[], array(select jsonb_array_elements_text(c->'photos')),
      (c->>'pinned')::boolean, left(p_item->>'source',40), auth.uid(), kb_me_name(), auth.uid(), kb_me_name())
    returning * into r;
  else
    update kb_items set type = c->>'type', title = c->>'title', body = c->>'body', fields = c->'fields',
      tag_ids = array(select jsonb_array_elements_text(c->'tag_ids'))::uuid[], photos = array(select jsonb_array_elements_text(c->'photos')),
      pinned = (c->>'pinned')::boolean, updated_by = auth.uid(), updated_by_name = kb_me_name(), updated_at = now(), deleted_at = null
    where id = v_id and shop_id = p_shop returning * into r;
  end if;
  insert into kb_history(item_id, shop_id, action, snapshot, by_id, by_name)
    values (r.id, p_shop, case when is_new then 'create' else 'edit' end, to_jsonb(r), auth.uid(), kb_me_name());
  update kb_shops set updated_at = now() where id = p_shop;
  return row_to_json(r);
end $$;

-- שמירה של הרבה פריטים בבת אחת (ייבוא מוואטסאפ)
create or replace function public.kb_save_items(p_shop uuid, p_items jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare x jsonb; n int := 0;
begin
  perform kb_need(p_shop);
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 300 then raise exception 'bad items'; end if;
  for x in select * from jsonb_array_elements(p_items) loop
    perform kb_save_item(p_shop, x - 'id');
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.kb_pin_item(p_shop uuid, p_id uuid, p_pinned boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  update kb_items set pinned = p_pinned, updated_at = now() where id = p_id and shop_id = p_shop;
end $$;

-- מחיקה: רק מנהל. אפשר לשחזר.
create or replace function public.kb_delete_item(p_shop uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r kb_items;
begin
  perform kb_need(p_shop, true);
  update kb_items set deleted_at = now(), updated_at = now(), updated_by = auth.uid(), updated_by_name = kb_me_name()
    where id = p_id and shop_id = p_shop returning * into r;
  if r.id is not null then
    insert into kb_history(item_id, shop_id, action, snapshot, by_id, by_name) values (r.id, p_shop, 'delete', to_jsonb(r), auth.uid(), kb_me_name());
  end if;
end $$;

create or replace function public.kb_deleted_items(p_shop uuid)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform kb_need(p_shop, true);
  return coalesce((select json_agg(i order by i.deleted_at desc) from kb_items i where i.shop_id = p_shop and i.deleted_at is not null), '[]'::json);
end $$;

create or replace function public.kb_restore_item(p_shop uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r kb_items;
begin
  perform kb_need(p_shop, true);
  update kb_items set deleted_at = null, updated_at = now() where id = p_id and shop_id = p_shop returning * into r;
  if r.id is not null then
    insert into kb_history(item_id, shop_id, action, snapshot, by_id, by_name) values (r.id, p_shop, 'restore', to_jsonb(r), auth.uid(), kb_me_name());
  end if;
end $$;

create or replace function public.kb_item_history(p_shop uuid, p_id uuid)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  return coalesce((select json_agg(json_build_object('id', h.id, 'action', h.action, 'snapshot', h.snapshot, 'by_name', h.by_name, 'at', h.at) order by h.at desc)
    from kb_history h where h.shop_id = p_shop and h.item_id = p_id), '[]'::json);
end $$;

-- ===== תגיות =====
create or replace function public.kb_save_tag(p_shop uuid, p_tag jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; r kb_tags; k text; nm text; par uuid;
begin
  perform kb_need(p_shop);
  k := p_tag->>'kind';
  if k not in ('company','device','topic') then raise exception 'bad kind'; end if;
  nm := left(trim(coalesce(p_tag->>'name','')),60);
  if nm = '' then raise exception 'empty name'; end if;
  par := (select id from kb_tags where id = nullif(p_tag->>'parent_id','')::uuid and shop_id = p_shop and kind = 'company');
  v_id := nullif(p_tag->>'id','')::uuid;
  if v_id is null then
    -- לא ליצור כפילות של אותו שם
    select * into r from kb_tags where shop_id = p_shop and kind = k and lower(name) = lower(nm) and deleted_at is null limit 1;
    if r.id is not null then return row_to_json(r); end if;
    insert into kb_tags(shop_id, kind, name, emoji, parent_id, sort)
      values (p_shop, k, nm, left(p_tag->>'emoji',8), par, coalesce((select max(sort)+1 from kb_tags where shop_id = p_shop), 1))
      returning * into r;
  else
    update kb_tags set name = nm, emoji = left(p_tag->>'emoji',8), parent_id = par, kind = k,
      sort = coalesce((p_tag->>'sort')::int, sort), updated_at = now(), deleted_at = null
    where id = v_id and shop_id = p_shop returning * into r;
  end if;
  return row_to_json(r);
end $$;

create or replace function public.kb_delete_tag(p_shop uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform kb_need(p_shop, true);
  update kb_tags set deleted_at = now(), updated_at = now() where id = p_id and shop_id = p_shop;
end $$;

-- ===== עובדים =====
create or replace function public.kb_members_list(p_shop uuid)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  return coalesce((select json_agg(json_build_object('user_id', m.user_id, 'name', m.name, 'email', m.email, 'avatar', m.avatar,
      'role', m.role, 'status', m.status, 'me', m.user_id = auth.uid(), 'joined_at', m.joined_at,
      'count', (select count(*) from kb_items i where i.shop_id = p_shop and i.created_by = m.user_id and i.deleted_at is null))
    order by (m.status = 'pending') desc, case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.joined_at)
    from kb_members m where m.shop_id = p_shop and m.status in ('active','pending')), '[]'::json);
end $$;

-- מנהל: אישור / הסרה / הפיכה למנהל. p_action: approve, remove, admin, member
create or replace function public.kb_set_member(p_shop uuid, p_user uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare me text; target kb_members;
begin
  me := kb_need(p_shop, true);
  select * into target from kb_members where shop_id = p_shop and user_id = p_user;
  if target.user_id is null or target.role = 'owner' then raise exception 'not allowed'; end if;
  if p_action in ('admin','member') and me <> 'owner' then raise exception 'owner only'; end if;
  if p_action = 'approve' then update kb_members set status = 'active' where shop_id = p_shop and user_id = p_user;
  elsif p_action = 'remove' then update kb_members set status = 'removed', role = 'member' where shop_id = p_shop and user_id = p_user;
  elsif p_action = 'admin' then update kb_members set role = 'admin' where shop_id = p_shop and user_id = p_user and status = 'active';
  elsif p_action = 'member' then update kb_members set role = 'member' where shop_id = p_shop and user_id = p_user;
  else raise exception 'bad action'; end if;
end $$;

create or replace function public.kb_leave(p_shop uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'signin'; end if;
  update kb_members set status = 'left' where shop_id = p_shop and user_id = auth.uid() and role <> 'owner';
end $$;

create or replace function public.kb_update_shop(p_shop uuid, p_name text, p_allow_join boolean, p_new_code boolean default false)
returns json language plpgsql security definer set search_path = public as $$
declare s kb_shops;
begin
  perform kb_need(p_shop, true);
  update kb_shops set name = coalesce(nullif(left(trim(p_name),60),''), name), allow_join = coalesce(p_allow_join, allow_join),
    join_code = case when p_new_code then encode(gen_random_bytes(6), 'hex') else join_code end, updated_at = now()
  where id = p_shop returning * into s;
  return json_build_object('name', s.name, 'allow_join', s.allow_join, 'join_code', s.join_code);
end $$;

-- גישה לשרת ה-AI: האם המשתמש חבר פעיל
create or replace function public.kb_is_member(p_shop uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select kb_role(p_shop) is not null;
$$;

do $$
declare f text;
begin
  foreach f in array array['kb_my_shops()','kb_create_shop(text)','kb_join_info(text)','kb_join(text)','kb_load(uuid,timestamptz)',
    'kb_save_item(uuid,jsonb)','kb_save_items(uuid,jsonb)','kb_pin_item(uuid,uuid,boolean)','kb_delete_item(uuid,uuid)','kb_deleted_items(uuid)',
    'kb_restore_item(uuid,uuid)','kb_item_history(uuid,uuid)','kb_save_tag(uuid,jsonb)','kb_delete_tag(uuid,uuid)','kb_members_list(uuid)',
    'kb_set_member(uuid,uuid,text)','kb_leave(uuid)','kb_update_shop(uuid,text,boolean,boolean)','kb_is_member(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- תמונות (צילומי מסך, כרטיסי ביקור…): שמות אקראיים, רק משתמשים מחוברים מעלים
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kb-photos','kb-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'kb photos upload') then
    create policy "kb photos upload" on storage.objects for insert to authenticated with check (bucket_id = 'kb-photos');
  end if;
end $$;
