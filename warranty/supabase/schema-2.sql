-- שדרוג 2: טלפונים לשירות, הרחבת אחריות, קבצי PDF, התראות, ונעילה בקוד ברמת הארכיון (בכל מכשיר)
-- בלי פקודות מחיקה: מחיקת קבלה = deleted_at, ביטול התראה = disabled_at, החלפת קוד = מספר גרסה חדש שמבטל את כל הכניסות הקודמות.

alter table public.wr_receipts add column if not exists store_phone text;
alter table public.wr_receipts add column if not exists service_phone text;
alter table public.wr_receipts add column if not exists receipt_no text;
alter table public.wr_receipts add column if not exists ext_months int;
alter table public.wr_receipts add column if not exists ext_provider text;
alter table public.wr_receipts add column if not exists ext_price numeric;
alter table public.wr_receipts add column if not exists deleted_at timestamptz;  -- נמחק מהאפליקציה

-- נעילה
alter table public.wr_vaults add column if not exists pin_hash text;
alter table public.wr_vaults add column if not exists recovery_hash text;
alter table public.wr_vaults add column if not exists pin_ver int not null default 0;
alter table public.wr_vaults add column if not exists pin_fails int not null default 0;
alter table public.wr_vaults add column if not exists pin_locked_until timestamptz;

