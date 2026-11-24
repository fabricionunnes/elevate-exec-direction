-- Aviso de cancelamento revertido (pedido do Fabrício, 24/11/2026): quando um projeto em aviso prévio ou
-- com sinalização de cancelamento volta pra ativo, ele recebe uma mensagem no WhatsApp pra conferir se as
-- parcelas já estão no sistema. Sai pela Central de Avisos (tipo cancelamento_revertido, na hora) e já
-- leva quantas parcelas futuras em aberto a empresa tem.

create or replace function public.trg_aviso_cancelamento_revertido()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_empresa text;
  v_consultor text;
  v_cs text;
  v_qtd int;
  v_prox date;
  v_recorr int;
  v_texto text;
begin
  begin
    select c.name into v_empresa from onboarding_companies c where c.id = new.onboarding_company_id;
    select name into v_consultor from onboarding_staff where id = new.consultant_id;
    select name into v_cs from onboarding_staff where id = new.cs_id;
    select count(*), min(due_date) into v_qtd, v_prox
      from company_invoices
     where company_id = new.onboarding_company_id and status in ('pending', 'overdue')
       and due_date >= (now() at time zone 'America/Sao_Paulo')::date;
    select count(*) into v_recorr from company_recurring_charges where company_id = new.onboarding_company_id and is_active;

    v_texto := '*Cancelamento revertido: voltou pra ativo*'
      || E'\n' || coalesce(v_empresa, 'Empresa') || coalesce(' · ' || nullif(trim(new.product_name), ''), '')
      || E'\nEstava em: ' || case when old.status = 'notice_period'
           then 'aviso prévio' || coalesce(' (terminaria em ' || to_char(old.notice_end_date, 'DD/MM/YYYY') || ')', '')
           else 'sinalização de cancelamento' end
      || E'\nParcelas futuras em aberto no sistema: ' || case when v_qtd > 0
           then v_qtd::text || ' (próxima em ' || to_char(v_prox, 'DD/MM/YYYY') || ')'
           else 'nenhuma' end
      || E'\nCobranças recorrentes ativas: ' || case when v_recorr > 0 then v_recorr::text else 'nenhuma' end
      || E'\nConfere se as parcelas do período que continua já estão lançadas.'
      || coalesce(E'\nConsultor: ' || v_consultor, '')
      || coalesce(E'\nCS: ' || v_cs, '');

    perform aviso_enviar('cancelamento_revertido', v_texto, 'Cancelamento revertido: conferir parcelas', 'nexus', 'hora');
  exception when others then
    raise warning 'aviso de cancelamento revertido falhou: %', sqlerrm;  -- nunca trava a mudança de status
  end;
  return new;
end
$fn$;

revoke all on function public.trg_aviso_cancelamento_revertido() from public, anon, authenticated;

drop trigger if exists zz_aviso_cancelamento_revertido on public.onboarding_projects;
create trigger zz_aviso_cancelamento_revertido
  after update of status on public.onboarding_projects
  for each row
  when (old.status in ('notice_period', 'cancellation_signaled') and new.status = 'active')
  execute function public.trg_aviso_cancelamento_revertido();
