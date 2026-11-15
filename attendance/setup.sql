-- שעון נוכחות: הקמת מסד הנתונים בפרויקט Supabase.
-- מריצים פעם אחת: Supabase → SQL Editor → New query → מדביקים → Run. אפשר להריץ שוב בלי נזק.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------- חשבון ונתוני העובד ----------
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

-- ---------- מכשירים שמקבלים התראות ----------
create table if not exists public.attendance_push_subs (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists attendance_push_subs_user on public.attendance_push_subs(user_id);
alter table public.attendance_push_subs enable row level security;
drop policy if exists "push own all" on public.attendance_push_subs;
create policy "push own all" on public.attendance_push_subs for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.attendance_push_subs from anon;
grant select, insert, update, delete on public.attendance_push_subs to authenticated;

-- ---------- דוחות שנשלחו לאישור הבוס ----------
create table if not exists public.attendance_reports (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null,
  job_id text not null default '',
  snapshot jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approver_name text,
  boss_note text,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists attendance_reports_user on public.attendance_reports(user_id, period);
alter table public.attendance_reports enable row level security;
drop policy if exists "reports own select" on public.attendance_reports;
drop policy if exists "reports own insert" on public.attendance_reports;
drop policy if exists "reports own delete" on public.attendance_reports;
create policy "reports own select" on public.attendance_reports for select to authenticated using ((select auth.uid()) = user_id);
create policy "reports own insert" on public.attendance_reports for insert to authenticated with check ((select auth.uid()) = user_id and status = 'pending' and approver_name is null and responded_at is null);
create policy "reports own delete" on public.attendance_reports for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.attendance_reports from anon;
grant select, insert, delete on public.attendance_reports to authenticated;

-- הבוס פותח קישור עם מזהה אקראי, בלי חשבון: רואה רק את הדוח הזה
create or replace function public.attendance_get_report(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('snapshot', snapshot, 'status', status, 'approver_name', approver_name,
    'boss_note', boss_note, 'responded_at', responded_at, 'created_at', created_at)
  from attendance_reports where token = p_token;
$$;

create or replace function public.attendance_respond_report(p_token uuid, p_approve boolean, p_name text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r attendance_reports;
begin
  if coalesce(btrim(p_name), '') = '' or char_length(p_name) > 60 or char_length(coalesce(p_note, '')) > 500 then
    raise exception 'invalid input';
  end if;
  update attendance_reports set status = case when p_approve then 'approved' else 'rejected' end,
    approver_name = btrim(p_name), boss_note = nullif(btrim(coalesce(p_note, '')), ''), responded_at = now()
  where token = p_token and status = 'pending'
  returning * into r;
  if r.token is null then
    return attendance_get_report(p_token);
  end if;
  insert into attendance_outbox(user_id, key, title, body)
  values (r.user_id, 'boss:' || r.token,
    case when p_approve then 'הבוס אישר את הדוח' else 'הבוס השאיר הערה על הדוח' end,
    coalesce(r.snapshot->>'periodLabel', '') || ' · ' || btrim(p_name) || coalesce(' : ' || nullif(btrim(coalesce(p_note, '')), ''), ''))
  on conflict do nothing;
  return attendance_get_report(p_token);
end $$;

-- ---------- התראות ברקע ----------
create table if not exists public.attendance_outbox (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (user_id, key)
);
alter table public.attendance_outbox enable row level security;
revoke all on public.attendance_outbox from anon, authenticated;

create table if not exists public.attendance_config (key text primary key, value text not null);
alter table public.attendance_config enable row level security;
revoke all on public.attendance_config from anon, authenticated;

revoke all on function public.attendance_get_report(uuid) from public;
revoke all on function public.attendance_respond_report(uuid, boolean, text, text) from public;
grant execute on function public.attendance_get_report(uuid) to anon, authenticated;
grant execute on function public.attendance_respond_report(uuid, boolean, text, text) to anon, authenticated;

-- רץ כל דקה: מוצא משמרות שמסתיימות, משמרות שנשכחו פתוחות ותזכורות בוקר, ושולח לשרת ההתראות
create or replace function public.attendance_dispatch()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_url text; v_secret text; r record; msgs jsonb;
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  il timestamp := now() at time zone 'Asia/Jerusalem';
  rem numeric; worked numeric;
begin
  select value into v_url from attendance_config where key = 'push_url';
  select value into v_secret from attendance_config where key = 'push_secret';
  if v_url is null or v_secret is null then return 0; end if;

  for r in
    select a.user_id, a.data->'settings' st, (a.data->'active'->>'start')::bigint s,
      case when coalesce(a.data->'active'->>'planMin', '') ~ '^\d+(\.\d+)?$' then (a.data->'active'->>'planMin')::numeric end plan,
      coalesce((select sum(case when coalesce(b->>'min', '') ~ '^\d+(\.\d+)?$' then (b->>'min')::numeric else 0 end)
        from jsonb_array_elements(case when jsonb_typeof(a.data->'active'->'breaks') = 'array' then a.data->'active'->'breaks' else '[]'::jsonb end) b), 0) * 60000
      + case when coalesce(a.data->'active'->>'breakMs', '') ~ '^\d+(\.\d+)?$' then (a.data->'active'->>'breakMs')::numeric else 0 end
      + case when coalesce(a.data->'active'->>'breakStart', '') ~ '^\d+$' then now_ms - (a.data->'active'->>'breakStart')::bigint else 0 end brk
    from attendance_accounts a
    where jsonb_typeof(a.data->'active') = 'object' and coalesce(a.data->'active'->>'start', '') ~ '^\d+$'
      and exists (select 1 from attendance_push_subs p where p.user_id = a.user_id)
  loop
    worked := now_ms - r.s - r.brk;
    if r.plan is not null and r.plan > 0 then
      rem := r.plan * 60000 - worked;
      if coalesce((r.st->>'alertBefore')::boolean, true) and rem > 0 and rem <= 600000 then
        insert into attendance_outbox(user_id, key, title, body) values (r.user_id, 'pre:' || r.s || ':' || r.plan,
          'עוד ' || ceil(rem / 60000) || ' דקות מסיימים', 'המשמרת מסתיימת ב-' || to_char(il + (rem || ' milliseconds')::interval, 'HH24:MI'))
        on conflict do nothing;
      end if;
      if rem <= 0 and rem > -1800000 then
        insert into attendance_outbox(user_id, key, title, body) values (r.user_id, 'end:' || r.s || ':' || r.plan,
          'המשמרת הסתיימה', 'השלמת את השעות שתכננת. לא לשכוח להחתים יציאה.')
        on conflict do nothing;
      end if;
    end if;
    if worked > greatest(coalesce(r.plan, 0) * 60000 + 3 * 3600000, 12 * 3600000) then
      insert into attendance_outbox(user_id, key, title, body) values (r.user_id, 'long:' || r.s,
        'המשמרת עדיין פתוחה', 'עברו ' || floor(worked / 3600000) || ' שעות מהכניסה. שכחת להחתים יציאה?')
      on conflict do nothing;
    end if;
  end loop;

  -- תזכורת בוקר למי שעוד לא נכנס היום
  insert into attendance_outbox(user_id, key, title, body)
  select a.user_id, 'morning:' || to_char(il, 'YYYY-MM-DD'), 'בוקר טוב! לא לשכוח להחתים כניסה', 'לחצו כאן כדי לפתוח את השעון'
  from attendance_accounts a
  where coalesce((a.data->'settings'->>'remindOn')::boolean, false)
    and coalesce(a.data->'settings'->>'remindTime', '') ~ '^\d{2}:\d{2}$'
    and il::time >= (a.data->'settings'->>'remindTime')::time
    and il::time < (a.data->'settings'->>'remindTime')::time + interval '15 minutes'
    and (jsonb_typeof(a.data->'settings'->'remindDays') <> 'array'
         or (a.data->'settings'->'remindDays') @> to_jsonb(extract(dow from il)::int))
    and jsonb_typeof(a.data->'active') is distinct from 'object'
    and not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(a.data->'shifts') = 'array' then a.data->'shifts' else '[]'::jsonb end) x
                    where x->>'date' = to_char(il, 'YYYY-MM-DD'))
    and exists (select 1 from attendance_push_subs p where p.user_id = a.user_id)
  on conflict do nothing;

  select coalesce(jsonb_agg(jsonb_build_object('endpoint', p.endpoint, 'p256dh', p.p256dh, 'auth', p.auth,
           'title', o.title, 'body', o.body, 'tag', split_part(o.key, ':', 1))), '[]'::jsonb)
    into msgs
  from attendance_outbox o join attendance_push_subs p on p.user_id = o.user_id
  where o.sent_at is null and o.created_at > now() - interval '1 hour';

  update attendance_outbox set sent_at = now() where sent_at is null;
  delete from attendance_outbox where created_at < now() - interval '3 days';

  if jsonb_array_length(msgs) > 0 then
    perform net.http_post(url := v_url, body := jsonb_build_object('messages', msgs),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret));
  end if;
  return jsonb_array_length(msgs);
end $$;
revoke all on function public.attendance_dispatch() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'attendance-dispatch';
select cron.schedule('attendance-dispatch', '* * * * *', 'select public.attendance_dispatch()');

-- כתובת שרת ההתראות והסיסמה המשותפת נכנסות בנפרד (לא בקובץ הזה):
-- insert into public.attendance_config values ('push_url', 'https://<האתר>/api/push'), ('push_secret', '<סוד>')
--   on conflict (key) do update set value = excluded.value;
