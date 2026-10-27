-- Time de IA: o Max passa a ter leitura de TODO o Nexus (todas as empresas), não só
-- o contexto fixo. ai_team_sql(q) roda um SELECT em transação somente-leitura, com
-- timeout de 10 s e no máximo 200 linhas, e devolve JSON. SECURITY DEFINER (passa
-- por cima do RLS de propósito: é o dono da UNV perguntando sobre a própria operação).
-- Só a service role chama (as functions ai-team-chat/orchestrator); nunca o front.
create or replace function public.ai_team_sql(q text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  limpo text := btrim(q);
  resultado jsonb;
begin
  if limpo !~* '^(select|with)\s' then
    raise exception 'só SELECT/WITH é permitido';
  end if;
  if position(';' in limpo) > 0 then
    raise exception 'uma consulta por vez, sem ponto e vírgula';
  end if;
  if limpo ~* '\m(pg_read_file|pg_ls_dir|pg_read_binary_file|lo_import|lo_export|dblink|copy|pg_sleep|set_config|current_setting\(''(app|request)\.)' then
    raise exception 'função não permitida na consulta';
  end if;
  if limpo ~* '\m(auth\.users|vault\.|secrets|access_token|api_key|password|senha)\M' then
    raise exception 'tabela ou coluna sensível não permitida';
  end if;

  perform set_config('transaction_read_only', 'on', true);
  perform set_config('statement_timeout', '10000', true);

  execute 'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select * from (' || limpo || ') q limit 200) t'
    into resultado;
  return resultado;
end $fn$;

revoke execute on function public.ai_team_sql(text) from public, anon, authenticated;
grant execute on function public.ai_team_sql(text) to service_role;
