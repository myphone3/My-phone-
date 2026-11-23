-- שדרוג 8: קבצים, סרטונים וקישורים בכל מידע + היסטוריית שאלות מלאה (לחיפוש לפי חברה / דגם)

-- ===== קבצים מצורפים לפריט =====
-- files = [{kind: file|video|link, url, name, size, mime}]
alter table public.kb_items add column if not exists files jsonb not null default '[]'::jsonb;

create or replace function public.kb_clean_item(p_shop uuid, p jsonb)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'type', left(coalesce(nullif(p->>'type',''),'note'),20),
    'title', left(coalesce(p->>'title',''),200),
    'body', left(coalesce(p->>'body',''),20000),
    'fields', case when jsonb_typeof(p->'fields') = 'object' then p->'fields' else '{}'::jsonb end,
    'tag_ids', coalesce((select jsonb_agg(t.id) from kb_tags t where t.shop_id = p_shop and t.deleted_at is null
        and t.id::text in (select jsonb_array_elements_text(case when jsonb_typeof(p->'tag_ids') = 'array' then p->'tag_ids' else '[]'::jsonb end))), '[]'::jsonb),
    'photos', coalesce((select jsonb_agg(x) from jsonb_array_elements_text(case when jsonb_typeof(p->'photos') = 'array' then p->'photos' else '[]'::jsonb end) x
        where x ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/kb-photos/'), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(jsonb_build_object(
          'kind', f->>'kind', 'url', left(f->>'url', 1000), 'name', left(coalesce(f->>'name',''), 120),
          'size', case when coalesce(f->>'size','') ~ '^\d{1,10}$' then (f->>'size')::bigint end, 'mime', left(coalesce(f->>'mime',''), 100)))
        from (select f from jsonb_array_elements(case when jsonb_typeof(p->'files') = 'array' then p->'files' else '[]'::jsonb end) f limit 20) z
        where jsonb_typeof(f) = 'object' and f->>'kind' in ('file','video','link') and f->>'url' ~ '^https://[^\s]+$'), '[]'::jsonb),
    'pinned', coalesce((p->>'pinned')::boolean, false)
  );
$$;
revoke all on function public.kb_clean_item(uuid, jsonb) from public, anon, authenticated;

create or replace function public.kb_save_item(p_shop uuid, p_item jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare c jsonb; v_id uuid; r kb_items; is_new boolean;
begin
  perform kb_need(p_shop);
  c := kb_clean_item(p_shop, p_item);
  v_id := nullif(p_item->>'id','')::uuid;
  is_new := v_id is null or not exists (select 1 from kb_items where id = v_id and shop_id = p_shop);
  if is_new then
    insert into kb_items(id, shop_id, type, title, body, fields, tag_ids, photos, files, pinned, source, created_by, created_by_name, updated_by, updated_by_name)
    values (coalesce(v_id, gen_random_uuid()), p_shop, c->>'type', c->>'title', c->>'body', c->'fields',
      array(select jsonb_array_elements_text(c->'tag_ids'))::uuid[], array(select jsonb_array_elements_text(c->'photos')), c->'files',
      (c->>'pinned')::boolean, left(p_item->>'source',40), auth.uid(), kb_me_name(), auth.uid(), kb_me_name())
    returning * into r;
  else
    update kb_items set type = c->>'type', title = c->>'title', body = c->>'body', fields = c->'fields',
      tag_ids = array(select jsonb_array_elements_text(c->'tag_ids'))::uuid[], photos = array(select jsonb_array_elements_text(c->'photos')),
      files = c->'files', pinned = (c->>'pinned')::boolean, updated_by = auth.uid(), updated_by_name = kb_me_name(), updated_at = now(), deleted_at = null
    where id = v_id and shop_id = p_shop returning * into r;
  end if;
  insert into kb_history(item_id, shop_id, action, snapshot, by_id, by_name)
    values (r.id, p_shop, case when is_new then 'create' else 'edit' end, to_jsonb(r), auth.uid(), kb_me_name());
  update kb_shops set updated_at = now() where id = p_shop;
  return row_to_json(r);
end $$;

-- דלי לקבצים (אפליקציות APK, PDF, מסמכים…). עד 50MB, כל סוג קובץ. שמות אקראיים.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kb-files', 'kb-files', true, 52428800, null)
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = null;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'kb files upload') then
    create policy "kb files upload" on storage.objects for insert to authenticated with check (bucket_id = 'kb-files');
  end if;
end $$;

-- ===== כל השאלות לצוות אי פעם (בטעינה הרגילה יש רק 60 יום) =====
create or replace function public.kb_asks_history(p_shop uuid)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform kb_need(p_shop);
  return coalesce((select json_agg(j) from json_array_elements(kb_asks_json(p_shop, '-infinity'::timestamptz)) j where j->>'deleted_at' is null), '[]'::json);
end $$;

do $$ begin
  execute 'revoke all on function public.kb_asks_history(uuid) from public, anon';
  execute 'grant execute on function public.kb_asks_history(uuid) to authenticated';
end $$;
