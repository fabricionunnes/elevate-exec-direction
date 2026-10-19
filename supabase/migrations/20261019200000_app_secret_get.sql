-- Leitura de segredo guardado em app_secrets pelas edge functions (service_role), sem abrir a
-- tabela. Usado pela transcrição na Cloudflare (cf_transcribe_url / cf_transcribe_secret),
-- porque o projeto bateu no teto de 100 secrets do Supabase (19/10/2026).
create or replace function public.app_secret_get(p_key text)
returns text language sql stable security definer set search_path = public as $$
  select value from public.app_secrets where key = p_key
$$;
revoke all on function public.app_secret_get(text) from public, anon, authenticated;
grant execute on function public.app_secret_get(text) to service_role;
