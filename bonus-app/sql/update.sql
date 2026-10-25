-- יומן בונוסים: צוות, מנהל, בונוסים לכל עובד ואישור חודשי
alter table public.settings add column if not exists my_phone text not null default '';
alter table public.settings add column if not exists cats jsonb;
alter table public.entries drop constraint if exists entries_kind_check;
alter table public.entries drop constraint if exists entries_kind_len;
alter table public.entries add constraint entries_kind_len check (length(kind) between 1 and 60);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  join_code text not null unique,
  reg integer not null default 10,
  big integer not null default 50,
  types jsonb,
  cats jsonb,
  allow_other boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.team_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  role text not null check (role in ('manager','member')),
  config jsonb,
  joined_at timestamptz not null default now()
);
alter table public.team_members add column if not exists config jsonb;
create index if not exists team_members_team on public.team_members(team_id);
create table if not exists public.month_approvals (
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,
  team_id uuid not null references public.teams(id) on delete cascade,
  approved_by uuid not null references auth.users(id) on delete cascade,
  approved_at timestamptz not null default now(),
  total integer not null default 0,
  cnt integer not null default 0,
  primary key (user_id, month)
);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.month_approvals enable row level security;
revoke all on public.teams, public.team_members, public.month_approvals from anon;
grant select, update on public.teams to authenticated;
grant select on public.team_members to authenticated;
grant update (config) on public.team_members to authenticated;
grant select on public.month_approvals to authenticated;

create or replace function public.my_team_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select team_id from public.team_members where user_id = auth.uid();
$$;
create or replace function public.is_manager_of(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_members me
    join public.team_members t on t.team_id = me.team_id
    where me.user_id = auth.uid() and me.role = 'manager' and t.user_id = target
  );
$$;
create or replace function public.is_month_locked(p_user uuid, p_month text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.month_approvals a where a.user_id = p_user and a.month = p_month);
$$;

drop policy if exists "team visible to members" on public.teams;
create policy "team visible to members" on public.teams for select to authenticated
  using (id = (select public.my_team_id()));
drop policy if exists "manager edits team" on public.teams;
create policy "manager edits team" on public.teams for update to authenticated
  using (id = (select public.my_team_id()) and exists (select 1 from public.team_members m where m.user_id = (select auth.uid()) and m.role = 'manager'))
  with check (id = (select public.my_team_id()));
drop policy if exists "members see teammates" on public.team_members;
create policy "members see teammates" on public.team_members for select to authenticated
  using (team_id = (select public.my_team_id()));
drop policy if exists "manager sets member bonuses" on public.team_members;
create policy "manager sets member bonuses" on public.team_members for update to authenticated
  using ((select public.is_manager_of(user_id)) or (user_id = (select auth.uid()) and role = 'manager'))
  with check ((select public.is_manager_of(user_id)) or (user_id = (select auth.uid()) and role = 'manager'));
drop policy if exists "see approvals" on public.month_approvals;
create policy "see approvals" on public.month_approvals for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_manager_of(user_id)));

-- entries: own rows, but an approved month is locked; the manager may fix or remove a worker's rows
drop policy if exists "own entries" on public.entries;
drop policy if exists "own entries read" on public.entries;
drop policy if exists "own entries add" on public.entries;
drop policy if exists "own entries change" on public.entries;
drop policy if exists "own entries remove" on public.entries;
create policy "own entries read" on public.entries for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own entries add" on public.entries for insert to authenticated
  with check ((select auth.uid()) = user_id and not public.is_month_locked(user_id, month));
create policy "own entries change" on public.entries for update to authenticated
  using ((select auth.uid()) = user_id and not public.is_month_locked(user_id, month))
  with check ((select auth.uid()) = user_id and not public.is_month_locked(user_id, month));
create policy "own entries remove" on public.entries for delete to authenticated
  using ((select auth.uid()) = user_id and not public.is_month_locked(user_id, month));
drop policy if exists "manager reads team entries" on public.entries;
create policy "manager reads team entries" on public.entries for select to authenticated
  using ((select public.is_manager_of(user_id)));
drop policy if exists "manager fixes team entries" on public.entries;
create policy "manager fixes team entries" on public.entries for delete to authenticated
  using ((select public.is_manager_of(user_id)));
drop policy if exists "manager reads team settings" on public.settings;
create policy "manager reads team settings" on public.settings for select to authenticated
  using ((select public.is_manager_of(user_id)));

