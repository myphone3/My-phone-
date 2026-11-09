-- NEW PHONE: logo per version (for example the KosherPlay logo) and the emails of the admins
-- for the "new order" alert. Safe to run again.

-- 1) Logo per version (uploaded in the admin "גרסאות" screen)
alter table public.versions add column if not exists image_url text;

-- 2) Old "limited" values become "yes": every feature is now yes or no
update public.versions v
   set features = (
     select coalesce(jsonb_object_agg(k, case when val = '"limited"'::jsonb then '"yes"'::jsonb else val end), '{}'::jsonb)
       from jsonb_each(v.features) as e(k, val)
   )
 where v.features::text like '%limited%';

-- 3) Admin emails for the "new order" alert. Only the server can call it: it needs the cron secret
--    (the same CRON_SECRET that Vercel already has).
create or replace function public.order_alert_recipients(p_secret text)
returns setof text
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
    select distinct u.email::text
      from public.admins a
      join auth.users u on u.id = a.user_id
     where u.email is not null;
end;
$$;
revoke all on function public.order_alert_recipients(text) from public;
grant execute on function public.order_alert_recipients(text) to anon, authenticated;
