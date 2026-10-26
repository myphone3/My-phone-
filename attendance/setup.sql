-- הקמת מסד הנתונים של שעון הנוכחות בפרויקט Supabase חדש.
-- מריצים פעם אחת: Supabase → SQL Editor → New query → מדביקים → Run.
create table if not exists public.attendance_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null check (char_length(phone) between 9 and 20),
  email text,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.attendance_accounts enable row level security;
drop policy if exists "attendance own select" on public.attendance_accounts;
drop policy if exists "attendance own insert" on public.attendance_accounts;
drop policy if exists "attendance own update" on public.attendance_accounts;
drop policy if exists "attendance own delete" on public.attendance_accounts;
create policy "attendance own select" on public.attendance_accounts for select to authenticated using ((select auth.uid()) = user_id);
create policy "attendance own insert" on public.attendance_accounts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "attendance own update" on public.attendance_accounts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "attendance own delete" on public.attendance_accounts for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.attendance_accounts from anon;
grant select, insert, update, delete on public.attendance_accounts to authenticated;
