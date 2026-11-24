-- Lembrete do fim do aviso prévio (pedido do Fabrício, 24/11/2026): toda empresa em aviso gera uma
-- mensagem no WhatsApp dele 1 dia antes e no dia em que o aviso termina (onboarding_projects.notice_end_date).
-- Sai pela Central de Avisos (tipo aviso_previo_fim, na hora). Roda de hora em hora das 8h às 20h de
-- Brasília; a tabela abaixo garante uma mensagem só por projeto, por momento e por data de fim.

create table if not exists public.aviso_previo_alertas (
  project_id uuid not null references public.onboarding_projects(id) on delete cascade,
  momento text not null check (momento in ('vespera', 'dia')),
  notice_end_date date not null,
  enviado_em timestamptz not null default now(),
  primary key (project_id, momento, notice_end_date)
);
alter table public.aviso_previo_alertas enable row level security;
revoke all on public.aviso_previo_alertas from anon, authenticated;
grant all on public.aviso_previo_alertas to service_role;

-- p_hoje e p_simular existem pra conferir o texto de uma data sem enviar nem marcar nada.
create or replace function public.aviso_previo_lembrete(p_hoje date default null, p_simular boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_hoje date := coalesce(p_hoje, (now() at time zone 'America/Sao_Paulo')::date);
  v_dias text[] := array['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
  r record;
  v_momento text;
  v_texto text;
  v_novo int;
  v_saida jsonb := '[]'::jsonb;
begin
  for r in
    select p.id, p.product_name, p.notice_end_date, p.cancellation_signal_reason, p.cancellation_signal_date,
           c.name as empresa, st.name as consultor, cs.name as cs
      from onboarding_projects p
      join onboarding_companies c on c.id = p.onboarding_company_id
      left join onboarding_staff st on st.id = p.consultant_id
      left join onboarding_staff cs on cs.id = p.cs_id
     where p.status in ('notice_period', 'cancellation_signaled')
       and p.notice_end_date in (v_hoje, v_hoje + 1)
     order by p.notice_end_date, c.name
  loop
    v_momento := case when r.notice_end_date = v_hoje then 'dia' else 'vespera' end;
    v_texto := case when v_momento = 'dia' then '*Aviso prévio termina hoje*' else '*Aviso prévio termina amanhã*' end
      || E'\n' || r.empresa || coalesce(' · ' || nullif(trim(r.product_name), ''), '')
      || E'\nFim do aviso: ' || v_dias[extract(dow from r.notice_end_date)::int + 1] || ', ' || to_char(r.notice_end_date, 'DD/MM/YYYY')
      -- data gravada sem hora (meia-noite UTC) é lida como dia cheio, senão cairia no dia anterior em Brasília
      || coalesce(E'\nPedido de cancelamento: ' || to_char(case when (r.cancellation_signal_date at time zone 'UTC')::time = time '00:00'
           then (r.cancellation_signal_date at time zone 'UTC')::date else (r.cancellation_signal_date at time zone 'America/Sao_Paulo')::date end, 'DD/MM/YYYY'), '')
      || coalesce(E'\nMotivo: ' || nullif(trim(r.cancellation_signal_reason), ''), '')
      || coalesce(E'\nConsultor: ' || r.consultor, '')
      || coalesce(E'\nCS: ' || r.cs, '');

    if p_simular then
      v_saida := v_saida || jsonb_build_object('momento', v_momento, 'texto', v_texto);
      continue;
    end if;

    insert into aviso_previo_alertas (project_id, momento, notice_end_date)
    values (r.id, v_momento, r.notice_end_date)
    on conflict do nothing;
    get diagnostics v_novo = row_count;
    if v_novo = 0 then continue; end if;  -- já avisado

    perform aviso_enviar('aviso_previo_fim', v_texto, 'Aviso prévio terminando (1 dia antes e no dia)', 'nexus', 'hora');
    v_saida := v_saida || jsonb_build_object('momento', v_momento, 'empresa', r.empresa);
  end loop;
  return v_saida;
end
$fn$;

revoke all on function public.aviso_previo_lembrete(date, boolean) from public, anon, authenticated;
grant execute on function public.aviso_previo_lembrete(date, boolean) to service_role;

-- 08h05 às 20h05 de Brasília (11 às 23 UTC), de hora em hora
select cron.unschedule(jobid) from cron.job where jobname = 'aviso-previo-lembrete';
select cron.schedule('aviso-previo-lembrete', '5 11-23 * * *', $$select public.aviso_previo_lembrete();$$);
