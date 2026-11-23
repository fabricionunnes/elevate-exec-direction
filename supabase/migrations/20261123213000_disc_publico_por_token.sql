-- Segurança, etapa 2 (parte 5): teste DISC do candidato pelo link.
-- Antes: qualquer visitante lia todos os resultados de DISC e podia alterar os pendentes.
-- Agora a página do candidato lê e envia só o teste do próprio token.
create or replace function public.disc_public_get(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', d.id, 'candidate_id', d.candidate_id, 'status', d.status)
  from public.candidate_disc_results d
  where p_token is not null and length(p_token) >= 16 and d.access_token = p_token
  limit 1
$$;
revoke all on function public.disc_public_get(text) from public;
grant execute on function public.disc_public_get(text) to anon, authenticated, service_role;

create or replace function public.disc_public_submit(p_token text, p_result jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if p_token is null or length(p_token) < 16 or p_result is null or jsonb_typeof(p_result) <> 'object' then
    return false;
  end if;
  update public.candidate_disc_results d
     set status = 'completed',
         d_score = (p_result->>'d_score')::int,
         i_score = (p_result->>'i_score')::int,
         s_score = (p_result->>'s_score')::int,
         c_score = (p_result->>'c_score')::int,
         dominant_profile = p_result->>'dominant_profile',
         interpretation = p_result->>'interpretation',
         raw_responses = p_result->'raw_responses',
         completed_at = now()
   where d.access_token = p_token and d.status = 'pending';
  get diagnostics n = row_count;
  return n > 0;
end;
$$;
revoke all on function public.disc_public_submit(text, jsonb) from public;
grant execute on function public.disc_public_submit(text, jsonb) to anon, authenticated, service_role;
