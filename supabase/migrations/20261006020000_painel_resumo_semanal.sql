-- Painel de Controle: dados do resumo semanal do WhatsApp (06/10/2026).
--
-- A edge painel-resumo-semanal roda como service_role (cron de segunda) e monta
-- um texto curto com o que o dono precisa saber pra começar a semana. Esta função
-- junta, numa chamada só, o que o texto usa: o painel do mês corrente (miolo
-- interno, sem is_master) e as vendas da semana passada (segunda a domingo).
-- Execute só pra service_role.

create or replace function public.painel_resumo_semanal_interno()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz constant text := 'America/Sao_Paulo';
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  seg date;         -- segunda desta semana
  p jsonb; sp jsonb;
begin
  seg := hoje - ((extract(isodow from hoje)::int) - 1);
  p := painel_controle_interno(date_trunc('month', hoje)::date);

  select jsonb_build_object('de', seg - 7, 'ate', seg - 1,
           'vendas', count(*), 'receita', coalesce(sum(l.opportunity_value), 0),
           'por_fundador', coalesce(sum(l.opportunity_value) filter (where coalesce(l.closer_staff_id, l.owner_staff_id) = (p #>> '{frente,fundador,staff_id}')::uuid), 0))
    into sp
    from crm_leads l join crm_stages st on st.id = l.stage_id
   where st.final_type = 'won' and l.tenant_id is null
     and l.closed_at >= (seg - 7)::timestamp at time zone v_tz and l.closed_at < seg::timestamp at time zone v_tz;

  return jsonb_build_object(
    'hoje', hoje, 'semana_de', seg, 'semana_ate', seg + 6,
    'semana_passada', sp,
    'caixa', jsonb_build_object(
      'saldo', p #> '{frente,caixa,saldo_inicial}',
      'realista', p #> '{frente,caixa,cenarios,realista}',
      'semana', p #> '{frente,caixa,semanas,0}',
      'pagar_antigas', p #> '{frente,caixa,fora,pagar_antigas}'),
    'ritmo', (p #> '{frente,ritmo}') - 'lucro_ano' - 'por_fechador',
    'reunioes', (p #> '{frente,antecedentes,reunioes}') - 'por_dia' - 'semanas_passadas',
    'cobertura', jsonb_build_object('x', p #> '{frente,antecedentes,pipeline,cobertura}', 'ponderado', p #> '{frente,antecedentes,pipeline,ponderado}', 'falta', p #> '{frente,antecedentes,pipeline,falta}'),
    'fundador', (p #> '{frente,fundador}') - 'serie' - 'por_fechador',
    'meta_ads', p #> '{trafego,meta}',
    'alertas', p->'alertas');
end $$;

revoke all on function public.painel_resumo_semanal_interno() from public, anon, authenticated;
grant execute on function public.painel_resumo_semanal_interno() to service_role;
