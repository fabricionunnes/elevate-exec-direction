-- 18/09/2026: closer/SDR não podiam gravar a própria foto (só admin altera onboarding_staff).
create or replace function public.staff_set_my_avatar(p_url text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then return false; end if;
  if p_url is not null and (length(p_url) > 600 or p_url !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/') then
    raise exception 'url de foto inválida';
  end if;
  update onboarding_staff set avatar_url = p_url where user_id = auth.uid() and is_active = true;
  get diagnostics n = row_count;
  if n = 0 then
    update onboarding_users set avatar_url = p_url where user_id = auth.uid();
    get diagnostics n = row_count;
  end if;
  return n > 0;
end $$;
revoke all on function public.staff_set_my_avatar(text) from public;
grant execute on function public.staff_set_my_avatar(text) to authenticated;
