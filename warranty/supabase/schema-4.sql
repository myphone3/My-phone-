-- שדרוג 4: חשבונות (כניסה עם Google). לארכיון יש בעלים וחברים.
-- ארכיון בלי בעלים (ישן) ממשיך לעבוד עם הקישור בלבד. ארכיון עם בעלים — רק חברים מחוברים נכנסים.
-- בלי פקודות מחיקה: הסרת חבר = status 'removed', יציאה = 'left'.

alter table public.wr_vaults add column if not exists owner_id uuid;
alter table public.wr_vaults add column if not exists allow_join boolean not null default true;

create table if not exists public.wr_members (
  vault_id uuid not null references public.wr_vaults(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member' check (role in ('owner','member')),
  status text not null default 'active' check (status in ('active','removed','left')),
  email text,
  name text,
  joined_at timestamptz not null default now(),
  primary key (vault_id, user_id)
);
create index if not exists wr_members_user_idx on public.wr_members(user_id);
alter table public.wr_members enable row level security;
revoke all on public.wr_members from anon, authenticated;

create or replace function public.wr_me_name()
returns text language sql stable as $$
  select left(coalesce(auth.jwt()->'user_metadata'->>'full_name', auth.jwt()->'user_metadata'->>'name', split_part(auth.jwt()->>'email','@',1), ''), 80);
$$;

-- גישה: (אין קוד או כרטיס כניסה בתוקף) וגם (אין בעלים או שאני חבר פעיל)
create or replace function public.wr_ok(p_vault uuid, p_token text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select
      (v.pin_hash is null or exists (select 1 from wr_tokens t where t.token = p_token and t.vault_id = v.id and t.ver = v.pin_ver and t.expires_at > now()))
      and (v.owner_id is null or exists (select 1 from wr_members m where m.vault_id = v.id and m.user_id = auth.uid() and m.status = 'active'))
    from wr_vaults v where v.id = p_vault), false);
$$;
revoke all on function public.wr_ok(uuid,text) from public, anon, authenticated;

