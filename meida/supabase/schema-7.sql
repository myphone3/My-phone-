-- שדרוג 7: מקש לגירסה (פלאפונים כשרים ותומכי כשר) + גרסאות סמוויקס (הוראות וסרטון) + בונוסים אוטומטיים

-- ===== מקשים / הוראות לכל מכשיר =====
-- list: keys = מקש לגירסה, samvix = גרסאות סמוויקס
-- dev_id: המזהה של המכשיר ברשימה המובנית (lib/devices.js), או c-... למכשיר שנוסף ידנית (ואז custom = {name, kind, brand})
create table if not exists public.kb_dev (
  shop_id uuid not null references public.kb_shops(id) on delete cascade,
  list text not null check (list in ('keys','samvix')),
  dev_id text not null check (length(dev_id) between 1 and 80),
  key text not null default '',
  note text not null default '',
  body text not null default '',
  video text not null default '',
  photo text not null default '',
  custom jsonb,
  updated_by uuid,
  updated_name text,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (shop_id, list, dev_id)
);
alter table public.kb_dev enable row level security;
revoke all on public.kb_dev from anon, authenticated;

create or replace function public.kb_dev_list(p_shop uuid)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  return coalesce((select json_agg(json_build_object('list', d.list, 'dev_id', d.dev_id, 'key', d.key, 'note', d.note, 'body', d.body,
    'video', d.video, 'photo', d.photo, 'custom', d.custom, 'updated_name', d.updated_name, 'updated_at', d.updated_at))
    from kb_dev d where d.shop_id = p_shop and d.deleted_at is null), '[]'::json);
end $$;

-- שמירה (כל עובד). p = {key, note, body, video, photo, custom}
create or replace function public.kb_dev_save(p_shop uuid, p_list text, p_dev text, p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare x kb_dev; c jsonb;
begin
  perform kb_need(p_shop);
  if p_list not in ('keys','samvix') then raise exception 'bad list'; end if;
  if p_dev is null or length(p_dev) not between 1 and 80 then raise exception 'bad device'; end if;
  c := p->'custom';
  if c is not null and jsonb_typeof(c) = 'object' then
    if coalesce(trim(c->>'name'),'') = '' then raise exception 'empty'; end if;
    c := jsonb_build_object('name', left(trim(c->>'name'), 80), 'kind', left(coalesce(c->>'kind',''), 20), 'brand', left(coalesce(c->>'brand',''), 40));
  else c := null; end if;
  if coalesce(p->>'video','') <> '' and p->>'video' !~ '^https://' then raise exception 'bad video'; end if;
  if coalesce(p->>'photo','') <> '' and p->>'photo' !~ '^https://' then raise exception 'bad photo'; end if;
  insert into kb_dev(shop_id, list, dev_id, key, note, body, video, photo, custom, updated_by, updated_name, updated_at, deleted_at)
  values (p_shop, p_list, p_dev, left(coalesce(p->>'key',''), 60), left(coalesce(p->>'note',''), 300), left(coalesce(p->>'body',''), 8000),
    left(coalesce(p->>'video',''), 600), left(coalesce(p->>'photo',''), 600), c, auth.uid(), kb_me_name(), now(), null)
  on conflict (shop_id, list, dev_id) do update set key = excluded.key, note = excluded.note, body = excluded.body, video = excluded.video,
    photo = excluded.photo, custom = coalesce(excluded.custom, kb_dev.custom), updated_by = excluded.updated_by,
    updated_name = excluded.updated_name, updated_at = now(), deleted_at = null
  returning * into x;
  return json_build_object('list', x.list, 'dev_id', x.dev_id, 'key', x.key, 'note', x.note, 'body', x.body, 'video', x.video,
    'photo', x.photo, 'custom', x.custom, 'updated_name', x.updated_name, 'updated_at', x.updated_at);
end $$;

-- מחיקת מכשיר שנוסף ידנית (כל עובד; מכשירים מהרשימה המובנית לא נמחקים)
create or replace function public.kb_dev_delete(p_shop uuid, p_list text, p_dev text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  update kb_dev set deleted_at = now(), updated_by = auth.uid(), updated_name = kb_me_name()
  where shop_id = p_shop and list = p_list and dev_id = p_dev and custom is not null;
end $$;

-- ===== סרטוני הסברה (דלי נפרד, עד 50MB) =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kb-videos', 'kb-videos', true, 52428800, array['video/mp4','video/quicktime','video/webm','video/3gpp','video/x-matroska'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'kb videos upload') then
    create policy "kb videos upload" on storage.objects for insert to authenticated with check (bucket_id = 'kb-videos');
  end if;
end $$;

-- ===== בונוסים: עדכון אוטומטי + סגירת חודש =====
-- data.status: live = מתעדכן לבד מהיומן, final = אושר בתחילת החודש (כולל הקופה)
-- עדכון אוטומטי: לא דורס חודש שכבר אושר כסופי
create or replace function public.kb_bonus_live(p_token text, p_month text, p_data jsonb, p_by text)
returns json language plpgsql security definer set search_path = public as $$
declare s kb_shops; n int;
begin
  if p_token is null or length(p_token) < 40 then raise exception 'bad token'; end if;
  select * into s from kb_shops where bonus_token = p_token;
  if s.id is null then raise exception 'bad token'; end if;
  if p_month !~ '^\d{4}-\d{2}$' then raise exception 'bad month'; end if;
  if jsonb_typeof(p_data) <> 'object' or length(p_data::text) > 300000 then raise exception 'bad data'; end if;
  insert into kb_bonus(shop_id, month, data, sent_by, sent_at)
  values (s.id, p_month, p_data || '{"status":"live"}'::jsonb, left(coalesce(p_by, ''), 80), now())
  on conflict (shop_id, month) do update set data = excluded.data, sent_by = excluded.sent_by, sent_at = now()
    where coalesce(kb_bonus.data->>'status', '') <> 'final';
  get diagnostics n = row_count;
  return json_build_object('ok', true, 'saved', n > 0);
end $$;

-- היומן: שם החנות, החודשים שנשלחו, ואלה שכבר אושרו כסופיים (חודשים ישנים בלי status נחשבים סופיים)
create or replace function public.kb_bonus_info(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare s kb_shops;
begin
  if p_token is null or length(p_token) < 40 then raise exception 'bad token'; end if;
  select * into s from kb_shops where bonus_token = p_token;
  if s.id is null then raise exception 'bad token'; end if;
  return json_build_object('shop', s.name, 'logo', s.logo_url,
    'months', coalesce((select json_agg(month order by month desc) from kb_bonus where shop_id = s.id), '[]'::json),
    'final', coalesce((select json_agg(month order by month desc) from kb_bonus where shop_id = s.id and coalesce(data->>'status', 'final') = 'final'), '[]'::json));
end $$;

do $$
declare f text;
begin
  foreach f in array array['kb_dev_list(uuid)','kb_dev_save(uuid,text,text,jsonb)','kb_dev_delete(uuid,text,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['kb_bonus_info(text)','kb_bonus_live(text,text,jsonb,text)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;
