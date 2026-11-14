-- תוספות: תמונות מנה מוכנה, ערכים תזונתיים, שיתוף מתכון עם חברים
alter table public.rc_recipes add column if not exists gallery text[] not null default '{}';
alter table public.rc_recipes add column if not exists nutrition jsonb;

create or replace function public.rc_patch_recipe(p_kitchen uuid, p_id uuid, p_patch jsonb)
returns void language sql security definer set search_path = public as $$
  update rc_recipes set
    favorite = case when p_patch ? 'favorite' then (p_patch->>'favorite')::boolean else favorite end,
    rating = case when p_patch ? 'rating' then nullif(p_patch->>'rating','')::int else rating end,
    notes = case when p_patch ? 'notes' then nullif(p_patch->>'notes','') else notes end,
    image_url = case when p_patch ? 'image_url' then nullif(p_patch->>'image_url','') else image_url end,
    gallery = case when p_patch ? 'add_photo' then (array[p_patch->>'add_photo'] || gallery)[1:30]
                   when p_patch ? 'gallery' then coalesce((select array_agg(t) from jsonb_array_elements_text(p_patch->'gallery') t), '{}')
                   else gallery end,
    nutrition = case when p_patch ? 'nutrition' then p_patch->'nutrition' else nutrition end
  where id = p_id and kitchen_id = p_kitchen;
$$;

create table if not exists public.rc_shares (
  code text primary key,
  recipe jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.rc_shares enable row level security;
revoke all on public.rc_shares from anon, authenticated;

-- יוצר קישור שיתוף (תמונת מצב של המתכון — בלי הערות אישיות)
create or replace function public.rc_share_recipe(p_kitchen uuid, p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text; v_r rc_recipes;
begin
  select * into v_r from rc_recipes where id = p_id and kitchen_id = p_kitchen;
  if v_r.id is null then raise exception 'recipe not found'; end if;
  v_code := substr(md5(random()::text || clock_timestamp()::text || p_id::text), 1, 10);
  insert into rc_shares(code, recipe) values (v_code, jsonb_build_object(
    'title', v_r.title, 'description', v_r.description, 'category', v_r.category, 'tags', v_r.tags,
    'servings', v_r.servings, 'prep_minutes', v_r.prep_minutes, 'cook_minutes', v_r.cook_minutes,
    'image_url', v_r.image_url, 'source_images', v_r.source_images, 'ingredients', v_r.ingredients,
    'steps', v_r.steps, 'tips', v_r.tips, 'nutrition', v_r.nutrition));
  return v_code;
end $$;

create or replace function public.rc_get_share(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select recipe from rc_shares where code = p_code;
$$;

revoke all on function public.rc_share_recipe(uuid, uuid), public.rc_get_share(text) from public;
grant execute on function public.rc_share_recipe(uuid, uuid), public.rc_get_share(text), public.rc_patch_recipe(uuid, uuid, jsonb) to anon, authenticated;
