-- שדרוג 3: לוגו לכל חנות, בירור מחיר (עובד שואל עם תמונה, כולם מקבלים התראה, הראשון עונה סכום + הערה)

alter table public.kb_shops add column if not exists logo_url text;

create table if not exists public.kb_asks (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.kb_shops(id) on delete cascade,
  product text not null default '',
  note text not null default '',
  photos text[] not null default '{}',
  status text not null default 'open' check (status in ('open','answered','closed')),
  asked_by uuid, asked_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists kb_asks_shop_idx on public.kb_asks(shop_id, updated_at);

create table if not exists public.kb_answers (
  id uuid primary key default gen_random_uuid(),
  ask_id uuid not null references public.kb_asks(id) on delete cascade,
  shop_id uuid not null,
  price numeric(10,2),
  note text not null default '',
  by_id uuid, by_name text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists kb_answers_ask_idx on public.kb_answers(ask_id);

alter table public.kb_asks enable row level security;
alter table public.kb_answers enable row level security;
revoke all on public.kb_asks, public.kb_answers from anon, authenticated;

create or replace function public.kb_photo_ok(u text)
returns boolean language sql immutable as $$
  select u ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/kb-photos/' or u ~ '^/logos/[a-z0-9-]+\.(png|jpg|webp)$';
$$;

-- לוגו: רק מנהל. ריק = בלי לוגו
create or replace function public.kb_set_logo(p_shop uuid, p_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform kb_need(p_shop, true);
  if p_url is not null and p_url <> '' and not kb_photo_ok(p_url) then raise exception 'bad url'; end if;
  update kb_shops set logo_url = nullif(p_url,''), updated_at = now() where id = p_shop;
end $$;

create or replace function public.kb_my_shops()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', s.id, 'name', s.name, 'logo_url', s.logo_url, 'role', m.role, 'status', m.status) order by s.updated_at desc), '[]'::json)
  from kb_members m join kb_shops s on s.id = m.shop_id
  where m.user_id = auth.uid() and m.status in ('active','pending');
$$;

create or replace function public.kb_join_info(p_code text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('id', s.id, 'name', s.name, 'logo_url', s.logo_url, 'allow_join', s.allow_join,
    'owner_name', (select name from kb_members where shop_id = s.id and user_id = s.owner_id),
    'my_status', (select status from kb_members where shop_id = s.id and user_id = auth.uid()))
  from kb_shops s where s.join_code = p_code;
$$;

create or replace function public.kb_asks_json(p_shop uuid, p_since timestamptz)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
      'id', a.id, 'product', a.product, 'note', a.note, 'photos', a.photos, 'status', a.status,
      'asked_by', a.asked_by, 'asked_by_name', a.asked_by_name, 'created_at', a.created_at, 'updated_at', a.updated_at, 'deleted_at', a.deleted_at,
      'answers', coalesce((select json_agg(json_build_object('id', x.id, 'price', x.price, 'note', x.note, 'by_id', x.by_id, 'by_name', x.by_name, 'created_at', x.created_at) order by x.created_at)
                  from kb_answers x where x.ask_id = a.id and x.deleted_at is null), '[]'::json)
    ) order by a.created_at desc), '[]'::json)
  from kb_asks a where a.shop_id = p_shop
    and (p_since is null and a.deleted_at is null and (a.status = 'open' or a.created_at > now() - interval '60 days')
         or p_since is not null and a.updated_at > p_since);
$$;
revoke all on function public.kb_asks_json(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.kb_load(p_shop uuid, p_since timestamptz default null)
returns json language plpgsql stable security definer set search_path = public as $$
declare r text; s kb_shops; m kb_members;
begin
  r := kb_need(p_shop);
  select * into s from kb_shops where id = p_shop;
  select * into m from kb_members where shop_id = p_shop and user_id = auth.uid();
  return json_build_object(
    'now', now(),
    'shop', json_build_object('id', s.id, 'name', s.name, 'city', s.city, 'phone', s.phone, 'logo_url', s.logo_url,
      'join_code', case when r in ('owner','admin') then s.join_code end,
      'allow_join', s.allow_join, 'role', r, 'seen_at', m.posts_seen_at, 'notify', m.notify,
      'pending', case when r in ('owner','admin') then (select count(*) from kb_members where shop_id = s.id and status = 'pending') else 0 end,
      'misses', (select count(*) from kb_misses where shop_id = s.id and status = 'open')),
    'tags', coalesce((select json_agg(t order by t.sort, t.name) from kb_tags t where t.shop_id = p_shop
        and (p_since is null and t.deleted_at is null or p_since is not null and t.updated_at > p_since)), '[]'::json),
    'items', coalesce((select json_agg(i order by i.updated_at desc) from kb_items i where i.shop_id = p_shop
        and (p_since is null and i.deleted_at is null or p_since is not null and i.updated_at > p_since)), '[]'::json),
    'posts', coalesce((select json_agg(p order by p.created_at desc) from kb_posts p where p.shop_id = p_shop
        and (p.remind_to = 'all' or p.author_id = auth.uid())
        and (p_since is null and p.deleted_at is null and (p.status = 'open' or p.pinned or p.created_at > now() - interval '120 days')
             or p_since is not null and p.updated_at > p_since)), '[]'::json),
    'asks', kb_asks_json(p_shop, p_since)
  );
end $$;

-- ===== בירור מחיר =====
create or replace function public.kb_ask(p_shop uuid, p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare r text; v_id uuid; o kb_asks;
begin
  r := kb_need(p_shop);
  v_id := nullif(p->>'id','')::uuid;
  if v_id is not null then
    select * into o from kb_asks where id = v_id and shop_id = p_shop;
    if o.id is null then raise exception 'missing'; end if;
    if o.asked_by <> auth.uid() and r not in ('owner','admin') then raise exception 'not-admin'; end if;
    update kb_asks set product = left(coalesce(p->>'product',''),200), note = left(coalesce(p->>'note',''),2000),
      photos = coalesce(array(select e from jsonb_array_elements_text(coalesce(p->'photos','[]'::jsonb)) e where kb_photo_ok(e)), '{}'), updated_at = now()
    where id = v_id;
  else
    insert into kb_asks(shop_id, product, note, photos, asked_by, asked_by_name)
    values (p_shop, left(coalesce(p->>'product',''),200), left(coalesce(p->>'note',''),2000),
      coalesce(array(select e from jsonb_array_elements_text(coalesce(p->'photos','[]'::jsonb)) e where kb_photo_ok(e)), '{}'), auth.uid(), kb_me_name())
    returning id into v_id;
  end if;
  return (select j from json_array_elements(kb_asks_json(p_shop, now() - interval '1 minute')) j where j->>'id' = v_id::text);
end $$;

create or replace function public.kb_answer(p_shop uuid, p_ask uuid, p_price numeric, p_note text)
returns json language plpgsql security definer set search_path = public as $$
declare a kb_asks; x kb_answers;
begin
  perform kb_need(p_shop);
  select * into a from kb_asks where id = p_ask and shop_id = p_shop and deleted_at is null;
  if a.id is null then raise exception 'missing'; end if;
  if p_price is null and coalesce(trim(p_note),'') = '' then raise exception 'empty'; end if;
  insert into kb_answers(ask_id, shop_id, price, note, by_id, by_name)
    values (p_ask, p_shop, case when p_price >= 0 and p_price < 10000000 then p_price end, left(coalesce(p_note,''),1000), auth.uid(), kb_me_name())
    returning * into x;
  update kb_asks set status = case when status = 'open' then 'answered' else status end, updated_at = now() where id = p_ask;
  return row_to_json(x);
end $$;

-- סגירה / פתיחה מחדש / מחיקה: מי ששאל או מנהל
create or replace function public.kb_ask_set(p_shop uuid, p_ask uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare r text; a kb_asks;
begin
  r := kb_need(p_shop);
  select * into a from kb_asks where id = p_ask and shop_id = p_shop;
  if a.id is null then raise exception 'missing'; end if;
  if a.asked_by <> auth.uid() and r not in ('owner','admin') then raise exception 'not-admin'; end if;
  if p_action = 'close' then update kb_asks set status = 'closed', updated_at = now() where id = p_ask;
  elsif p_action = 'reopen' then update kb_asks set status = 'open', updated_at = now() where id = p_ask;
  elsif p_action = 'delete' then update kb_asks set deleted_at = now(), updated_at = now() where id = p_ask;
  else raise exception 'bad action'; end if;
end $$;

-- התראות: שאלה חדשה → כל העובדים (חוץ מהשואל). תשובה → למי ששאל.
create or replace function public.kb_ask_targets(p_shop uuid, p_ask uuid, p_answer uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare a kb_asks; x kb_answers;
begin
  perform kb_need(p_shop);
  select * into a from kb_asks where id = p_ask and shop_id = p_shop and deleted_at is null;
  if a.id is null then return '[]'::json; end if;
  if p_answer is null then
    if a.asked_by <> auth.uid() or a.created_at < now() - interval '5 minutes' then return '[]'::json; end if;
    return coalesce((select json_agg(json_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from kb_push s join kb_members m on m.shop_id = s.shop_id and m.user_id = s.user_id
      where s.shop_id = p_shop and s.disabled_at is null and m.status = 'active' and m.notify and s.user_id <> auth.uid()), '[]'::json);
  end if;
  select * into x from kb_answers where id = p_answer and ask_id = p_ask and by_id = auth.uid() and created_at > now() - interval '5 minutes';
  if x.id is null or a.asked_by = auth.uid() then return '[]'::json; end if;
  return coalesce((select json_agg(json_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
    from kb_push s where s.shop_id = p_shop and s.user_id = a.asked_by and s.disabled_at is null), '[]'::json);
end $$;

do $$
declare f text;
begin
  foreach f in array array['kb_set_logo(uuid,text)','kb_my_shops()','kb_join_info(text)','kb_load(uuid,timestamptz)',
    'kb_ask(uuid,jsonb)','kb_answer(uuid,uuid,numeric,text)','kb_ask_set(uuid,uuid,text)','kb_ask_targets(uuid,uuid,uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
