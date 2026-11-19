-- שדרוג 6: התראות רק לשאלות (בחירה לכל עובד) + דוחות בונוסים מיומן הבונוסים

-- ===== על מה לקבל התראה =====
-- asks = רק שאלות ותשובות והודעות דחופות (ברירת מחדל), all = הכול
alter table public.kb_members add column if not exists notify_mode text not null default 'asks';
do $$ begin
  alter table public.kb_members add constraint kb_members_notify_mode check (notify_mode in ('asks','all'));
exception when duplicate_object then null; end $$;

create or replace function public.kb_notify_mode(p_shop uuid)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  return (select notify_mode from kb_members where shop_id = p_shop and user_id = auth.uid());
end $$;

create or replace function public.kb_set_notify_mode(p_shop uuid, p_mode text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  if p_mode not in ('asks','all') then raise exception 'bad mode'; end if;
  update kb_members set notify_mode = p_mode where shop_id = p_shop and user_id = auth.uid();
end $$;

-- טלפונים בחנות שמקבלים רק שאלות (כדי לדלג עליהם בהתראות אחרות)
create or replace function public.kb_quiet_endpoints(p_shop uuid)
returns text[] language plpgsql stable security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  return coalesce((select array_agg(s.endpoint) from kb_push s join kb_members m on m.shop_id = s.shop_id and m.user_id = s.user_id
    where s.shop_id = p_shop and m.notify_mode = 'asks'), '{}');
end $$;

create or replace function public.kb_cron_quiet(p_secret text)
returns text[] language plpgsql stable security definer set search_path = public as $$
begin
  if p_secret is null or p_secret <> (select value from kb_config where key = 'cron_secret') then raise exception 'bad secret'; end if;
  return coalesce((select array_agg(s.endpoint) from kb_push s join kb_members m on m.shop_id = s.shop_id and m.user_id = s.user_id
    where m.notify_mode = 'asks'), '{}');
end $$;

-- ===== דוחות בונוסים (נשלחים מיומן הבונוסים, רק מנהלים רואים) =====
alter table public.kb_shops add column if not exists bonus_token text unique;

create table if not exists public.kb_bonus (
  shop_id uuid not null references public.kb_shops(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  data jsonb not null,
  sent_by text,
  sent_at timestamptz not null default now(),
  primary key (shop_id, month)
);
alter table public.kb_bonus enable row level security;
revoke all on public.kb_bonus from anon, authenticated;

-- קוד החיבור של החנות (נוצר בפעם הראשונה). רק מנהל.
create or replace function public.kb_bonus_link(p_shop uuid, p_new boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare t text;
begin
  perform kb_need(p_shop, true);
  select bonus_token into t from kb_shops where id = p_shop;
  if t is null or p_new then
    t := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    update kb_shops set bonus_token = t where id = p_shop;
  end if;
  return t;
end $$;

-- כל הדוחות של החנות. רק מנהל.
create or replace function public.kb_bonus_list(p_shop uuid)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform kb_need(p_shop, true);
  return coalesce((select json_agg(json_build_object('month', b.month, 'data', b.data, 'sent_by', b.sent_by, 'sent_at', b.sent_at) order by b.month desc)
    from kb_bonus b where b.shop_id = p_shop), '[]'::json);
end $$;

-- יומן הבונוסים (בלי משתמש, רק עם הקוד): שם החנות והחודשים שכבר נשלחו
create or replace function public.kb_bonus_info(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare s kb_shops;
begin
  if p_token is null or length(p_token) < 40 then raise exception 'bad token'; end if;
  select * into s from kb_shops where bonus_token = p_token;
  if s.id is null then raise exception 'bad token'; end if;
  return json_build_object('shop', s.name, 'logo', s.logo_url,
    'months', coalesce((select json_agg(month order by month desc) from kb_bonus where shop_id = s.id), '[]'::json));
end $$;

create or replace function public.kb_bonus_put(p_token text, p_month text, p_data jsonb, p_by text)
returns json language plpgsql security definer set search_path = public as $$
declare s kb_shops;
begin
  if p_token is null or length(p_token) < 40 then raise exception 'bad token'; end if;
  select * into s from kb_shops where bonus_token = p_token;
  if s.id is null then raise exception 'bad token'; end if;
  if p_month !~ '^\d{4}-\d{2}$' then raise exception 'bad month'; end if;
  if jsonb_typeof(p_data) <> 'object' or length(p_data::text) > 300000 then raise exception 'bad data'; end if;
  insert into kb_bonus(shop_id, month, data, sent_by, sent_at) values (s.id, p_month, p_data, left(coalesce(p_by, ''), 80), now())
  on conflict (shop_id, month) do update set data = excluded.data, sent_by = excluded.sent_by, sent_at = now();
  return json_build_object('ok', true, 'shop', s.name);
end $$;

do $$
declare f text;
begin
  foreach f in array array['kb_notify_mode(uuid)','kb_set_notify_mode(uuid,text)','kb_quiet_endpoints(uuid)',
    'kb_bonus_link(uuid,boolean)','kb_bonus_list(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['kb_bonus_info(text)','kb_bonus_put(text,text,jsonb,text)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
  execute 'revoke all on function public.kb_cron_quiet(text) from public, authenticated';
  execute 'grant execute on function public.kb_cron_quiet(text) to anon';
end $$;
