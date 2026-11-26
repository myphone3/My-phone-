-- קופת המעבדה: הכנסות, הוצאות ומלאי. טבלאות נפרדות (ll_) באותו פרויקט Supabase.
-- הגישה רק דרך פונקציות שמקבלות את מזהה הקופה (הקישור הסודי) — אין גישה ישירה לטבלאות.

create table if not exists public.ll_books (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'קופת המעבדה',
  budget numeric not null default 0,
  min jsonb not null default '{}'::jsonb,   -- {שם חלק מנורמל: מינימום להתראה}
  adj jsonb not null default '[]'::jsonb,   -- הורדות ידניות מהמלאי [{k,qty,date,note}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ll_tx (
  id uuid primary key,
  book_id uuid not null references public.ll_books(id) on delete cascade,
  d date not null,
  data jsonb not null,                      -- כל שדות התנועה (סוג, סכום, תיאור, ספק, קישור, תמונות, חלקים מהמלאי...)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ll_tx_book_idx on public.ll_tx(book_id, d);

alter table public.ll_books enable row level security;
alter table public.ll_tx enable row level security;
revoke all on public.ll_books, public.ll_tx from anon, authenticated;

create or replace function public.ll_create_book(p_name text)
returns uuid language sql security definer set search_path = public as $$
  insert into ll_books(name) values (coalesce(nullif(trim(p_name),''),'קופת המעבדה')) returning id;
$$;

create or replace function public.ll_get_book(p_book uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'book', json_build_object('id', b.id, 'name', b.name, 'budget', b.budget, 'min', b.min, 'adj', b.adj),
    'tx', coalesce((select json_agg(t.data || jsonb_build_object('id', t.id) order by t.d) from ll_tx t where t.book_id = b.id), '[]'::json))
  from ll_books b where b.id = p_book;
$$;

create or replace function public.ll_update_book(p_book uuid, p jsonb)
returns void language sql security definer set search_path = public as $$
  update ll_books set
    name   = case when p ? 'name' then left(coalesce(nullif(trim(p->>'name'),''),name),80) else name end,
    budget = case when p ? 'budget' then coalesce((p->>'budget')::numeric,0) else budget end,
    min    = case when p ? 'min' then coalesce(p->'min','{}'::jsonb) else min end,
    updated_at = now()
  where id = p_book;
$$;

create or replace function public.ll_add_adj(p_book uuid, p_adj jsonb)
returns void language sql security definer set search_path = public as $$
  update ll_books set adj = adj || jsonb_build_array(p_adj), updated_at = now() where id = p_book;
$$;

-- שמירת תנועה: מזהה חדש = הוספה, קיים = עדכון (רק בתוך אותה קופה)
create or replace function public.ll_save_tx(p_book uuid, p_tx jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid := (p_tx->>'id')::uuid;
begin
  if not exists (select 1 from ll_books where id = p_book) then raise exception 'book not found'; end if;
  insert into ll_tx(id, book_id, d, data) values (v_id, p_book, (p_tx->>'date')::date, p_tx - 'id')
  on conflict (id) do update set d = excluded.d, data = excluded.data, updated_at = now()
  where ll_tx.book_id = p_book;
end $$;

create or replace function public.ll_delete_tx(p_book uuid, p_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from ll_tx where id = p_id and book_id = p_book;
$$;

revoke all on function public.ll_create_book(text), public.ll_get_book(uuid), public.ll_update_book(uuid, jsonb),
  public.ll_add_adj(uuid, jsonb), public.ll_save_tx(uuid, jsonb), public.ll_delete_tx(uuid, uuid) from public;
grant execute on function public.ll_create_book(text), public.ll_get_book(uuid), public.ll_update_book(uuid, jsonb),
  public.ll_add_adj(uuid, jsonb), public.ll_save_tx(uuid, jsonb), public.ll_delete_tx(uuid, uuid) to anon, authenticated;

-- תמונות: חשבוניות, צילומי מסך, חלקים ומכשירים
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ll-photos', 'll-photos', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "ll photos upload" on storage.objects;
create policy "ll photos upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'll-photos');
