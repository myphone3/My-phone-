-- שדרוג 4: אייקון נפרד לכל חנות במסך הבית.
-- קובץ ההתקנה (manifest) והאייקון נטענים בלי משתמש מחובר, אז צריך פונקציה ציבורית
-- שמחזירה רק שם ולוגו (לפי מזהה החנות, שאי אפשר לנחש).
create or replace function public.kb_shop_brand(p_shop uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('name', s.name, 'logo_url', s.logo_url, 'v', floor(extract(epoch from s.updated_at))::bigint)
  from kb_shops s where s.id = p_shop;
$$;
revoke all on function public.kb_shop_brand(uuid) from public;
grant execute on function public.kb_shop_brand(uuid) to anon, authenticated;
-- (הורץ ב-Supabase)
