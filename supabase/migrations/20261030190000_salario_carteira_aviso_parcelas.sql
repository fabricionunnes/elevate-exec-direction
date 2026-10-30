-- 30/10/2026, Fabrício (ajuste do salário pela carteira):
-- 1) "quando estiver chegando a 6 meses, gera mais 12 parcelas seguindo o mesmo formato".
-- 2) Cliente em aviso prévio conta no salário ATÉ O FIM DO AVISO: Agile Save (UNV Ads) pediu em 30/10, aviso até 10/12
--    → parcela de dezembro (comissão de novembro) recebe cheio, janeiro (comissão de dezembro) recebe 10 dias.
--    Se desistir de cancelar (reactivated_at >= pedido), normaliza sozinho.

-- pedido de cancelamento da Agile Save (UNV Ads) foi hoje, quando entrou em aviso prévio
update public.onboarding_projects set cancellation_signal_date = '2026-10-30'
 where id = '4963a31a-a531-406b-8837-6c1ecfc77cf3' and cancellation_signal_date is null;

create or replace function public.projecao_comissao_mes(p_staff uuid, p_mes date)
returns bigint
language plpgsql stable security definer set search_path = public as $$
declare
  v_ini   date := date_trunc('month', p_mes)::date;
  v_fim   date := (date_trunc('month', p_mes) + interval '1 month - 1 day')::date;
  v_dias  int  := extract(day from (date_trunc('month', p_mes) + interval '1 month - 1 day'))::int;
  v_piso  int; v_pct numeric; v_pctv numeric;
  v_qt    int; v_ent numeric; v_ven numeric;
begin
  select coalesce(cc.piso_cents, pa.piso_cents), coalesce(cc.percentual, pa.percentual), coalesce(cc.percentual_venda, pa.percentual_venda)
    into v_piso, v_pct, v_pctv
    from consultant_commission_config pa
    left join consultant_commission_config cc on cc.consultant_id = p_staff
   where pa.consultant_id is null
   limit 1;

  with r as (
    select x.*,
           case
             -- saindo (pediu e não foi retido): conta até o fim do aviso, proporcional no mês em que o aviso acaba
             when x.saindo and not coalesce(x.retido, false) then
               case
                 when p.notice_end_date is null or p.notice_end_date < v_ini then 0
                 when p.notice_end_date <= v_fim then extract(day from p.notice_end_date)::numeric / v_dias
                 else 1
               end
             -- contrato que acabou sem renovação sai
             when not (x.recorrente or x.contract_end_date is null or x.contract_end_date >= v_ini) then 0
             else 1
           end as fator_mes
      from carteira_consultores_raw() x
      left join onboarding_projects p on p.id = x.project_id
  )
  select count(*) filter (where r.consultant_id = p_staff and r.fator_mes > 0),
         coalesce(sum(r.monthly_cents * r.fator_mes) filter (where r.consultant_id = p_staff), 0) * v_pct / 100,
         coalesce(sum(r.monthly_cents * r.fator_mes) filter (where r.vendido_por = p_staff and r.comissao_venda_cents is not null), 0) * coalesce(v_pctv, 0) / 100
    into v_qt, v_ent, v_ven
    from r;

  return round((case when v_qt > 0 then coalesce(v_piso, 0) else 0 end) + v_ent + v_ven)::bigint;
end $$;
revoke all on function public.projecao_comissao_mes(uuid, date) from anon, authenticated, public;

create or replace function public.atualizar_salarios_pela_carteira()
returns table(staff text, vencimento date, mes_comissao text, antes numeric, depois numeric)
language plpgsql security definer set search_path = public as $$
declare s record; p record; u record; v_novo numeric; v_total int; i int;
begin
  for s in select c.*, st.name from salario_pela_carteira c join onboarding_staff st on st.id = c.staff_id where c.ativo loop
    -- faltando menos de 6 meses de parcelas lançadas: gera mais 12 no mesmo formato da última
    select * into u from financial_payables fp where fp.supplier_name = s.supplier_name order by fp.due_date desc limit 1;
    if u.id is not null and u.due_date < (current_date + interval '6 months')::date then
      v_total := coalesce(u.installment_number, 0) + 12;
      for i in 1..12 loop
        insert into financial_payables (supplier_name, category_id, description, amount, due_date, status, is_recurring, recurrence_type,
                                        payment_method, bank_account_id, bank_id, cost_center, cost_center_id, cost_type, reference_month,
                                        installment_number, total_installments, tenant_id, notes)
        values (u.supplier_name, u.category_id,
                regexp_replace(u.description, '\(\d+/\d+\)', '(' || (coalesce(u.installment_number, 0) + i) || '/' || v_total || ')'),
                u.amount, (u.due_date + make_interval(months => i))::date, 'pending', u.is_recurring, u.recurrence_type,
                u.payment_method, u.bank_account_id, u.bank_id, u.cost_center, u.cost_center_id, u.cost_type,
                to_char(u.due_date + make_interval(months => i), 'YYYY-MM'),
                coalesce(u.installment_number, 0) + i, v_total, u.tenant_id,
                'Parcela gerada automaticamente pela regra do salário pela carteira');
      end loop;
    end if;

    for p in select fp.id, fp.amount, fp.due_date from financial_payables fp
              where fp.supplier_name = s.supplier_name and fp.status = 'pending' and fp.due_date >= s.a_partir
              order by fp.due_date loop
      -- parcela do mês M paga a comissão do mês M-1
      v_novo := projecao_comissao_mes(s.staff_id, (date_trunc('month', p.due_date) - interval '1 month')::date) / 100.0;
      if v_novo is distinct from p.amount then
        update financial_payables
           set amount = v_novo,
               notes = 'Valor pela Carteira do consultor (comissão de ' || to_char(p.due_date - interval '1 month', 'MM/YYYY')
                       || '), atualizado em ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'),
               updated_at = now()
         where id = p.id;
      end if;
      staff := s.name; vencimento := p.due_date; mes_comissao := to_char(p.due_date - interval '1 month', 'MM/YYYY');
      antes := p.amount; depois := v_novo;
      return next;
    end loop;
    update salario_pela_carteira set atualizado_em = now() where staff_id = s.staff_id;
  end loop;
end $$;
revoke all on function public.atualizar_salarios_pela_carteira() from anon, authenticated, public;