create table if not exists public.wr_tokens (
  token text primary key,
  vault_id uuid not null references public.wr_vaults(id) on delete cascade,
  ver int not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create table if not exists public.wr_config (key text primary key, value text not null);
create table if not exists public.wr_push (
  endpoint text primary key,
  vault_id uuid not null references public.wr_vaults(id) on delete cascade,
  sub jsonb not null,
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.wr_sent (
  receipt_id uuid not null references public.wr_receipts(id) on delete cascade,
  kind text not null,
  sent_at timestamptz not null default now(),
  primary key (receipt_id, kind)
);
alter table public.wr_tokens enable row level security;
alter table public.wr_config enable row level security;
alter table public.wr_push enable row level security;
alter table public.wr_sent enable row level security;
revoke all on public.wr_tokens, public.wr_config, public.wr_push, public.wr_sent from anon, authenticated;

-- האם מותר לגשת: אין קוד, או שיש כניסה בתוקף מהגרסה הנוכחית של הקוד
create or replace function public.wr_ok(p_vault uuid, p_token text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select v.pin_hash is null or exists (
    select 1 from wr_tokens t where t.token = p_token and t.vault_id = v.id and t.ver = v.pin_ver and t.expires_at > now())
  from wr_vaults v where v.id = p_vault), false);
$$;
revoke all on function public.wr_ok(uuid,text) from public, anon, authenticated;

create or replace function public.wr_get_vault(p_vault uuid, p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare v wr_vaults;
begin
  select * into v from wr_vaults where id = p_vault;
  if v.id is null then return null; end if;
  if not wr_ok(p_vault, p_token) then
    return json_build_object('locked', true, 'vault', json_build_object('id', v.id, 'name', v.name, 'has_pin', true));
  end if;
  return json_build_object(
    'vault', json_build_object('id', v.id, 'name', v.name, 'has_pin', v.pin_hash is not null),
    'receipts', coalesce((select json_agg(r order by r.purchase_date desc nulls last, r.created_at desc)
                          from wr_receipts r where r.vault_id = v.id and r.deleted_at is null), '[]'::json));
end $$;
-- הגרסה הישנה (בלי קוד) עוברת דרך הבדיקה
create or replace function public.wr_get_vault(p_vault uuid)
returns json language sql stable security definer set search_path = public as $$ select wr_get_vault(p_vault, null::text); $$;

create or replace function public.wr_rename_vault(p_vault uuid, p_name text, p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not wr_ok(p_vault, p_token) then raise exception 'locked'; end if;
  update wr_vaults set name = left(coalesce(nullif(trim(p_name),''),name),60), updated_at = now() where id = p_vault;
end $$;
create or replace function public.wr_rename_vault(p_vault uuid, p_name text)
returns void language sql security definer set search_path = public as $$ select wr_rename_vault(p_vault, p_name, null::text); $$;

create or replace function public.wr_save_receipt(p_vault uuid, p jsonb, p_token text)
returns public.wr_receipts language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id','')::uuid; r wr_receipts;
begin
  if not exists (select 1 from wr_vaults where id = p_vault) then raise exception 'vault not found'; end if;
  if not wr_ok(p_vault, p_token) then raise exception 'locked'; end if;
  if v_id is null then
    insert into wr_receipts(vault_id) values (p_vault) returning id into v_id;
  end if;
  update wr_receipts set
    product = left(coalesce(p->>'product',''),120),
    store = left(coalesce(p->>'store',''),80),
    category = nullif(left(p->>'category',40),''),
    purchase_date = nullif(p->>'purchase_date','')::date,
    price = nullif(p->>'price','')::numeric,
    warranty_months = nullif(p->>'warranty_months','')::int,
    serial = nullif(left(p->>'serial',80),''),
    notes = nullif(left(p->>'notes',2000),''),
    store_phone = nullif(left(p->>'store_phone',30),''),
    service_phone = nullif(left(p->>'service_phone',30),''),
    receipt_no = nullif(left(p->>'receipt_no',40),''),
    ext_months = nullif(p->>'ext_months','')::int,
    ext_provider = nullif(left(p->>'ext_provider',80),''),
    ext_price = nullif(p->>'ext_price','')::numeric,
    items = coalesce((select array_agg(left(x,120)) from jsonb_array_elements_text(coalesce(p->'items','[]'::jsonb)) x), '{}'),
    photos = coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p->'photos','[]'::jsonb)) x
                       where x ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/wr-photos/'), '{}'),
    updated_at = now()
  where id = v_id and vault_id = p_vault
  returning * into r;
  if r.id is null then raise exception 'receipt not found'; end if;
  update wr_vaults set updated_at = now() where id = p_vault;
  return r;
end $$;
create or replace function public.wr_save_receipt(p_vault uuid, p jsonb)
returns public.wr_receipts language sql security definer set search_path = public as $$ select wr_save_receipt(p_vault, p, null::text); $$;

create or replace function public.wr_delete_receipt(p_vault uuid, p_id uuid, p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not wr_ok(p_vault, p_token) then raise exception 'locked'; end if;
  update wr_receipts set deleted_at = now() where id = p_id and vault_id = p_vault;
end $$;
create or replace function public.wr_delete_receipt(p_vault uuid, p_id uuid)
returns void language sql security definer set search_path = public as $$ select wr_delete_receipt(p_vault, p_id, null::text); $$;

-- כניסה עם קוד (או קוד שחזור). 5 טעויות = נעילה ל-15 דקות.
create or replace function public.wr_unlock(p_vault uuid, p_pin text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare v wr_vaults; tok text; ok boolean;
begin
  select * into v from wr_vaults where id = p_vault for update;
  if v.id is null then return json_build_object('error', 'missing'); end if;
  if v.pin_hash is null then return json_build_object('token', null); end if;
  if v.pin_locked_until > now() then
    return json_build_object('error', 'wait', 'minutes', ceil(extract(epoch from v.pin_locked_until - now()) / 60));
  end if;
  ok := crypt(coalesce(p_pin,''), v.pin_hash) = v.pin_hash
        or (v.recovery_hash is not null and length(coalesce(p_pin,'')) > 4 and crypt(upper(replace(p_pin,'-','')), v.recovery_hash) = v.recovery_hash);
  if not ok then
    if v.pin_fails + 1 >= 5 then
      update wr_vaults set pin_fails = 0, pin_locked_until = now() + interval '15 minutes' where id = p_vault;
      return json_build_object('error', 'wait', 'minutes', 15);
    end if;
    update wr_vaults set pin_fails = pin_fails + 1 where id = p_vault;
    return json_build_object('error', 'bad', 'left', 5 - (v.pin_fails + 1));
  end if;
  update wr_vaults set pin_fails = 0, pin_locked_until = null where id = p_vault;
  tok := encode(gen_random_bytes(24), 'hex');
  insert into wr_tokens(token, vault_id, ver, expires_at) values (tok, p_vault, v.pin_ver, now() + interval '180 days');
  return json_build_object('token', tok);
end $$;

-- הגדרת קוד חדש (או החלפה). מבטל את כל הכניסות הקודמות בכל המכשירים ומחזיר קוד שחזור.
create or replace function public.wr_set_pin(p_vault uuid, p_token text, p_pin text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare v wr_vaults; tok text; rec text;
begin
  if p_pin !~ '^\d{4}$' then raise exception 'bad pin'; end if;
  if not wr_ok(p_vault, p_token) then raise exception 'locked'; end if;
  rec := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8));
  update wr_vaults set pin_hash = crypt(p_pin, gen_salt('bf')), recovery_hash = crypt(rec, gen_salt('bf')),
    pin_ver = pin_ver + 1, pin_fails = 0, pin_locked_until = null, updated_at = now()
  where id = p_vault returning * into v;
  tok := encode(gen_random_bytes(24), 'hex');
  insert into wr_tokens(token, vault_id, ver, expires_at) values (tok, p_vault, v.pin_ver, now() + interval '180 days');
  return json_build_object('token', tok, 'recovery', substr(rec,1,4) || '-' || substr(rec,5,4));
end $$;

create or replace function public.wr_clear_pin(p_vault uuid, p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not wr_ok(p_vault, p_token) then raise exception 'locked'; end if;
  update wr_vaults set pin_hash = null, recovery_hash = null, pin_ver = pin_ver + 1, updated_at = now() where id = p_vault;
end $$;

-- התראות
create or replace function public.wr_push_subscribe(p_vault uuid, p_sub jsonb, p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from wr_vaults where id = p_vault) then raise exception 'vault not found'; end if;
  if not wr_ok(p_vault, p_token) then raise exception 'locked'; end if;
  if coalesce(p_sub->>'endpoint','') !~ '^https://' then raise exception 'bad subscription'; end if;
  insert into wr_push(endpoint, vault_id, sub) values (p_sub->>'endpoint', p_vault, p_sub)
  on conflict (endpoint) do update set vault_id = excluded.vault_id, sub = excluded.sub, disabled_at = null;
end $$;

create or replace function public.wr_push_unsubscribe(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  update wr_push set disabled_at = now() where endpoint = p_endpoint;
$$;

-- לשרת (cron): מה לשלוח היום. '30' = נשאר עד חודש, '7' = עד שבוע. מסמן כנשלח.
create or replace function public.wr_push_due(p_secret text)
returns json language plpgsql security definer set search_path = public as $$
declare out json;
begin
  if p_secret is null or p_secret <> (select value from wr_config where key = 'cron_secret') then raise exception 'unauthorized'; end if;
  with ends as (
    select r.*, ((r.purchase_date + make_interval(months => r.warranty_months + coalesce(r.ext_months,0)))::date - current_date) as days
    from wr_receipts r
    where r.purchase_date is not null and coalesce(r.warranty_months,0) > 0 and r.deleted_at is null
  ), due as (
    select e.*, case when e.days <= 7 then '7' else '30' end as kind
    from ends e
    where e.days between 0 and 30
      and not exists (select 1 from wr_sent s where s.receipt_id = e.id and (s.kind = case when e.days <= 7 then '7' else '30' end or s.kind = '7'))
      and exists (select 1 from wr_push p where p.vault_id = e.vault_id and p.disabled_at is null)
  ), mark as (
    insert into wr_sent(receipt_id, kind) select id, kind from due on conflict do nothing returning receipt_id
  )
  select coalesce(json_agg(json_build_object('endpoint', p.endpoint, 'sub', p.sub, 'vault_id', d.vault_id, 'id', d.id,
           'product', d.product, 'store', d.store, 'days', d.days, 'kind', d.kind)), '[]'::json)
  into out
  from due d join wr_push p on p.vault_id = d.vault_id and p.disabled_at is null;
  return out;
end $$;

create or replace function public.wr_push_gone(p_secret text, p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_secret is null or p_secret <> (select value from wr_config where key = 'cron_secret') then raise exception 'unauthorized'; end if;
  update wr_push set disabled_at = now() where endpoint = p_endpoint;
end $$;

grant execute on function public.wr_get_vault(uuid,text), public.wr_rename_vault(uuid,text,text), public.wr_save_receipt(uuid,jsonb,text),
  public.wr_delete_receipt(uuid,uuid,text), public.wr_unlock(uuid,text), public.wr_set_pin(uuid,text,text), public.wr_clear_pin(uuid,text),
  public.wr_push_subscribe(uuid,jsonb,text), public.wr_push_unsubscribe(text), public.wr_push_due(text), public.wr_push_gone(text,text)
  to anon, authenticated;

-- PDF בדלי הקבצים (עד 10MB)
update storage.buckets set file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'] where id = 'wr-photos';
