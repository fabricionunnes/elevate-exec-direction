-- Usuária da Yasmim (login do painel). Idempotente: se já existir, só garante que é admin.
-- Nenhuma senha fica no código: a conta nasce com senha aleatória e a senha real
-- é definida pelo workflow (disparo manual com input mascarado) ou pelo painel do Supabase.
do $$
declare
  v_id uuid;
  v_email text := 'yasmimaguiarsc@gmail.com';
begin
  select id into v_id from auth.users where lower(email) = v_email;
  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email,
            crypt(gen_random_uuid()::text, gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Yasmim"}'::jsonb, now(), now(),
            '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_id, v_id::text,
            jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());
  end if;
  insert into yasfood.admins (user_id, name) values (v_id, 'Yasmim')
  on conflict (user_id) do update set name = excluded.name;
end $$;
