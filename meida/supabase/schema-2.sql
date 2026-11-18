-- שדרוג 2: לוח הודעות/משימות/מבצעים/מלאי, תזכורות, התראות לטלפון, "חסר במאגר", פרטי חנות.
-- (הסוד של התזכורות נשמר בטבלה kb_config — לא בקובץ הזה)

alter table public.kb_shops add column if not exists city text;
alter table public.kb_shops add column if not exists phone text;
alter table public.kb_members add column if not exists posts_seen_at timestamptz not null default now();
alter table public.kb_members add column if not exists notify boolean not null default true;

create table if not exists public.kb_posts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.kb_shops(id) on delete cascade,
  kind text not null default 'message' check (kind in ('message','promo','stock','task','reminder')),
  title text not null default '',
  body text not null default '',
  photos text[] not null default '{}',
  status text not null default 'open' check (status in ('open','done')),
  due date,
  remind_at timestamptz,
  remind_to text not null default 'all' check (remind_to in ('all','me')),
  reminded_at timestamptz,
  pinned boolean not null default false,
  author_id uuid, author_name text,
  done_by_name text, done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists kb_posts_shop_idx on public.kb_posts(shop_id, updated_at);
create index if not exists kb_posts_remind_idx on public.kb_posts(remind_at) where reminded_at is null and deleted_at is null;

create table if not exists public.kb_push (
  endpoint text primary key,
  shop_id uuid not null references public.kb_shops(id) on delete cascade,
  user_id uuid not null,
  p256dh text not null, auth text not null,
  created_at timestamptz not null default now(),
  disabled_at timestamptz
);
create index if not exists kb_push_shop_idx on public.kb_push(shop_id);

create table if not exists public.kb_misses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.kb_shops(id) on delete cascade,
  query text not null, qnorm text not null,
  count int not null default 1,
  last_by_name text, last_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open','done','ignored')),
  unique (shop_id, qnorm)
);

create table if not exists public.kb_config (key text primary key, value text not null);

alter table public.kb_posts enable row level security;
alter table public.kb_push enable row level security;
alter table public.kb_misses enable row level security;
alter table public.kb_config enable row level security;
revoke all on public.kb_posts, public.kb_push, public.kb_misses, public.kb_config from anon, authenticated;

-- ===== פתיחת חנות עם פרטים =====
create or replace function public.kb_create_shop2(p_name text, p_city text, p_phone text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := kb_create_shop(p_name);
  update kb_shops set city = left(nullif(trim(p_city),''),60), phone = left(nullif(trim(p_phone),''),30) where id = v_id;
  return v_id;
end $$;

-- ===== טעינה (עם הודעות) =====
create or replace function public.kb_load(p_shop uuid, p_since timestamptz default null)
returns json language plpgsql stable security definer set search_path = public as $$
declare r text; s kb_shops; m kb_members;
begin
  r := kb_need(p_shop);
  select * into s from kb_shops where id = p_shop;
  select * into m from kb_members where shop_id = p_shop and user_id = auth.uid();
  return json_build_object(
    'now', now(),
    'shop', json_build_object('id', s.id, 'name', s.name, 'city', s.city, 'phone', s.phone,
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
             or p_since is not null and p.updated_at > p_since)), '[]'::json)
  );
end $$;