create or replace function public.create_team(p_name text) returns public.teams
language plpgsql security definer set search_path = '' as $$
declare t public.teams; s public.settings; code text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from public.team_members where user_id = auth.uid()) then raise exception 'already_in_team'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name_required'; end if;
  select * into s from public.settings where user_id = auth.uid();
  loop
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.teams where join_code = code);
  end loop;
  insert into public.teams (name, owner_id, join_code, reg, big, types, cats)
    values (trim(p_name), auth.uid(), code, coalesce(s.reg, 10), coalesce(s.big, 50), s.types, s.cats)
    returning * into t;
  insert into public.team_members (user_id, team_id, role) values (auth.uid(), t.id, 'manager');
  return t;
end $$;

create or replace function public.join_team(p_code text) returns public.teams
language plpgsql security definer set search_path = '' as $$
declare t public.teams;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from public.team_members where user_id = auth.uid()) then raise exception 'already_in_team'; end if;
  select * into t from public.teams where join_code = upper(trim(p_code));
  if t.id is null then raise exception 'bad_code'; end if;
  insert into public.team_members (user_id, team_id, role) values (auth.uid(), t.id, 'member');
  return t;
end $$;

create or replace function public.leave_team() returns void
language plpgsql security definer set search_path = '' as $$
declare m public.team_members;
begin
  select * into m from public.team_members where user_id = auth.uid();
  if m.user_id is null then return; end if;
  if m.role = 'manager' then
    if exists (select 1 from public.team_members where team_id = m.team_id and user_id <> auth.uid()) then raise exception 'team_not_empty'; end if;
    delete from public.teams where id = m.team_id;
  else
    delete from public.team_members where user_id = auth.uid();
  end if;
end $$;

create or replace function public.remove_member(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user = auth.uid() or not public.is_manager_of(p_user) then raise exception 'not_allowed'; end if;
  delete from public.team_members where user_id = p_user and role = 'member';
end $$;

create or replace function public.approve_month(p_user uuid, p_month text, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare tid uuid; tot integer; c integer;
begin
  if not (public.is_manager_of(p_user) or (p_user = auth.uid() and exists (select 1 from public.team_members where user_id = auth.uid() and role = 'manager'))) then raise exception 'not_allowed'; end if;
  if not p_approve then
    delete from public.month_approvals where user_id = p_user and month = p_month;
    return;
  end if;
  select team_id into tid from public.team_members where user_id = p_user;
  select coalesce(sum(amount), 0), count(*) into tot, c from public.entries where user_id = p_user and month = p_month;
  insert into public.month_approvals (user_id, month, team_id, approved_by, total, cnt)
    values (p_user, p_month, tid, auth.uid(), tot, c)
    on conflict (user_id, month) do update set approved_by = excluded.approved_by, approved_at = now(), total = excluded.total, cnt = excluded.cnt;
end $$;

drop function if exists public.team_overview(text);
create function public.team_overview(p_month text)
returns table (user_id uuid, role text, name text, email text, phone text, avatar text, cnt integer, total integer, ultra integer, approved boolean, custom boolean)
language plpgsql stable security definer set search_path = '' as $$
declare tid uuid;
begin
  select m.team_id into tid from public.team_members m where m.user_id = auth.uid() and m.role = 'manager';
  if tid is null then raise exception 'not_manager'; end if;
  return query
  select m.user_id, m.role, coalesce(s.name, ''), u.email::text, coalesce(s.my_phone, ''), coalesce(s.avatar, ''),
    count(e.id)::int, coalesce(sum(e.amount), 0)::int, count(e.id) filter (where e.big)::int,
    exists (select 1 from public.month_approvals a where a.user_id = m.user_id and a.month = p_month),
    m.config is not null
  from public.team_members m
  join auth.users u on u.id = m.user_id
  left join public.settings s on s.user_id = m.user_id
  left join public.entries e on e.user_id = m.user_id and e.month = p_month
  where m.team_id = tid
  group by m.user_id, m.role, s.name, u.email, s.my_phone, s.avatar, m.config
  order by m.role, coalesce(sum(e.amount), 0) desc;
end $$;

revoke execute on function public.create_team(text), public.join_team(text), public.leave_team(), public.remove_member(uuid), public.team_overview(text), public.approve_month(uuid, text, boolean), public.my_team_id(), public.is_manager_of(uuid), public.is_month_locked(uuid, text) from public, anon;
grant execute on function public.create_team(text), public.join_team(text), public.leave_team(), public.remove_member(uuid), public.team_overview(text), public.approve_month(uuid, text, boolean), public.my_team_id(), public.is_manager_of(uuid), public.is_month_locked(uuid, text) to authenticated;

-- cleanup: the old test account and an unused extension
delete from auth.users where email = 'selftest-bonus@example.com';
drop extension if exists pg_net;

select 'הכל עודכן בהצלחה ✅' as result;
