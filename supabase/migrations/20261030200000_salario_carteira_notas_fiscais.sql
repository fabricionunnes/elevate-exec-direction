-- 30/10/2026, Fabrício: "o menu de notas fiscais também quero que pegue este mesmo valor e todo dia 1 lance lá o valor a pagar pra ele".
-- Menu Notas Fiscais (StaffInvoicePage) lê o honorário do mês de staff_salaries (competência M, NF paga dia 15 de M+1).
-- Todo dia 1 do mês N: honorário da competência N-1 = parcela do Contas a Pagar que vence em N.
-- E a parcela que vence no mês corrente congela a partir do dia 1 (o mês da comissão já fechou), pra NF e Contas a Pagar baterem.

create or replace function public.atualizar_salarios_pela_carteira()
returns table(staff text, vencimento date, mes_comissao text, antes numeric, depois numeric)
language plpgsql security definer set search_path = public as $$
declare s record; p record; u record; h record; v_novo numeric; v_total int; i int;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_mes_atual date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
  v_comp date := (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - interval '1 month')::date;
begin
  for s in select c.*, st.name from salario_pela_carteira c join onboarding_staff st on st.id = c.staff_id where c.ativo loop
    -- faltando menos de 6 meses de parcelas lançadas: gera mais 12 no mesmo formato da última
    select * into u from financial_payables fp where fp.supplier_name = s.supplier_name order by fp.due_date desc limit 1;
    if u.id is not null and u.due_date < (v_hoje + interval '6 months')::date then
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

    -- parcelas futuras (vencimento a partir do mês que vem) seguem a carteira; a do mês corrente já está fechada
    for p in select fp.id, fp.amount, fp.due_date from financial_payables fp
              where fp.supplier_name = s.supplier_name and fp.status = 'pending'
                and fp.due_date >= greatest(s.a_partir, (v_mes_atual + interval '1 month')::date)
              order by fp.due_date loop
      -- parcela do mês M paga a comissão do mês M-1
      v_novo := projecao_comissao_mes(s.staff_id, (date_trunc('month', p.due_date) - interval '1 month')::date) / 100.0;
      if v_novo is distinct from p.amount then
        update financial_payables
           set amount = v_novo,
               notes = 'Valor pela Carteira do consultor (comissão de ' || to_char(p.due_date - interval '1 month', 'MM/YYYY')
                       || '), atualizado em ' || to_char(v_hoje, 'DD/MM/YYYY'),
               updated_at = now()
         where id = p.id;
      end if;
      staff := s.name; vencimento := p.due_date; mes_comissao := to_char(p.due_date - interval '1 month', 'MM/YYYY');
      antes := p.amount; depois := v_novo;
      return next;
    end loop;

    -- Notas Fiscais: no dia 1 (ou se ainda não tem) lança o honorário da competência que fechou = parcela que vence neste mês
    select fp.amount into h from financial_payables fp
     where fp.supplier_name = s.supplier_name and fp.due_date >= v_mes_atual and fp.due_date < (v_mes_atual + interval '1 month')::date
     order by fp.due_date limit 1;
    if h.amount is not null and (
         extract(day from v_hoje) = 1
         or not exists (select 1 from staff_salaries ss where ss.staff_id = s.staff_id
                         and ss.month = extract(month from v_comp)::int and ss.year = extract(year from v_comp)::int)) then
      insert into staff_salaries (staff_id, month, year, amount, commission, created_by)
      values (s.staff_id, extract(month from v_comp)::int, extract(year from v_comp)::int, h.amount, null,
              'b1a918b1-8776-4962-898e-5d97c7cc80c1')
      on conflict (staff_id, month, year) do update set amount = excluded.amount, commission = null, updated_at = now();
    end if;

    update salario_pela_carteira set atualizado_em = now() where staff_id = s.staff_id;
  end loop;
end $$;
revoke all on function public.atualizar_salarios_pela_carteira() from anon, authenticated, public;
