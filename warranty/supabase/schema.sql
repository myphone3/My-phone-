-- קבלות לאחריות: טבלאות נפרדות (wr_) באותו פרויקט Supabase.
-- הגישה רק דרך פונקציות שמקבלות את מזהה הארכיון (הקישור הסודי) — אין גישה ישירה לטבלאות.

create table if not exists public.wr_vaults (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'הקבלות שלי',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wr_receipts (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references public.wr_vaults(id) on delete cascade,
  product text not null default '',
  store text not null default '',
  category text,
  purchase_date date,
  price numeric,
  warranty_months int,                 -- null = לא ידוע, 0 = בלי אחריות
  serial text,
  notes text,
  items text[] not null default '{}',  -- כל המוצרים שהופיעו בקבלה (לחיפוש)
  photos text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wr_receipts_vault_idx on public.wr_receipts(vault_id);

alter table public.wr_vaults enable row level security;
alter table public.wr_receipts enable row level security;
revoke all on public.wr_vaults, public.wr_receipts from anon, authenticated;

create or replace function public.wr_create_vault(p_name text)
returns uuid language sql security definer set search_path = public as $$
  insert into wr_vaults(name) values (left(coalesce(nullif(trim(p_name),''),'הקבלות שלי'),60)) returning id;
$$;

create or replace function public.wr_get_vault(p_vault uuid)
returns json language sql stable security definer set search_path = public as $$
  select case when v.id is null then null else json_build_object(
    'vault', json_build_object('id', v.id, 'name', v.name),
    'receipts', coalesce((select json_agg(r order by r.purchase_date desc nulls last, r.created_at desc)
                          from wr_receipts r where r.vault_id = v.id), '[]'::json)
  ) end
  from (select 1) x left join wr_vaults v on v.id = p_vault;
$$;

create or replace function public.wr_rename_vault(p_vault uuid, p_name text)
returns void language sql security definer set search_path = public as $$
  update wr_vaults set name = left(coalesce(nullif(trim(p_name),''),name),60), updated_at = now() where id = p_vault;
$$;

-- שמירת קבלה: בלי id = חדשה, עם id = עדכון
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

create or replace function public.wr_delete_receipt(p_vault uuid, p_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from wr_receipts where id = p_id and vault_id = p_vault;
$$;

revoke all on function public.wr_create_vault(text), public.wr_get_vault(uuid), public.wr_rename_vault(uuid,text),
  public.wr_save_receipt(uuid,jsonb), public.wr_delete_receipt(uuid,uuid) from public;
grant execute on function public.wr_create_vault(text), public.wr_get_vault(uuid), public.wr_rename_vault(uuid,text),
  public.wr_save_receipt(uuid,jsonb), public.wr_delete_receipt(uuid,uuid) to anon, authenticated;

-- תמונות הקבלות (שם קובץ אקראי בתוך תיקיית הארכיון)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wr-photos','wr-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'wr photos upload') then
    create policy "wr photos upload" on storage.objects for insert to anon, authenticated with check (bucket_id = 'wr-photos');
  end if;
end $$;
