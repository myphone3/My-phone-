-- יומן בונוסים: סגן מנהל, הערות מנהל, סימון תשלום, יעד צוות
alter table public.team_members add column if not exists can_approve boolean not null default false;
alter table public.entries add column if not exists mgr_note text not null default '';
alter table public.month_approvals add column if not exists paid_at timestamptz;
alter table public.teams add column if not exists team_goal integer;
alter table public.teams add column if not exists team_bonus integer;
grant update (can_approve) on public.team_members to authenticated;

create or replace function public.is_manager_of(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_members me
    join public.team_members t on t.team_id = me.team_id
    where me.user_id = auth.uid() and (me.role = 'manager' or me.can_approve) and t.user_id = target
  );
$$;

create or replace function public.guard_member_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;
  if (new.config is distinct from old.config or new.goal is distinct from old.goal or new.can_approve is distinct from old.can_approve
      or new.role is distinct from old.role or new.team_id is distinct from old.team_id)
     and not exists (select 1 from public.team_members m where m.user_id = auth.uid() and m.team_id = old.team_id and m.role = 'manager') then
    raise exception 'manager_only';
  end if;
  return new;
end $$;
drop trigger if exists guard_member_update on public.team_members;
create trigger guard_member_update before update on public.team_members for each row execute function public.guard_member_update();

drop policy if exists "manager notes team entries" on public.entries;
create policy "manager notes team entries" on public.entries for update to authenticated
  using ((select public.is_manager_of(user_id))) with check ((select public.is_manager_of(user_id)));

create or replace function public.remove_member(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user = auth.uid() or not exists (select 1 from public.team_members me join public.team_members t on t.team_id = me.team_id where me.user_id = auth.uid() and me.role = 'manager' and t.user_id = p_user) then
    raise exception 'not_allowed';
  end if;
  delete from public.team_members where user_id = p_user and role = 'member';
end $$;

drop function if exists public.team_overview(text);
create function public.team_overview(p_month text)
returns table (user_id uuid, role text, name text, email text, phone text, avatar text, cnt integer, total integer, ultra integer, approved boolean, custom boolean, can_approve boolean, paid boolean)
language plpgsql stable security definer set search_path = '' as $$
declare tid uuid;
begin
  select m.team_id into tid from public.team_members m where m.user_id = auth.uid() and (m.role = 'manager' or m.can_approve);
  if tid is null then raise exception 'not_manager'; end if;
  return query
  select m.user_id, m.role, coalesce(s.name, ''), u.email::text, coalesce(s.my_phone, ''), coalesce(s.avatar, ''),
    count(e.id)::int, coalesce(sum(e.amount), 0)::int, count(e.id) filter (where e.big)::int,
    exists (select 1 from public.month_approvals a where a.user_id = m.user_id and a.month = p_month),
    m.config is not null, m.can_approve,
    exists (select 1 from public.month_approvals a where a.user_id = m.user_id and a.month = p_month and a.paid_at is not null)
  from public.team_members m
  join auth.users u on u.id = m.user_id
  left join public.settings s on s.user_id = m.user_id
  left join public.entries e on e.user_id = m.user_id and e.month = p_month
  where m.team_id = tid
  group by m.user_id, m.role, s.name, u.email, s.my_phone, s.avatar, m.config, m.can_approve
  order by m.role, coalesce(sum(e.amount), 0) desc;
end $$;

create or replace function public.set_paid(p_user uuid, p_month text, p_paid boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.team_members me join public.team_members t on t.team_id = me.team_id
                 where me.user_id = auth.uid() and me.role = 'manager' and t.user_id = p_user) then raise exception 'not_allowed'; end if;
  update public.month_approvals set paid_at = case when p_paid then now() else null end where user_id = p_user and month = p_month;
  if not found then raise exception 'not_approved'; end if;
end $$;

create or replace function public.team_progress(p_month text)
returns table (total integer, team_goal integer, team_bonus integer, people integer)
language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(e.amount) from public.entries e join public.team_members m on m.user_id = e.user_id
                   where m.team_id = t.id and e.month = p_month), 0)::int,
         t.team_goal, t.team_bonus,
         (select count(*) from public.team_members m where m.team_id = t.id)::int
  from public.teams t where t.id = public.my_team_id();
$$;

revoke execute on function public.team_overview(text), public.set_paid(uuid, text, boolean), public.team_progress(text) from public, anon;
grant execute on function public.team_overview(text), public.set_paid(uuid, text, boolean), public.team_progress(text) to authenticated;
revoke execute on function public.guard_member_update() from public, anon, authenticated;

select 'הכל עודכן בהצלחה ✅' as result;
