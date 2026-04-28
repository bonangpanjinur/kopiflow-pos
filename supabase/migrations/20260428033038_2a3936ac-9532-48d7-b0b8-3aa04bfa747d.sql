
create or replace function public.touch_updated_at()
returns trigger language plpgsql
security invoker
set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;

-- handle_new_user already has search_path; ensure it
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Lock down public/anon execute on security definer role checkers
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.has_shop_role(uuid, public.app_role, uuid) from public, anon;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.has_shop_role(uuid, public.app_role, uuid) to authenticated;