-- ===== הודעות =====
create or replace function public.kb_save_post(p_shop uuid, p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare r text; v_id uuid; o kb_posts; x kb_posts; k text;
begin
  r := kb_need(p_shop);
  v_id := nullif(p->>'id','')::uuid;
  k := coalesce(nullif(p->>'kind',''),'message');
  if k not in ('message','promo','stock','task','reminder') then k := 'message'; end if;
  if v_id is not null then
    select * into o from kb_posts where id = v_id and shop_id = p_shop;
    if o.id is not null and o.author_id <> auth.uid() and r not in ('owner','admin') then raise exception 'not-admin'; end if;
  end if;
  if o.id is null then
    insert into kb_posts(shop_id, kind, title, body, photos, due, remind_at, remind_to, pinned, author_id, author_name)
    values (p_shop, k, left(coalesce(p->>'title',''),200), left(coalesce(p->>'body',''),8000),
      coalesce(array(select e from jsonb_array_elements_text(coalesce(p->'photos','[]'::jsonb)) e where e ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/kb-photos/'), '{}'),
      nullif(p->>'due','')::date, nullif(p->>'remind_at','')::timestamptz, case when p->>'remind_to' = 'me' then 'me' else 'all' end,
      coalesce((p->>'pinned')::boolean, false), auth.uid(), kb_me_name())
    returning * into x;
  else
    update kb_posts set kind = k, title = left(coalesce(p->>'title',''),200), body = left(coalesce(p->>'body',''),8000),
      photos = coalesce(array(select y from jsonb_array_elements_text(coalesce(p->'photos','[]'::jsonb)) y where y ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/kb-photos/'), '{}'),
      due = nullif(p->>'due','')::date,
      remind_at = nullif(p->>'remind_at','')::timestamptz,
      reminded_at = case when nullif(p->>'remind_at','')::timestamptz is distinct from o.remind_at then null else reminded_at end,
      remind_to = case when p->>'remind_to' = 'me' then 'me' else 'all' end,
      pinned = coalesce((p->>'pinned')::boolean, false), updated_at = now()
    where id = o.id returning * into x;
  end if;
  return row_to_json(x);
end $$;

create or replace function public.kb_post_status(p_shop uuid, p_id uuid, p_status text)
returns json language plpgsql security definer set search_path = public as $$
declare x kb_posts;
begin
  perform kb_need(p_shop);
  if p_status not in ('open','done') then raise exception 'bad status'; end if;
  update kb_posts set status = p_status, done_by_name = case when p_status = 'done' then kb_me_name() end,
    done_at = case when p_status = 'done' then now() end, updated_at = now()
  where id = p_id and shop_id = p_shop returning * into x;
  return row_to_json(x);
end $$;

create or replace function public.kb_delete_post(p_shop uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r text;
begin
  r := kb_need(p_shop);
  update kb_posts set deleted_at = now(), updated_at = now()
  where id = p_id and shop_id = p_shop and (author_id = auth.uid() or r in ('owner','admin'));
  if not found then raise exception 'not-admin'; end if;
end $$;

create or replace function public.kb_seen_posts(p_shop uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  update kb_members set posts_seen_at = now() where shop_id = p_shop and user_id = auth.uid();
end $$;

-- ===== התראות לטלפון =====
create or replace function public.kb_push_save(p_shop uuid, p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  if p_endpoint !~ '^https://' then raise exception 'bad endpoint'; end if;
  insert into kb_push(endpoint, shop_id, user_id, p256dh, auth) values (p_endpoint, p_shop, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update set shop_id = excluded.shop_id, user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, disabled_at = null;
  update kb_members set notify = true where shop_id = p_shop and user_id = auth.uid();
end $$;

-- כיבוי התראות בטלפון הזה (או בכל הטלפונים שלי אם אין endpoint)
create or replace function public.kb_push_off(p_shop uuid, p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  update kb_push set disabled_at = now() where shop_id = p_shop and user_id = auth.uid() and (p_endpoint is null or endpoint = p_endpoint);
  if p_endpoint is null then update kb_members set notify = false where shop_id = p_shop and user_id = auth.uid(); end if;
end $$;

-- למי לשלוח התראה על הודעה חדשה: רק הכותב, ורק בדקות הראשונות
create or replace function public.kb_post_targets(p_shop uuid, p_post uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare x kb_posts;
begin
  perform kb_need(p_shop);
  select * into x from kb_posts where id = p_post and shop_id = p_shop and author_id = auth.uid() and created_at > now() - interval '5 minutes' and deleted_at is null;
  if x.id is null or x.remind_to = 'me' then return '[]'::json; end if;
  return coalesce((select json_agg(json_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
    from kb_push s join kb_members m on m.shop_id = s.shop_id and m.user_id = s.user_id
    where s.shop_id = p_shop and s.disabled_at is null and m.status = 'active' and m.notify and s.user_id <> auth.uid()), '[]'::json);
end $$;

create or replace function public.kb_push_drop(p_endpoints text[])
returns void language sql security definer set search_path = public as $$
  update kb_push set disabled_at = now() where endpoint = any(p_endpoints)
    and shop_id in (select shop_id from kb_members where user_id = auth.uid() and status = 'active');
$$;

-- תזכורות שהגיע זמנן (נקרא כל 5 דקות מהשרת, עם סוד)
create or replace function public.kb_cron_due(p_secret text)
returns json language plpgsql security definer set search_path = public as $$
declare out json;
begin
  if p_secret is null or p_secret <> (select value from kb_config where key = 'cron_secret') then raise exception 'bad secret'; end if;
  with due as (
    update kb_posts set reminded_at = now()
    where remind_at <= now() and remind_at > now() - interval '1 day' and reminded_at is null and deleted_at is null and status = 'open'
    returning *
  )
  select coalesce(json_agg(json_build_object(
    'id', d.id, 'shop_id', d.shop_id, 'kind', d.kind, 'title', d.title, 'body', left(d.body, 200), 'author_name', d.author_name,
    'targets', coalesce((select json_agg(json_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from kb_push s join kb_members m on m.shop_id = s.shop_id and m.user_id = s.user_id
      where s.shop_id = d.shop_id and s.disabled_at is null and m.status = 'active' and m.notify
        and (d.remind_to = 'all' or s.user_id = d.author_id)), '[]'::json))), '[]'::json) into out
  from due d;
  return out;
end $$;

create or replace function public.kb_cron_drop(p_secret text, p_endpoints text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_secret is null or p_secret <> (select value from kb_config where key = 'cron_secret') then raise exception 'bad secret'; end if;
  update kb_push set disabled_at = now() where endpoint = any(p_endpoints);
end $$;

-- ===== חסר במאגר =====
create or replace function public.kb_miss(p_shop uuid, p_query text)
returns void language plpgsql security definer set search_path = public as $$
declare q text; n text;
begin
  perform kb_need(p_shop);
  q := left(trim(coalesce(p_query,'')),120);
  n := lower(regexp_replace(q, '\s+', ' ', 'g'));
  if length(n) < 3 then return; end if;
  insert into kb_misses(shop_id, query, qnorm, last_by_name) values (p_shop, q, n, kb_me_name())
  on conflict (shop_id, qnorm) do update set count = kb_misses.count + 1, last_by_name = excluded.last_by_name, last_at = now(),
    status = case when kb_misses.status = 'ignored' then 'ignored' else 'open' end;
end $$;

create or replace function public.kb_misses_list(p_shop uuid)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  return coalesce((select json_agg(m order by m.count desc, m.last_at desc) from kb_misses m where m.shop_id = p_shop and m.status = 'open'), '[]'::json);
end $$;

create or replace function public.kb_miss_set(p_shop uuid, p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  if p_status not in ('open','done','ignored') then raise exception 'bad status'; end if;
  update kb_misses set status = p_status where id = p_id and shop_id = p_shop;
end $$;

do $$
declare f text;
begin
  foreach f in array array['kb_create_shop2(text,text,text)','kb_load(uuid,timestamptz)','kb_save_post(uuid,jsonb)','kb_post_status(uuid,uuid,text)',
    'kb_delete_post(uuid,uuid)','kb_seen_posts(uuid)','kb_push_save(uuid,text,text,text)','kb_push_off(uuid,text)','kb_post_targets(uuid,uuid)',
    'kb_push_drop(text[])','kb_miss(uuid,text)','kb_misses_list(uuid)','kb_miss_set(uuid,uuid,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- התזכורות נקראות מהשרת עם סוד (בלי משתמש)
  revoke all on function public.kb_cron_due(text) from public;
  revoke all on function public.kb_cron_drop(text, text[]) from public;
  grant execute on function public.kb_cron_due(text) to anon, authenticated;
  grant execute on function public.kb_cron_drop(text, text[]) to anon, authenticated;
end $$;
