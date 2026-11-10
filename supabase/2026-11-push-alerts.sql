-- NEW PHONE: push notifications to the admins' phones when a new order comes in. Safe to run again.
-- Each admin turns it on in the panel ("התראות לטלפון"); the browser gives an endpoint that is saved here.
-- The server sends the push after an order, using the cron secret to read the list.

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  device text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

drop policy if exists "admins manage own push" on public.push_subscriptions;
create policy "admins manage own push" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid() and public.is_admin())
  with check (user_id = auth.uid() and public.is_admin());

-- The server reads all subscriptions (cron secret only)
create or replace function public.order_push_targets(p_secret text)
returns table (endpoint text, p256dh text, auth text)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if p_secret is null or p_secret is distinct from (select s.value from public.app_secrets s where s.name = 'cron') then
    raise exception 'not allowed';
  end if;
  return query
    select s.endpoint, s.p256dh, s.auth
      from public.push_subscriptions s
      join public.admins a on a.user_id = s.user_id;
end;
$$;
revoke all on function public.order_push_targets(text) from public;
grant execute on function public.order_push_targets(text) to anon, authenticated;

-- Remove a subscription the browser no longer accepts (expired / uninstalled)
create or replace function public.drop_push_target(p_secret text, p_endpoint text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_secret is null or p_secret is distinct from (select s.value from public.app_secrets s where s.name = 'cron') then
    raise exception 'not allowed';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
end;
$$;
revoke all on function public.drop_push_target(text, text) from public;
grant execute on function public.drop_push_target(text, text) to anon, authenticated;
