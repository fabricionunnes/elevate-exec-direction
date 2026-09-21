-- Formulários públicos: quando o envio falha no aparelho do cliente, guarda o erro E as respostas (21/09/2026)
create table if not exists public.public_form_error_log (
  id uuid primary key default gen_random_uuid(),
  form text not null, ref_id text, error text, user_agent text, payload jsonb,
  created_at timestamptz not null default now()
);
alter table public.public_form_error_log enable row level security;
revoke all on public.public_form_error_log from anon, authenticated;
grant all on public.public_form_error_log to service_role;
create or replace function public.public_form_log_error(p_form text, p_ref text, p_error text, p_payload jsonb default null, p_ua text default null)
returns boolean language plpgsql security definer set search_path to 'public' as $f$
begin
  if length(coalesce(p_payload,'{}'::jsonb)::text) > 300000 then p_payload := jsonb_build_object('aviso','payload grande demais'); end if;
  -- freio simples: no máximo 30 registros por referência por dia
  if (select count(*) from public_form_error_log where ref_id = left(p_ref,80) and created_at > now() - interval '1 day') >= 30 then return false; end if;
  insert into public_form_error_log (form, ref_id, error, user_agent, payload)
  values (left(coalesce(p_form,'?'),60), left(p_ref,80), left(p_error,2000), left(p_ua,400), p_payload);
  return true;
end $f$;
revoke all on function public.public_form_log_error(text,text,text,jsonb,text) from public;
grant execute on function public.public_form_log_error(text,text,text,jsonb,text) to anon, authenticated, service_role;
select 1;
