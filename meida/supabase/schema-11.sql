-- שדרוג 11: מצרכי חנות (טישו, שתייה, כוסות...) — נפרד לגמרי מהמלאי.
-- status: ok = יש, low = עומד להיגמר, out = נגמר. cat: drink / clean / one / office / other.
-- photo: תמונה מהדלי kb-photos (לא חובה). emoji: ציור כשאין תמונה.

create table if not exists public.kb_supplies (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.kb_shops(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  cat text not null default 'other',
  emoji text not null default '',
  photo text not null default '',
  status text not null default 'ok' check (status in ('ok','low','out')),
  sort int not null default 0,
  created_by uuid,
  status_by uuid,
  status_by_name text not null default '',
  status_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists kb_supplies_shop_idx on public.kb_supplies(shop_id);
alter table public.kb_supplies enable row level security;
revoke all on public.kb_supplies from anon, authenticated;

create or replace function public.kb_supply_cat(c text)
returns text language sql immutable as $$
  select case when c in ('drink','clean','one','office','other') then c else 'other' end;
$$;

-- הרשימה. בפעם הראשונה בחנות — ממלא רשימה בסיסית.
create or replace function public.kb_supplies(p_shop uuid)
returns json language plpgsql security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  if not exists (select 1 from kb_supplies where shop_id = p_shop) then
    insert into kb_supplies(shop_id, name, cat, emoji, sort) values
      (p_shop, 'קפה', 'drink', '☕', 1), (p_shop, 'תה', 'drink', '🍵', 2), (p_shop, 'סוכר', 'drink', '🍬', 3),
      (p_shop, 'מים מינרליים', 'drink', '💧', 4), (p_shop, 'חלב', 'drink', '🥛', 5),
      (p_shop, 'טישו', 'clean', '🧻', 10), (p_shop, 'נייר מגבת', 'clean', '🧻', 11), (p_shop, 'נייר טואלט', 'clean', '🧻', 12),
      (p_shop, 'שקיות זבל', 'clean', '🗑️', 13), (p_shop, 'סבון ידיים', 'clean', '🧼', 14), (p_shop, 'חומר ניקוי', 'clean', '🧴', 15),
      (p_shop, 'כוסות חד-פעמיות', 'one', '🥤', 20), (p_shop, 'כפיות', 'one', '🥄', 21), (p_shop, 'שקיות ללקוחות', 'one', '🛍️', 22),
      (p_shop, 'גליל קופה', 'office', '🧾', 30), (p_shop, 'עטים', 'office', '🖊️', 31), (p_shop, 'סלוטייפ', 'office', '📎', 32);
  end if;
  return coalesce((select json_agg(x order by x.sort, x.created_at) from kb_supplies x where x.shop_id = p_shop and x.deleted_at is null), '[]'::json);
end $$;

-- שמירה: חדש (בלי id) או עדכון. status משתנה → נרשם מי ומתי.
create or replace function public.kb_save_supply(p_shop uuid, p jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare x kb_supplies; v_id uuid; nm text; st text; ph text;
begin
  perform kb_need(p_shop);
  v_id := nullif(p->>'id','')::uuid;
  nm := left(trim(coalesce(p->>'name','')), 80);
  st := nullif(p->>'status','');
  if st is not null and st not in ('ok','low','out') then raise exception 'bad status'; end if;
  ph := coalesce(p->>'photo','');
  if ph <> '' and not kb_photo_ok(ph) then ph := ''; end if;
  if v_id is null then
    if nm = '' then raise exception 'empty'; end if;
    insert into kb_supplies(shop_id, name, cat, emoji, photo, status, sort, created_by, status_by, status_by_name, status_at)
    values (p_shop, nm, kb_supply_cat(p->>'cat'), left(coalesce(p->>'emoji',''), 8), ph, coalesce(st,'ok'),
      coalesce((select max(sort) + 1 from kb_supplies where shop_id = p_shop), 1), auth.uid(),
      case when coalesce(st,'ok') <> 'ok' then auth.uid() end, case when coalesce(st,'ok') <> 'ok' then kb_me_name() else '' end,
      case when coalesce(st,'ok') <> 'ok' then now() end)
    returning * into x;
  else
    update kb_supplies set
      name = coalesce(nullif(nm,''), name),
      cat = case when p ? 'cat' then kb_supply_cat(p->>'cat') else cat end,
      emoji = case when p ? 'emoji' then left(coalesce(p->>'emoji',''), 8) else emoji end,
      photo = case when p ? 'photo' then ph else photo end,
      status_by = case when st is not null and st <> status then auth.uid() else status_by end,
      status_by_name = case when st is not null and st <> status then kb_me_name() else status_by_name end,
      status_at = case when st is not null and st <> status then now() else status_at end,
      status = coalesce(st, status),
      updated_at = now()
    where id = v_id and shop_id = p_shop and deleted_at is null
    returning * into x;
    if x.id is null then raise exception 'not found'; end if;
  end if;
  return row_to_json(x);
end $$;

create or replace function public.kb_delete_supply(p_shop uuid, p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  update kb_supplies set deleted_at = now(), updated_at = now() where id = p_id and shop_id = p_shop;
  return json_build_object('ok', true);
end $$;

-- התראה: רק אם אני סימנתי עכשיו "נגמר" / "עומד להיגמר" → כל הצוות חוץ ממני
create or replace function public.kb_supply_targets(p_shop uuid, p_id uuid)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  if not exists (select 1 from kb_supplies where id = p_id and shop_id = p_shop and status in ('low','out')
    and status_by = auth.uid() and status_at > now() - interval '5 minutes') then return '[]'::json; end if;
  return coalesce((select json_agg(json_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
    from kb_push s join kb_members m on m.shop_id = s.shop_id and m.user_id = s.user_id
    where s.shop_id = p_shop and s.disabled_at is null and m.status = 'active' and m.notify and s.user_id <> auth.uid()), '[]'::json);
end $$;

revoke all on function public.kb_supply_cat(text) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['kb_supplies(uuid)','kb_save_supply(uuid,jsonb)','kb_delete_supply(uuid,uuid)','kb_supply_targets(uuid,uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
