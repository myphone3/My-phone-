-- NEW PHONE: signed-in customers can write a review; it waits hidden until the admin approves it.
-- Safe to run again.

alter table public.reviews add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.reviews add column if not exists source text not null default 'admin';
create unique index if not exists reviews_one_per_customer on public.reviews (user_id) where source = 'customer';

-- One review per customer: writing again replaces it and sends it back for approval
create or replace function public.submit_review(p_name text, p_rating int, p_text text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := left(trim(coalesce(p_name, '')), 40);
  v_text text := left(trim(coalesce(p_text, '')), 600);
begin
  if v_uid is null then
    raise exception 'sign in required';
  end if;
  if v_name = '' or length(v_text) < 5 or p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'invalid review';
  end if;
  insert into public.reviews (user_id, source, name, rating, text, is_active, sort_order)
  values (v_uid, 'customer', v_name, p_rating, v_text, false, 100)
  on conflict (user_id) where source = 'customer' do update
    set name = excluded.name, rating = excluded.rating, text = excluded.text, is_active = false, created_at = now();
  return true;
end;
$$;
revoke all on function public.submit_review(text, int, text) from public;
grant execute on function public.submit_review(text, int, text) to authenticated;

-- Supabase grants new functions to anon by default; these are for signed-in users only
revoke execute on function public.submit_review(text, int, text) from anon;
revoke execute on function public.set_my_marketing_consent(boolean, text) from anon;
revoke execute on function public.get_my_marketing_consent() from anon;
revoke execute on function public.admin_unsubscribe_marketing(uuid) from anon;
revoke execute on function public.admin_list_customers() from anon;
revoke execute on function public.save_my_cart(jsonb) from anon;
revoke execute on function public.get_my_cart() from anon;
