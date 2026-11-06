-- NEW PHONE: internal notes, staff accounts with roles, daily summary email. Safe to run again.

-- הערות פנימיות (הלקוח לא רואה)
alter table public.orders add column if not exists admin_notes text;

create table if not exists public.customer_notes (
  email text primary key,
  note text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.customer_notes enable row level security;
drop policy if exists "admins manage customer notes" on public.customer_notes;
create policy "admins manage customer notes" on public.customer_notes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- עלויות ורווח: רק לבעלים (עובד לא רואה)
drop policy if exists "admins manage product costs" on public.product_costs;
drop policy if exists "owners manage product costs" on public.product_costs;
create policy "owners manage product costs" on public.product_costs
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- התפקיד של המשתמש המחובר: owner / staff / null
create or replace function public.my_admin_role()
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.role from public.admins a where a.user_id = auth.uid();
$$;
revoke all on function public.my_admin_role() from public;
grant execute on function public.my_admin_role() to authenticated;

create or replace function public.admin_list_staff()
returns table (user_id uuid, email text, role text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_owner() then
    return;
  end if;
  return query select a.user_id, a.email, a.role, a.created_at from public.admins a order by a.created_at;
end;
$$;
revoke all on function public.admin_list_staff() from public;
grant execute on function public.admin_list_staff() to authenticated;

-- הוספת עובד לפי מייל (העובד צריך להתחבר לאתר עם גוגל פעם אחת קודם)
create or replace function public.admin_add_staff(p_email text, p_role text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_owner() then
    return 'not_allowed';
  end if;
  if p_role not in ('owner', 'staff') then
    return 'bad_role';
  end if;
  select u.id into v_user from auth.users u where lower(u.email) = v_email;
  if v_user is null then
    return 'not_found';
  end if;
  if v_user = auth.uid() then
    return 'self';
  end if;
  insert into public.admins (user_id, email, role) values (v_user, v_email, p_role)
  on conflict (user_id) do update set role = excluded.role, email = excluded.email;
  return 'ok';
end;
$$;
revoke all on function public.admin_add_staff(text, text) from public;
grant execute on function public.admin_add_staff(text, text) to authenticated;

create or replace function public.admin_remove_staff(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_owner() then
    return 'not_allowed';
  end if;
  if p_user_id = auth.uid() then
    return 'self';
  end if;
  delete from public.admins where user_id = p_user_id;
  return 'ok';
end;
$$;
revoke all on function public.admin_remove_staff(uuid) from public;
grant execute on function public.admin_remove_staff(uuid) to authenticated;

-- סיכום יומי לחנות (נקרא רק מהשרת עם הסוד של המשימות המתוזמנות)
create or replace function public.daily_summary(p_secret text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  -- גבולות "אתמול" לפי שעון ישראל (כולל מעבר שעון קיץ/חורף)
  v_today date := (now() at time zone 'Asia/Jerusalem')::date;
  v_from timestamptz := (v_today - 1)::timestamp at time zone 'Asia/Jerusalem';
  v_to timestamptz := v_today::timestamp at time zone 'Asia/Jerusalem';
begin
  if p_secret is null or p_secret is distinct from (select s.value from public.app_secrets s where s.name = 'cron') then
    return null;
  end if;
  return jsonb_build_object(
    'date', to_char(v_from at time zone 'Asia/Jerusalem', 'DD.MM.YYYY'),
    'orders', (select count(*) from orders o where o.created_at >= v_from and o.created_at < v_to and o.status is distinct from 'מבוטל'),
    'revenue', (select coalesce(sum(coalesce(o.total_price, o.total, 0)), 0) from orders o where o.created_at >= v_from and o.created_at < v_to and o.status is distinct from 'מבוטל'),
    'month_revenue', (select coalesce(sum(coalesce(o.total_price, o.total, 0)), 0) from orders o
                       where o.created_at >= date_trunc('month', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem'
                         and o.status is distinct from 'מבוטל'),
    'pending', (select count(*) from orders o where coalesce(o.status, 'חדש') in ('חדש', 'בטיפול')),
    'top', (select coalesce(jsonb_agg(t order by t.qty desc), '[]'::jsonb) from (
              select i->>'name' as name, sum(coalesce((i->>'quantity')::int, 1)) as qty
                from orders o, jsonb_array_elements(case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end) i
               where o.created_at >= v_from and o.created_at < v_to and o.status is distinct from 'מבוטל'
               group by 1 order by 2 desc limit 5) t),
    'low_stock', (select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'stock', p.stock) order by p.stock), '[]'::jsonb)
                    from products p where p.stock is not null and p.stock <= 2 and coalesce(p.is_published, true))
  );
end;
$$;
revoke all on function public.daily_summary(text) from public;
grant execute on function public.daily_summary(text) to anon, authenticated;