create or replace function public.wr_get_vault(p_vault uuid, p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare v wr_vaults; m wr_members; owner_name text;
begin
  select * into v from wr_vaults where id = p_vault;
  if v.id is null then return null; end if;
  if v.owner_id is not null then
    select * into m from wr_members where vault_id = v.id and user_id = auth.uid();
    if m.user_id is null or m.status <> 'active' then
      select name into owner_name from wr_members where vault_id = v.id and user_id = v.owner_id;
      return json_build_object('need', case when auth.uid() is null then 'signin' when m.status = 'removed' then 'removed' else 'join' end,
        'vault', json_build_object('id', v.id, 'name', v.name, 'owner_name', owner_name, 'allow_join', v.allow_join));
    end if;
  end if;
  if not wr_ok(p_vault, p_token) then
    return json_build_object('locked', true, 'vault', json_build_object('id', v.id, 'name', v.name, 'has_pin', true));
  end if;
  return json_build_object(
    'vault', json_build_object('id', v.id, 'name', v.name, 'has_pin', v.pin_hash is not null,
      'has_owner', v.owner_id is not null, 'is_owner', v.owner_id is not null and v.owner_id = auth.uid(), 'allow_join', v.allow_join),
    'receipts', coalesce((select json_agg(r order by r.purchase_date desc nulls last, r.created_at desc)
                          from wr_receipts r where r.vault_id = v.id and r.deleted_at is null), '[]'::json));
end $$;

-- ארכיון חדש: אם מחוברים — הוא שייך לחשבון
create or replace function public.wr_create_vault(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into wr_vaults(name, owner_id) values (left(coalesce(nullif(trim(p_name),''),'הקבלות שלי'),60), auth.uid()) returning id into v_id;
  if auth.uid() is not null then
    insert into wr_members(vault_id, user_id, role, email, name) values (v_id, auth.uid(), 'owner', auth.jwt()->>'email', wr_me_name());
  end if;
  return v_id;
end $$;

-- שמירת ארכיון קיים (בלי בעלים) בחשבון שלי
create or replace function public.wr_claim(p_vault uuid, p_token text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'signin'; end if;
  if not wr_ok(p_vault, p_token) then raise exception 'locked'; end if;
  update wr_vaults set owner_id = auth.uid(), updated_at = now() where id = p_vault and owner_id is null;
  if not found then return json_build_object('error', 'has_owner'); end if;
  insert into wr_members(vault_id, user_id, role, email, name) values (p_vault, auth.uid(), 'owner', auth.jwt()->>'email', wr_me_name())
  on conflict (vault_id, user_id) do update set role = 'owner', status = 'active';
  return json_build_object('ok', true);
end $$;

-- הצטרפות עם הקישור (אחרי כניסה עם Google)
create or replace function public.wr_join(p_vault uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v wr_vaults; m wr_members;
begin
  if auth.uid() is null then raise exception 'signin'; end if;
  select * into v from wr_vaults where id = p_vault;
  if v.id is null then return json_build_object('error', 'missing'); end if;
  if v.owner_id is null then return json_build_object('ok', true); end if;
  select * into m from wr_members where vault_id = p_vault and user_id = auth.uid();
  if m.status = 'active' then return json_build_object('ok', true); end if;
  if m.status = 'removed' then return json_build_object('error', 'removed'); end if;
  if not v.allow_join then return json_build_object('error', 'closed'); end if;
  insert into wr_members(vault_id, user_id, role, email, name) values (p_vault, auth.uid(), 'member', auth.jwt()->>'email', wr_me_name())
  on conflict (vault_id, user_id) do update set status = 'active', email = excluded.email, name = excluded.name, joined_at = now();
  return json_build_object('ok', true);
end $$;

-- הארכיונים שלי (מכל מכשיר)
create or replace function public.wr_my_vaults()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', v.id, 'name', v.name, 'role', m.role,
    'count', (select count(*) from wr_receipts r where r.vault_id = v.id and r.deleted_at is null)) order by v.updated_at desc), '[]'::json)
  from wr_members m join wr_vaults v on v.id = m.vault_id
  where m.user_id = auth.uid() and m.status = 'active';
$$;

create or replace function public.wr_members_list(p_vault uuid, p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not wr_ok(p_vault, p_token) then raise exception 'locked'; end if;
  return coalesce((select json_agg(json_build_object('user_id', m.user_id, 'name', m.name, 'email', m.email, 'role', m.role,
    'me', m.user_id = auth.uid(), 'joined_at', m.joined_at) order by m.role desc, m.joined_at)
    from wr_members m where m.vault_id = p_vault and m.status = 'active'), '[]'::json);
end $$;

create or replace function public.wr_member_remove(p_vault uuid, p_token text, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not wr_ok(p_vault, p_token) then raise exception 'locked'; end if;
  if (select owner_id from wr_vaults where id = p_vault) is distinct from auth.uid() then raise exception 'owner only'; end if;
  update wr_members set status = 'removed' where vault_id = p_vault and user_id = p_user and role <> 'owner';
end $$;

create or replace function public.wr_leave(p_vault uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update wr_members set status = 'left' where vault_id = p_vault and user_id = auth.uid() and role <> 'owner';
end $$;

create or replace function public.wr_set_allow_join(p_vault uuid, p_token text, p_allow boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not wr_ok(p_vault, p_token) then raise exception 'locked'; end if;
  if (select owner_id from wr_vaults where id = p_vault) is distinct from auth.uid() then raise exception 'owner only'; end if;
  update wr_vaults set allow_join = coalesce(p_allow, true) where id = p_vault;
end $$;

-- קוד הנעילה: בארכיון עם בעלים — רק הבעלים משנה
create or replace function public.wr_set_pin(p_vault uuid, p_token text, p_pin text)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare v wr_vaults; tok text; rec text;
begin
  if p_pin !~ '^\d{4}$' then raise exception 'bad pin'; end if;
  if not wr_ok(p_vault, p_token) then raise exception 'locked'; end if;
  if (select owner_id from wr_vaults where id = p_vault) is not null and (select owner_id from wr_vaults where id = p_vault) is distinct from auth.uid() then raise exception 'owner only'; end if;
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
  if (select owner_id from wr_vaults where id = p_vault) is not null and (select owner_id from wr_vaults where id = p_vault) is distinct from auth.uid() then raise exception 'owner only'; end if;
  update wr_vaults set pin_hash = null, recovery_hash = null, pin_ver = pin_ver + 1, updated_at = now() where id = p_vault;
end $$;

grant execute on function public.wr_create_vault(text), public.wr_claim(uuid,text), public.wr_join(uuid), public.wr_my_vaults(),
  public.wr_members_list(uuid,text), public.wr_member_remove(uuid,text,uuid), public.wr_leave(uuid), public.wr_set_allow_join(uuid,text,boolean)
  to anon, authenticated;
