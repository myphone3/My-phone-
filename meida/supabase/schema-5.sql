-- שדרוג 5: העיצוב החדש.
-- קטגוריות (עם אימוג'י), לוגו לחברות, מלאי, פתקים פתוחים, מבצעים, מוצרים וברקודים, תגובות להודעות,
-- "מי ראה", הודעה דחופה, סוג לשאלות לצוות, הגדרות חנות. הכל דרך פונקציות kb_* (כמו קודם).

-- ===== עמודות חדשות =====
alter table public.kb_tags drop constraint if exists kb_tags_kind_check;
alter table public.kb_tags add constraint kb_tags_kind_check check (kind in ('company','device','topic','category'));
alter table public.kb_tags add column if not exists logo_url text;
alter table public.kb_shops add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.kb_posts add column if not exists urgent boolean not null default false;
alter table public.kb_posts add column if not exists urgent_pushes int not null default 0;
alter table public.kb_posts add column if not exists urgent_last_at timestamptz;
alter table public.kb_asks add column if not exists kind text not null default 'price';
alter table public.kb_asks drop constraint if exists kb_asks_kind_check;
alter table public.kb_asks add constraint kb_asks_kind_check check (kind in ('price','stock','general'));

-- ===== טבלאות חדשות =====
create table if not exists public.kb_stock (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.kb_shops(id) on delete cascade,
  name text not null,
  company_id uuid,
  status text not null default 'out' check (status in ('out','low','ordered','arrived')),
  note text not null default '',
  created_by uuid, created_by_name text,
  status_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists kb_stock_shop_idx on public.kb_stock(shop_id, updated_at);

create table if not exists public.kb_notes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.kb_shops(id) on delete cascade,
  kind text not null default 'check' check (kind in ('check','call','want')),
  title text not null default '',
  customer text not null default '',
  phone text not null default '',
  company_id uuid,
  status text not null default 'waiting' check (status in ('waiting','doing','done')),
  times int not null default 1,
  remind_at timestamptz, reminded_at timestamptz,
  remind_to text not null default 'all' check (remind_to in ('all','me')),
  author_id uuid, author_name text,
  handler_name text, done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists kb_notes_shop_idx on public.kb_notes(shop_id, updated_at);
create index if not exists kb_notes_remind_idx on public.kb_notes(remind_at) where reminded_at is null and deleted_at is null;

create table if not exists public.kb_deals (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.kb_shops(id) on delete cascade,
  title text not null,
  details text not null default '',
  until date,
  by_id uuid, by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists kb_deals_shop_idx on public.kb_deals(shop_id, updated_at);

create table if not exists public.kb_products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.kb_shops(id) on delete cascade,
  name text not null,
  barcode text not null default '',
  price numeric(10,2),
  company_id uuid,
  by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists kb_products_shop_idx on public.kb_products(shop_id, updated_at);

create table if not exists public.kb_replies (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.kb_shops(id) on delete cascade,
  post_id uuid not null references public.kb_posts(id) on delete cascade,
  body text not null,
  by_id uuid, by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists kb_replies_shop_idx on public.kb_replies(shop_id, updated_at);

-- מי ראה: הודעה / פתק / שאלה / דיווח מלאי
create table if not exists public.kb_seen (
  shop_id uuid not null references public.kb_shops(id) on delete cascade,
  ref text not null check (ref in ('post','note','ask','stock')),
  ref_id uuid not null,
  user_id uuid not null,
  name text,
  at timestamptz not null default now(),
  primary key (ref, ref_id, user_id)
);
create index if not exists kb_seen_shop_idx on public.kb_seen(shop_id, at);

alter table public.kb_stock enable row level security;
alter table public.kb_notes enable row level security;
alter table public.kb_deals enable row level security;
alter table public.kb_products enable row level security;
alter table public.kb_replies enable row level security;
alter table public.kb_seen enable row level security;
revoke all on public.kb_stock, public.kb_notes, public.kb_deals, public.kb_products, public.kb_replies, public.kb_seen from anon, authenticated;

-- חברה (תגית) של החנות, או null
create or replace function public.kb_company(p_shop uuid, p_id text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from kb_tags where id = nullif(p_id,'')::uuid and shop_id = p_shop and kind = 'company' and deleted_at is null;
$$;
revoke all on function public.kb_company(uuid, text) from public, anon, authenticated;

-- ===== חנות חדשה: רק קטגוריות בסיס (בלי חברות — מוסיפים לבד) =====
create or replace function public.kb_seed_tags(p_shop uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c record; i int := 0;
begin
  for c in select * from (values
    ('מידע כללי','📚'),('אחריות ותיקונים','🛡️'),('קווים','📶'),('סינונים','✡️'),('קודים וסיסמאות','🔑'),('ספקים','🚚')
  ) as t(name, emoji) loop
    i := i + 1;
    insert into kb_tags(shop_id, kind, name, emoji, sort) values (p_shop, 'category', c.name, c.emoji, i);
  end loop;
end $$;
revoke all on function public.kb_seed_tags(uuid) from public, anon, authenticated;

-- חנויות קיימות בלי קטגוריות: מקבלות את הקטגוריות. התגיות הישנות שאף פריט לא משתמש בהן — יורדות.
do $$
declare s record;
begin
  for s in select id from kb_shops sh where not exists (select 1 from kb_tags t where t.shop_id = sh.id and t.kind = 'category') loop
    update kb_tags t set deleted_at = now(), updated_at = now()
      where t.shop_id = s.id and t.kind in ('company','topic','device') and t.deleted_at is null
        and not exists (select 1 from kb_items i where i.shop_id = s.id and t.id = any(i.tag_ids) and i.deleted_at is null);
    perform kb_seed_tags(s.id);
  end loop;
end $$;

-- ===== תגיות (קטגוריה / חברה) עם לוגו =====
create or replace function public.kb_save_tag(p_shop uuid, p_tag jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; r kb_tags; k text; nm text; par uuid; lg text;
begin
  perform kb_need(p_shop);
  k := p_tag->>'kind';
  if k not in ('company','device','topic','category') then raise exception 'bad kind'; end if;
  nm := left(trim(coalesce(p_tag->>'name','')),60);
  if nm = '' then raise exception 'empty name'; end if;
  par := (select id from kb_tags where id = nullif(p_tag->>'parent_id','')::uuid and shop_id = p_shop and kind = 'company');
  lg := nullif(p_tag->>'logo_url','');
  if lg is not null and not kb_photo_ok(lg) then lg := null; end if;
  v_id := nullif(p_tag->>'id','')::uuid;
  if v_id is null then
    select * into r from kb_tags where shop_id = p_shop and kind = k and lower(name) = lower(nm) and deleted_at is null limit 1;
    if r.id is not null then return row_to_json(r); end if;
    insert into kb_tags(shop_id, kind, name, emoji, parent_id, logo_url, sort)
      values (p_shop, k, nm, left(p_tag->>'emoji',8), par, lg, coalesce((select max(sort)+1 from kb_tags where shop_id = p_shop), 1))
      returning * into r;
  else
    update kb_tags set name = nm, emoji = left(p_tag->>'emoji',8), parent_id = par, kind = k,
      logo_url = case when p_tag ? 'logo_url' then lg else logo_url end,
      sort = coalesce((p_tag->>'sort')::int, sort), updated_at = now(), deleted_at = null
    where id = v_id and shop_id = p_shop returning * into r;
  end if;
  return row_to_json(r);
end $$;

-- סדר חדש לרשימה (מזהים לפי הסדר)
create or replace function public.kb_sort_tags(p_shop uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare i int;
begin
  perform kb_need(p_shop);
  for i in 1 .. coalesce(array_length(p_ids, 1), 0) loop
    update kb_tags set sort = i, updated_at = now() where id = p_ids[i] and shop_id = p_shop;
  end loop;
end $$;

-- הגדרות החנות (שמות סוגי מידע ומצבי מלאי): רק מנהל
create or replace function public.kb_set_settings(p_shop uuid, p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare s kb_shops;
begin
  perform kb_need(p_shop, true);
  if jsonb_typeof(p) <> 'object' or length(p::text) > 20000 then raise exception 'bad settings'; end if;
  update kb_shops set settings = p, updated_at = now() where id = p_shop returning * into s;
  return s.settings;
end $$;

-- ===== טעינה =====
create or replace function public.kb_load(p_shop uuid, p_since timestamptz default null)
returns json language plpgsql stable security definer set search_path = public as $$
declare r text; s kb_shops; m kb_members;
begin
  r := kb_need(p_shop);
  select * into s from kb_shops where id = p_shop;
  select * into m from kb_members where shop_id = p_shop and user_id = auth.uid();
  return json_build_object(
    'now', now(),
    'shop', json_build_object('id', s.id, 'name', s.name, 'city', s.city, 'phone', s.phone, 'logo_url', s.logo_url, 'settings', s.settings,
      'join_code', case when r in ('owner','admin') then s.join_code end,
      'allow_join', s.allow_join, 'role', r, 'seen_at', m.posts_seen_at, 'notify', m.notify,
      'pending', case when r in ('owner','admin') then (select count(*) from kb_members where shop_id = s.id and status = 'pending') else 0 end,
      'misses', (select count(*) from kb_misses where shop_id = s.id and status = 'open')),
    'members', coalesce((select json_agg(json_build_object('user_id', x.user_id, 'name', x.name, 'avatar', x.avatar, 'role', x.role) order by x.joined_at)
        from kb_members x where x.shop_id = p_shop and x.status = 'active'), '[]'::json),
    'tags', coalesce((select json_agg(t order by t.sort, t.name) from kb_tags t where t.shop_id = p_shop
        and (p_since is null and t.deleted_at is null or p_since is not null and t.updated_at > p_since)), '[]'::json),
    'items', coalesce((select json_agg(i order by i.updated_at desc) from kb_items i where i.shop_id = p_shop
        and (p_since is null and i.deleted_at is null or p_since is not null and i.updated_at > p_since)), '[]'::json),
    'posts', coalesce((select json_agg(p order by p.created_at desc) from kb_posts p where p.shop_id = p_shop
        and (p.remind_to = 'all' or p.author_id = auth.uid())
        and (p_since is null and p.deleted_at is null and (p.status = 'open' or p.pinned or p.created_at > now() - interval '120 days')
             or p_since is not null and p.updated_at > p_since)), '[]'::json),
    'asks', kb_asks_json(p_shop, p_since),
    'stock', coalesce((select json_agg(x order by x.updated_at desc) from kb_stock x where x.shop_id = p_shop
        and (p_since is null and x.deleted_at is null and (x.status <> 'arrived' or x.updated_at > now() - interval '30 days')
             or p_since is not null and x.updated_at > p_since)), '[]'::json),
    'notes', coalesce((select json_agg(x order by x.created_at desc) from kb_notes x where x.shop_id = p_shop
        and (x.remind_to = 'all' or x.author_id = auth.uid())
        and (p_since is null and x.deleted_at is null and (x.status <> 'done' or x.updated_at > now() - interval '30 days')
             or p_since is not null and x.updated_at > p_since)), '[]'::json),
    'deals', coalesce((select json_agg(x order by x.created_at desc) from kb_deals x where x.shop_id = p_shop
        and (p_since is null and x.deleted_at is null and (x.until is null or x.until >= current_date - 1)
             or p_since is not null and x.updated_at > p_since)), '[]'::json),
    'products', coalesce((select json_agg(x order by x.name) from kb_products x where x.shop_id = p_shop
        and (p_since is null and x.deleted_at is null or p_since is not null and x.updated_at > p_since)), '[]'::json),
    'replies', coalesce((select json_agg(x order by x.created_at) from kb_replies x where x.shop_id = p_shop
        and (p_since is null and x.deleted_at is null and x.created_at > now() - interval '120 days'
             or p_since is not null and x.updated_at > p_since)), '[]'::json),
    'seen', coalesce((select json_agg(json_build_object('ref', x.ref, 'ref_id', x.ref_id, 'user_id', x.user_id, 'name', x.name, 'at', x.at))
        from kb_seen x where x.shop_id = p_shop and x.at > coalesce(p_since, now() - interval '120 days')), '[]'::json)
  );
end $$;

-- ===== מי ראה =====
create or replace function public.kb_mark_seen(p_shop uuid, p_ref text, p_ids uuid[])
returns json language plpgsql security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  if p_ref not in ('post','note','ask','stock') then raise exception 'bad ref'; end if;
  if coalesce(array_length(p_ids, 1), 0) > 300 then raise exception 'too many'; end if;
  insert into kb_seen(shop_id, ref, ref_id, user_id, name)
    select p_shop, p_ref, x, auth.uid(), kb_me_name() from unnest(p_ids) x
  on conflict do nothing;
  return json_build_object('at', now());
end $$;

-- ===== הודעות: עם "דחוף" =====
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
    insert into kb_posts(shop_id, kind, title, body, photos, due, remind_at, remind_to, pinned, urgent, author_id, author_name)
    values (p_shop, k, left(coalesce(p->>'title',''),200), left(coalesce(p->>'body',''),8000),
      coalesce(array(select e from jsonb_array_elements_text(coalesce(p->'photos','[]'::jsonb)) e where kb_photo_ok(e)), '{}'),
      nullif(p->>'due','')::date, nullif(p->>'remind_at','')::timestamptz, case when p->>'remind_to' = 'me' then 'me' else 'all' end,
      coalesce((p->>'pinned')::boolean, false), coalesce((p->>'urgent')::boolean, false), auth.uid(), kb_me_name())
    returning * into x;
  else
    update kb_posts set kind = k, title = left(coalesce(p->>'title',''),200), body = left(coalesce(p->>'body',''),8000),
      photos = coalesce(array(select y from jsonb_array_elements_text(coalesce(p->'photos','[]'::jsonb)) y where kb_photo_ok(y)), '{}'),
      due = nullif(p->>'due','')::date,
      remind_at = nullif(p->>'remind_at','')::timestamptz,
      reminded_at = case when nullif(p->>'remind_at','')::timestamptz is distinct from o.remind_at then null else reminded_at end,
      remind_to = case when p->>'remind_to' = 'me' then 'me' else 'all' end,
      pinned = coalesce((p->>'pinned')::boolean, false), urgent = coalesce((p->>'urgent')::boolean, urgent), updated_at = now()
    where id = o.id returning * into x;
  end if;
  return row_to_json(x);
end $$;

-- תגובה להודעה
create or replace function public.kb_reply(p_shop uuid, p_post uuid, p_body text)
returns json language plpgsql security definer set search_path = public as $$
declare x kb_replies;
begin
  perform kb_need(p_shop);
  if not exists (select 1 from kb_posts where id = p_post and shop_id = p_shop and deleted_at is null) then raise exception 'missing'; end if;
  if coalesce(trim(p_body),'') = '' then raise exception 'empty'; end if;
  insert into kb_replies(shop_id, post_id, body, by_id, by_name) values (p_shop, p_post, left(trim(p_body),2000), auth.uid(), kb_me_name()) returning * into x;
  update kb_posts set updated_at = now() where id = p_post;
  return row_to_json(x);
end $$;

create or replace function public.kb_delete_reply(p_shop uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r text;
begin
  r := kb_need(p_shop);
  update kb_replies set deleted_at = now(), updated_at = now() where id = p_id and shop_id = p_shop and (by_id = auth.uid() or r in ('owner','admin'));
  if not found then raise exception 'not-admin'; end if;
end $$;

-- ===== מלאי =====
create or replace function public.kb_save_stock(p_shop uuid, p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; x kb_stock; st text; nm text;
begin
  perform kb_need(p_shop);
  st := coalesce(nullif(p->>'status',''),'out');
  if st not in ('out','low','ordered','arrived') then raise exception 'bad status'; end if;
  nm := left(trim(coalesce(p->>'name','')),200);
  v_id := nullif(p->>'id','')::uuid;
  if v_id is null then
    if nm = '' then raise exception 'empty'; end if;
    -- אותו מוצר כבר פתוח? מעדכנים אותו במקום כפילות
    select * into x from kb_stock where shop_id = p_shop and lower(name) = lower(nm) and status in ('out','low','ordered') and deleted_at is null limit 1;
    if x.id is not null then
      update kb_stock set status = st, note = coalesce(nullif(left(p->>'note',500),''), note), company_id = coalesce(kb_company(p_shop, p->>'company_id'), company_id),
        status_by_name = kb_me_name(), updated_at = now() where id = x.id returning * into x;
      return row_to_json(x);
    end if;
    insert into kb_stock(shop_id, name, company_id, status, note, created_by, created_by_name, status_by_name)
      values (p_shop, nm, kb_company(p_shop, p->>'company_id'), st, left(coalesce(p->>'note',''),500), auth.uid(), kb_me_name(), kb_me_name())
      returning * into x;
  else
    update kb_stock set name = coalesce(nullif(nm,''), name), company_id = case when p ? 'company_id' then kb_company(p_shop, p->>'company_id') else company_id end,
      status = st, note = case when p ? 'note' then left(coalesce(p->>'note',''),500) else note end,
      status_by_name = case when status <> st then kb_me_name() else status_by_name end, updated_at = now()
    where id = v_id and shop_id = p_shop returning * into x;
  end if;
  return row_to_json(x);
end $$;

-- כמה בבת אחת (למשל "סמן הכל כהוזמן" לספק)
create or replace function public.kb_stock_status(p_shop uuid, p_ids uuid[], p_status text)
returns json language plpgsql security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  if p_status not in ('out','low','ordered','arrived') then raise exception 'bad status'; end if;
  update kb_stock set status = p_status, status_by_name = kb_me_name(), updated_at = now() where shop_id = p_shop and id = any(p_ids) and deleted_at is null;
  return coalesce((select json_agg(x) from kb_stock x where x.shop_id = p_shop and x.id = any(p_ids)), '[]'::json);
end $$;

create or replace function public.kb_delete_stock(p_shop uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r text;
begin
  r := kb_need(p_shop);
  update kb_stock set deleted_at = now(), updated_at = now() where id = p_id and shop_id = p_shop and (created_by = auth.uid() or r in ('owner','admin'));
  if not found then raise exception 'not-admin'; end if;
end $$;

-- ===== פתקים פתוחים =====
create or replace function public.kb_save_note(p_shop uuid, p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare r text; v_id uuid; o kb_notes; x kb_notes; k text;
begin
  r := kb_need(p_shop);
  k := coalesce(nullif(p->>'kind',''),'check');
  if k not in ('check','call','want') then k := 'check'; end if;
  v_id := nullif(p->>'id','')::uuid;
  if v_id is not null then
    select * into o from kb_notes where id = v_id and shop_id = p_shop;
    if o.id is null then raise exception 'missing'; end if;
  end if;
  if coalesce(trim(p->>'title'),'') = '' then raise exception 'empty'; end if;
  if o.id is null then
    insert into kb_notes(shop_id, kind, title, customer, phone, company_id, remind_at, remind_to, author_id, author_name)
    values (p_shop, k, left(trim(p->>'title'),300), left(coalesce(p->>'customer',''),80), left(coalesce(p->>'phone',''),30),
      kb_company(p_shop, p->>'company_id'), nullif(p->>'remind_at','')::timestamptz, case when p->>'remind_to' = 'me' then 'me' else 'all' end, auth.uid(), kb_me_name())
    returning * into x;
  else
    update kb_notes set kind = k, title = left(trim(p->>'title'),300), customer = left(coalesce(p->>'customer',''),80), phone = left(coalesce(p->>'phone',''),30),
      company_id = kb_company(p_shop, p->>'company_id'), remind_at = nullif(p->>'remind_at','')::timestamptz,
      reminded_at = case when nullif(p->>'remind_at','')::timestamptz is distinct from o.remind_at then null else reminded_at end,
      remind_to = case when p->>'remind_to' = 'me' then 'me' else 'all' end, updated_at = now()
    where id = o.id returning * into x;
  end if;
  return row_to_json(x);
end $$;

-- p_action: doing (אני מטפל), done (טופל), reopen, plus (+1 עוד לקוח ביקש), delete
create or replace function public.kb_note_set(p_shop uuid, p_id uuid, p_action text)
returns json language plpgsql security definer set search_path = public as $$
declare r text; o kb_notes; x kb_notes;
begin
  r := kb_need(p_shop);
  select * into o from kb_notes where id = p_id and shop_id = p_shop and deleted_at is null;
  if o.id is null then raise exception 'missing'; end if;
  if p_action = 'doing' then update kb_notes set status = 'doing', handler_name = kb_me_name(), updated_at = now() where id = p_id returning * into x;
  elsif p_action = 'done' then update kb_notes set status = 'done', handler_name = kb_me_name(), done_at = now(), updated_at = now() where id = p_id returning * into x;
  elsif p_action = 'reopen' then update kb_notes set status = 'waiting', done_at = null, updated_at = now() where id = p_id returning * into x;
  elsif p_action = 'plus' then update kb_notes set times = times + 1, updated_at = now() where id = p_id returning * into x;
  elsif p_action = 'delete' then
    if o.author_id <> auth.uid() and r not in ('owner','admin') then raise exception 'not-admin'; end if;
    update kb_notes set deleted_at = now(), updated_at = now() where id = p_id returning * into x;
  else raise exception 'bad action'; end if;
  return row_to_json(x);
end $$;

-- ===== מבצעים: כל עובד =====
create or replace function public.kb_save_deal(p_shop uuid, p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; x kb_deals;
begin
  perform kb_need(p_shop);
  if coalesce(trim(p->>'title'),'') = '' then raise exception 'empty'; end if;
  v_id := nullif(p->>'id','')::uuid;
  if v_id is null then
    insert into kb_deals(shop_id, title, details, until, by_id, by_name)
      values (p_shop, left(trim(p->>'title'),200), left(coalesce(p->>'details',''),1000), nullif(p->>'until','')::date, auth.uid(), kb_me_name())
      returning * into x;
  else
    update kb_deals set title = left(trim(p->>'title'),200), details = left(coalesce(p->>'details',''),1000), until = nullif(p->>'until','')::date,
      by_id = auth.uid(), by_name = kb_me_name(), updated_at = now(), deleted_at = null
    where id = v_id and shop_id = p_shop returning * into x;
  end if;
  return row_to_json(x);
end $$;

create or replace function public.kb_delete_deal(p_shop uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  update kb_deals set deleted_at = now(), updated_at = now(), by_name = kb_me_name() where id = p_id and shop_id = p_shop;
end $$;

-- ===== מוצרים וברקודים =====
create or replace function public.kb_save_product(p_shop uuid, p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid; x kb_products; bc text; pr numeric;
begin
  perform kb_need(p_shop);
  if coalesce(trim(p->>'name'),'') = '' then raise exception 'empty'; end if;
  bc := left(regexp_replace(coalesce(p->>'barcode',''), '\s', '', 'g'),40);
  pr := case when coalesce(p->>'price','') ~ '^\d+(\.\d+)?$' then (p->>'price')::numeric end;
  v_id := nullif(p->>'id','')::uuid;
  if v_id is null and bc <> '' then
    select id into v_id from kb_products where shop_id = p_shop and barcode = bc and deleted_at is null limit 1;
  end if;
  if v_id is null then
    insert into kb_products(shop_id, name, barcode, price, company_id, by_name)
      values (p_shop, left(trim(p->>'name'),200), bc, pr, kb_company(p_shop, p->>'company_id'), kb_me_name()) returning * into x;
  else
    update kb_products set name = left(trim(p->>'name'),200), barcode = bc, price = pr, company_id = kb_company(p_shop, p->>'company_id'),
      by_name = kb_me_name(), updated_at = now(), deleted_at = null
    where id = v_id and shop_id = p_shop returning * into x;
  end if;
  return row_to_json(x);
end $$;

create or replace function public.kb_delete_product(p_shop uuid, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  update kb_products set deleted_at = now(), updated_at = now() where id = p_id and shop_id = p_shop;
end $$;

-- ===== שאלות לצוות: מחיר / יש לנו? / שאלה =====
create or replace function public.kb_asks_json(p_shop uuid, p_since timestamptz)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
      'id', a.id, 'kind', a.kind, 'product', a.product, 'note', a.note, 'photos', a.photos, 'status', a.status,
      'asked_by', a.asked_by, 'asked_by_name', a.asked_by_name, 'created_at', a.created_at, 'updated_at', a.updated_at, 'deleted_at', a.deleted_at,
      'answers', coalesce((select json_agg(json_build_object('id', x.id, 'price', x.price, 'note', x.note, 'by_id', x.by_id, 'by_name', x.by_name, 'created_at', x.created_at) order by x.created_at)
                  from kb_answers x where x.ask_id = a.id and x.deleted_at is null), '[]'::json)
    ) order by a.created_at desc), '[]'::json)
  from kb_asks a where a.shop_id = p_shop
    and (p_since is null and a.deleted_at is null and (a.status = 'open' or a.created_at > now() - interval '60 days')
         or p_since is not null and a.updated_at > p_since);
$$;
revoke all on function public.kb_asks_json(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.kb_ask(p_shop uuid, p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare r text; v_id uuid; o kb_asks; k text;
begin
  r := kb_need(p_shop);
  k := coalesce(nullif(p->>'kind',''),'price');
  if k not in ('price','stock','general') then k := 'price'; end if;
  v_id := nullif(p->>'id','')::uuid;
  if v_id is not null then
    select * into o from kb_asks where id = v_id and shop_id = p_shop;
    if o.id is null then raise exception 'missing'; end if;
    if o.asked_by <> auth.uid() and r not in ('owner','admin') then raise exception 'not-admin'; end if;
    update kb_asks set kind = k, product = left(coalesce(p->>'product',''),500), note = left(coalesce(p->>'note',''),2000),
      photos = coalesce(array(select e from jsonb_array_elements_text(coalesce(p->'photos','[]'::jsonb)) e where kb_photo_ok(e)), '{}'), updated_at = now()
    where id = v_id;
  else
    insert into kb_asks(shop_id, kind, product, note, photos, asked_by, asked_by_name)
    values (p_shop, k, left(coalesce(p->>'product',''),500), left(coalesce(p->>'note',''),2000),
      coalesce(array(select e from jsonb_array_elements_text(coalesce(p->'photos','[]'::jsonb)) e where kb_photo_ok(e)), '{}'), auth.uid(), kb_me_name())
    returning id into v_id;
  end if;
  return (select j from json_array_elements(kb_asks_json(p_shop, now() - interval '1 minute')) j where j->>'id' = v_id::text);
end $$;

-- ===== התראות לטלפון על דברים חדשים =====
-- p_ref: stock / note (דבר חדש שאני יצרתי עכשיו → כולם חוץ ממני), reply (תגובה שלי → מי שכתב את ההודעה),
-- ack (אישרתי הודעה דחופה → מי שכתב אותה)
create or replace function public.kb_new_targets(p_shop uuid, p_ref text, p_id uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare ok boolean := false; to_user uuid;
begin
  perform kb_need(p_shop);
  if p_ref = 'stock' then
    ok := exists (select 1 from kb_stock where id = p_id and shop_id = p_shop and status_by_name = kb_me_name() and updated_at > now() - interval '5 minutes');
  elsif p_ref = 'note' then
    ok := exists (select 1 from kb_notes where id = p_id and shop_id = p_shop and author_id = auth.uid() and remind_to = 'all' and created_at > now() - interval '5 minutes');
  elsif p_ref = 'reply' then
    select p.author_id into to_user from kb_replies x join kb_posts p on p.id = x.post_id
      where x.id = p_id and x.shop_id = p_shop and x.by_id = auth.uid() and x.created_at > now() - interval '5 minutes';
    if to_user is null or to_user = auth.uid() then return '[]'::json; end if;
  elsif p_ref = 'ack' then
    select p.author_id into to_user from kb_posts p join kb_seen s on s.ref = 'post' and s.ref_id = p.id and s.user_id = auth.uid()
      where p.id = p_id and p.shop_id = p_shop and p.urgent and s.at > now() - interval '5 minutes';
    if to_user is null or to_user = auth.uid() then return '[]'::json; end if;
  else
    return '[]'::json;
  end if;
  if to_user is not null then
    return coalesce((select json_agg(json_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from kb_push s where s.shop_id = p_shop and s.user_id = to_user and s.disabled_at is null), '[]'::json);
  end if;
  if not ok then return '[]'::json; end if;
  return coalesce((select json_agg(json_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
    from kb_push s join kb_members m on m.shop_id = s.shop_id and m.user_id = s.user_id
    where s.shop_id = p_shop and s.disabled_at is null and m.status = 'active' and m.notify and s.user_id <> auth.uid()), '[]'::json);
end $$;

-- ===== תזכורות + הודעה דחופה שחוזרת (נקרא כל 5 דקות מהשרת, עם סוד) =====
create or replace function public.kb_cron_due(p_secret text)
returns json language plpgsql security definer set search_path = public as $$
declare a json; b json; c json;
begin
  if p_secret is null or p_secret <> (select value from kb_config where key = 'cron_secret') then raise exception 'bad secret'; end if;
  -- תזכורות של הודעות
  with due as (
    update kb_posts set reminded_at = now()
    where remind_at <= now() and remind_at > now() - interval '1 day' and reminded_at is null and deleted_at is null and status = 'open'
    returning *
  )
  select coalesce(json_agg(json_build_object(
    'id', d.id, 'shop_id', d.shop_id, 'kind', d.kind, 'title', d.title, 'body', left(d.body, 200), 'author_name', d.author_name,
    'url', '/s/' || d.shop_id || '?board=1',
    'targets', coalesce((select json_agg(json_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from kb_push s join kb_members m on m.shop_id = s.shop_id and m.user_id = s.user_id
      where s.shop_id = d.shop_id and s.disabled_at is null and m.status = 'active' and m.notify
        and (d.remind_to = 'all' or s.user_id = d.author_id)), '[]'::json))), '[]'::json) into a
  from due d;
  -- תזכורות של פתקים
  with due as (
    update kb_notes set reminded_at = now()
    where remind_at <= now() and remind_at > now() - interval '1 day' and reminded_at is null and deleted_at is null and status <> 'done'
    returning *
  )
  select coalesce(json_agg(json_build_object(
    'id', d.id, 'shop_id', d.shop_id, 'kind', 'reminder', 'title', d.title, 'body', concat_ws(' · ', nullif(d.customer,''), nullif(d.phone,''), 'פתק של ' || d.author_name),
    'url', '/s/' || d.shop_id || '?notes=1',
    'targets', coalesce((select json_agg(json_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from kb_push s join kb_members m on m.shop_id = s.shop_id and m.user_id = s.user_id
      where s.shop_id = d.shop_id and s.disabled_at is null and m.status = 'active' and m.notify
        and (d.remind_to = 'all' or s.user_id = d.author_id)), '[]'::json))), '[]'::json) into b
  from due d;
  -- הודעה דחופה שאף אחד עוד לא אישר: חוזרת כל 10 דקות, עד 6 פעמים
  with due as (
    update kb_posts p set urgent_pushes = urgent_pushes + 1, urgent_last_at = now()
    where p.urgent and p.deleted_at is null and p.created_at > now() - interval '2 hours' and p.created_at < now() - interval '9 minutes'
      and p.urgent_pushes < 6 and (p.urgent_last_at is null or p.urgent_last_at < now() - interval '9 minutes')
      and not exists (select 1 from kb_seen s where s.ref = 'post' and s.ref_id = p.id and s.user_id <> p.author_id)
    returning *
  )
  select coalesce(json_agg(json_build_object(
    'id', d.id, 'shop_id', d.shop_id, 'kind', 'urgent', 'title', d.title, 'body', left(coalesce(nullif(d.body,''), d.title), 200), 'author_name', d.author_name,
    'label', '🚨 דחוף מ' || coalesce(d.author_name,'החנות') || ' – עוד אף אחד לא אישר',
    'url', '/s/' || d.shop_id || '?board=1',
    'targets', coalesce((select json_agg(json_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from kb_push s join kb_members m on m.shop_id = s.shop_id and m.user_id = s.user_id
      where s.shop_id = d.shop_id and s.disabled_at is null and m.status = 'active' and m.notify and s.user_id <> d.author_id), '[]'::json))), '[]'::json) into c
  from due d;
  return (select coalesce(json_agg(e), '[]'::json) from (
    select json_array_elements(a) e union all select json_array_elements(b) union all select json_array_elements(c)) z);
end $$;

-- מעירים את השרת רק כשיש מה לשלוח
create or replace function public.kb_cron_tick()
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from kb_posts where remind_at <= now() and remind_at > now() - interval '1 day' and reminded_at is null and deleted_at is null and status = 'open')
    or exists (select 1 from kb_notes where remind_at <= now() and remind_at > now() - interval '1 day' and reminded_at is null and deleted_at is null and status <> 'done')
    or exists (select 1 from kb_posts p where p.urgent and p.deleted_at is null and p.created_at > now() - interval '2 hours' and p.created_at < now() - interval '9 minutes'
      and p.urgent_pushes < 6 and (p.urgent_last_at is null or p.urgent_last_at < now() - interval '9 minutes')
      and not exists (select 1 from kb_seen s where s.ref = 'post' and s.ref_id = p.id and s.user_id <> p.author_id)) then
    perform net.http_post(
      url := 'https://meida-myphone3.vercel.app/api/cron/remind',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select value from kb_config where key = 'cron_secret')),
      body := '{}'::jsonb
    );
  end if;
end $$;
revoke all on function public.kb_cron_tick() from public, anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array['kb_save_tag(uuid,jsonb)','kb_sort_tags(uuid,uuid[])','kb_set_settings(uuid,jsonb)','kb_load(uuid,timestamptz)',
    'kb_mark_seen(uuid,text,uuid[])','kb_save_post(uuid,jsonb)','kb_reply(uuid,uuid,text)','kb_delete_reply(uuid,uuid)',
    'kb_save_stock(uuid,jsonb)','kb_stock_status(uuid,uuid[],text)','kb_delete_stock(uuid,uuid)',
    'kb_save_note(uuid,jsonb)','kb_note_set(uuid,uuid,text)','kb_save_deal(uuid,jsonb)','kb_delete_deal(uuid,uuid)',
    'kb_save_product(uuid,jsonb)','kb_delete_product(uuid,uuid)','kb_ask(uuid,jsonb)','kb_new_targets(uuid,text,uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
