-- שדרוג 2: טלפונים לשירות, הרחבת אחריות, קבצי PDF, התראות לטלפון לפני שהאחריות נגמרת

alter table public.wr_receipts add column if not exists store_phone text;
alter table public.wr_receipts add column if not exists service_phone text;   -- מעבדה / יבואן
alter table public.wr_receipts add column if not exists receipt_no text;
alter table public.wr_receipts add column if not exists ext_months int;       -- הרחבת אחריות (חודשים נוספים אחרי האחריות הרגילה)
alter table public.wr_receipts add column if not exists ext_provider text;
alter table public.wr_receipts add column if not exists ext_price numeric;

update storage.buckets set file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'] where id = 'wr-photos';

create or replace function public.wr_save_receipt(p_vault uuid, p jsonb)
returns public.wr_receipts language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id','')::uuid; r wr_receipts;
begin
  if not exists (select 1 from wr_vaults where id = p_vault) then raise exception 'vault not found'; end if;
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

-- התראות
create table if not exists public.wr_config (key text primary key, value text not null);
create table if not exists public.wr_push (
  endpoint text primary key,
  vault_id uuid not null references public.wr_vaults(id) on delete cascade,
  sub jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.wr_sent (
  receipt_id uuid not null references public.wr_receipts(id) on delete cascade,
  kind text not null,
  sent_at timestamptz not null default now(),
  primary key (receipt_id, kind)
);
alter table public.wr_config enable row level security;
alter table public.wr_push enable row level security;
alter table public.wr_sent enable row level security;
revoke all on public.wr_config, public.wr_push, public.wr_sent from anon, authenticated;

create or replace function public.wr_push_subscribe(p_vault uuid, p_sub jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from wr_vaults where id = p_vault) then raise exception 'vault not found'; end if;
  if coalesce(p_sub->>'endpoint','') !~ '^https://' then raise exception 'bad subscription'; end if;
  insert into wr_push(endpoint, vault_id, sub) values (p_sub->>'endpoint', p_vault, p_sub)
  on conflict (endpoint) do update set vault_id = excluded.vault_id, sub = excluded.sub;
end $$;

create or replace function public.wr_push_unsubscribe(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from wr_push where endpoint = p_endpoint;
$$;

-- לשרת (cron): מה צריך לשלוח היום. מסמן כנשלח כדי לא לשלוח פעמיים.
-- '30' = נשאר עד חודש, '7' = נשאר עד שבוע
create or replace function public.wr_push_due(p_secret text)
returns json language plpgsql security definer set search_path = public as $$
declare out json;
begin
  if p_secret is null or p_secret <> (select value from wr_config where key = 'cron_secret') then raise exception 'unauthorized'; end if;
  with ends as (
    select r.*, ((r.purchase_date + make_interval(months => r.warranty_months + coalesce(r.ext_months,0)))::date - current_date) as days
    from wr_receipts r
    where r.purchase_date is not null and coalesce(r.warranty_months,0) > 0
  ), due as (
    select e.*, case when e.days <= 7 then '7' else '30' end as kind
    from ends e
    where e.days between 0 and 30
      and not exists (select 1 from wr_sent s where s.receipt_id = e.id and (s.kind = case when e.days <= 7 then '7' else '30' end or s.kind = '7'))
      and exists (select 1 from wr_push p where p.vault_id = e.vault_id)
  ), mark as (
    insert into wr_sent(receipt_id, kind) select id, kind from due on conflict do nothing returning receipt_id
  )
  select coalesce(json_agg(json_build_object('endpoint', p.endpoint, 'sub', p.sub, 'vault_id', d.vault_id, 'id', d.id,
           'product', d.product, 'store', d.store, 'days', d.days, 'kind', d.kind)), '[]'::json)
  into out
  from due d join wr_push p on p.vault_id = d.vault_id;
  return out;
end $$;

create or replace function public.wr_push_gone(p_secret text, p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_secret is null or p_secret <> (select value from wr_config where key = 'cron_secret') then raise exception 'unauthorized'; end if;
  delete from wr_push where endpoint = p_endpoint;
end $$;

revoke all on function public.wr_push_subscribe(uuid,jsonb), public.wr_push_unsubscribe(text),
  public.wr_push_due(text), public.wr_push_gone(text,text) from public;
grant execute on function public.wr_push_subscribe(uuid,jsonb), public.wr_push_unsubscribe(text),
  public.wr_push_due(text), public.wr_push_gone(text,text) to anon, authenticated;
