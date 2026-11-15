-- אפליקציית מתכונים לטלוויזיה ולטלפון: טבלאות נפרדות (rc_) באותו פרויקט Supabase.
-- הגישה רק דרך פונקציות שמקבלות את מזהה המטבח (הקישור הסודי) — אין גישה ישירה לטבלאות.

create table if not exists public.rc_kitchens (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'המטבח שלי',
  music jsonb not null default '[]'::jsonb,
  plan jsonb not null default '{}'::jsonb,          -- תפריט שבועי: {"2026-11-20": ["recipe-id", ...]}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rc_recipes (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.rc_kitchens(id) on delete cascade,
  title text not null,
  description text,
  category text,
  tags text[] not null default '{}',
  servings numeric,
  prep_minutes int,
  cook_minutes int,
  image_url text,
  source_images text[] not null default '{}',
  ingredients jsonb not null default '[]'::jsonb, -- [{title, items:["2 כוסות קמח", ...]}]
  steps jsonb not null default '[]'::jsonb,       -- [{title, items:["מערבבים...", ...]}]
  tips jsonb not null default '[]'::jsonb,        -- ["...", ...]
  favorite boolean not null default false,
  rating int,
  notes text,
  source_url text,
  cooked_count int not null default 0,
  last_cooked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rc_recipes_kitchen_idx on public.rc_recipes(kitchen_id);

alter table public.rc_kitchens enable row level security;
alter table public.rc_recipes enable row level security;
revoke all on public.rc_kitchens, public.rc_recipes from anon, authenticated;

create or replace function public.rc_create_kitchen(p_name text)
returns uuid language sql security definer set search_path = public as $$
  insert into rc_kitchens(name) values (coalesce(nullif(trim(p_name),''),'המטבח שלי')) returning id;
$$;

create or replace function public.rc_get_kitchen(p_kitchen uuid)
returns json language sql stable security definer set search_path = public as $$
  select case when k.id is null then null else json_build_object(
    'kitchen', json_build_object('id', k.id, 'name', k.name, 'music', k.music, 'plan', k.plan),
    'recipes', coalesce((select json_agg(r order by r.created_at desc) from rc_recipes r where r.kitchen_id = k.id), '[]'::json)
  ) end
  from (select 1) x left join rc_kitchens k on k.id = p_kitchen;
$$;

create or replace function public.rc_update_kitchen(p_kitchen uuid, p_name text, p_music jsonb, p_plan jsonb default null)
returns void language sql security definer set search_path = public as $$
  update rc_kitchens set
    name = coalesce(nullif(trim(p_name),''), name),
    music = coalesce(p_music, music),
    plan = coalesce(p_plan, plan),
    updated_at = now()
  where id = p_kitchen;
$$;

-- שמירת מתכון: בלי id = חדש, עם id = עדכון
create or replace function public.rc_save_recipe(p_kitchen uuid, p_recipe jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p_recipe->>'id','')::uuid;
  v_row rc_recipes;
begin
  if not exists (select 1 from rc_kitchens where id = p_kitchen) then
    raise exception 'kitchen not found';
  end if;
  if v_id is null then
    insert into rc_recipes(kitchen_id, title) values (p_kitchen, coalesce(nullif(trim(p_recipe->>'title'),''),'מתכון חדש'))
    returning id into v_id;
  elsif not exists (select 1 from rc_recipes where id = v_id and kitchen_id = p_kitchen) then
    raise exception 'recipe not found';
  end if;
  update rc_recipes set
    title = coalesce(nullif(trim(p_recipe->>'title'),''), title),
    description = p_recipe->>'description',
    category = nullif(trim(coalesce(p_recipe->>'category','')),''),
    tags = coalesce((select array_agg(t) from jsonb_array_elements_text(coalesce(p_recipe->'tags','[]'::jsonb)) t), '{}'),
    servings = nullif(p_recipe->>'servings','')::numeric,
    prep_minutes = nullif(p_recipe->>'prep_minutes','')::int,
    cook_minutes = nullif(p_recipe->>'cook_minutes','')::int,
    image_url = nullif(p_recipe->>'image_url',''),
    source_images = coalesce((select array_agg(t) from jsonb_array_elements_text(coalesce(p_recipe->'source_images','[]'::jsonb)) t), '{}'),
    ingredients = coalesce(p_recipe->'ingredients', '[]'::jsonb),
    steps = coalesce(p_recipe->'steps', '[]'::jsonb),
    tips = coalesce(p_recipe->'tips', '[]'::jsonb),
    favorite = coalesce((p_recipe->>'favorite')::boolean, favorite),
    notes = case when p_recipe ? 'notes' then nullif(p_recipe->>'notes','') else notes end,
    rating = case when p_recipe ? 'rating' then nullif(p_recipe->>'rating','')::int else rating end,
    source_url = case when p_recipe ? 'source_url' then nullif(p_recipe->>'source_url','') else source_url end,
    updated_at = now()
  where id = v_id
  returning * into v_row;
  return row_to_json(v_row);
end $$;

create or replace function public.rc_set_favorite(p_kitchen uuid, p_id uuid, p_value boolean)
returns void language sql security definer set search_path = public as $$
  update rc_recipes set favorite = p_value where id = p_id and kitchen_id = p_kitchen;
$$;

-- עדכון חלקי: מועדף / דירוג / הערות אישיות
create or replace function public.rc_patch_recipe(p_kitchen uuid, p_id uuid, p_patch jsonb)
returns void language sql security definer set search_path = public as $$
  update rc_recipes set
    favorite = case when p_patch ? 'favorite' then (p_patch->>'favorite')::boolean else favorite end,
    rating = case when p_patch ? 'rating' then nullif(p_patch->>'rating','')::int else rating end,
    notes = case when p_patch ? 'notes' then nullif(p_patch->>'notes','') else notes end
  where id = p_id and kitchen_id = p_kitchen;
$$;

create or replace function public.rc_mark_cooked(p_kitchen uuid, p_id uuid)
returns void language sql security definer set search_path = public as $$
  update rc_recipes set cooked_count = cooked_count + 1, last_cooked_at = now() where id = p_id and kitchen_id = p_kitchen;
$$;

create or replace function public.rc_delete_recipe(p_kitchen uuid, p_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from rc_recipes where id = p_id and kitchen_id = p_kitchen;
$$;

revoke all on function public.rc_create_kitchen(text), public.rc_get_kitchen(uuid), public.rc_update_kitchen(uuid, text, jsonb, jsonb),
  public.rc_save_recipe(uuid, jsonb), public.rc_set_favorite(uuid, uuid, boolean), public.rc_patch_recipe(uuid, uuid, jsonb), public.rc_mark_cooked(uuid, uuid),
  public.rc_delete_recipe(uuid, uuid) from public;
grant execute on function public.rc_create_kitchen(text), public.rc_get_kitchen(uuid), public.rc_update_kitchen(uuid, text, jsonb, jsonb),
  public.rc_save_recipe(uuid, jsonb), public.rc_set_favorite(uuid, uuid, boolean), public.rc_patch_recipe(uuid, uuid, jsonb), public.rc_mark_cooked(uuid, uuid),
  public.rc_delete_recipe(uuid, uuid) to anon, authenticated;

-- תמונות המתכונים (צילומים ועמודי PDF)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rc-photos', 'rc-photos', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "rc photos upload" on storage.objects;
create policy "rc photos upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'rc-photos');
