-- Pix Automático gerado no lead acompanha o cliente quando o lead vira empresa (18/11/2026).
-- Caso Fernanda Oliveira: pagou a 1ª mensalidade pelo Pix Automático ainda como lead; ao ser ganha, a empresa
-- nasceu sem recorrência e sem parcelas, e o pagamento ficou em Contas a Receber como "Empresa desconhecida".
-- A função cria a recorrência da empresa ligada à MESMA autorização (nada é criado no Asaas), gera as 12
-- parcelas (a 1ª já paga, as demais em débito automático) e troca a conta a receber solta pela 1ª parcela.
-- Só age quando a 1ª mensalidade já foi paga. Pode ser chamada mais de uma vez: na segunda não faz nada.
create or replace function public.pix_automatico_lead_para_empresa(p_lead uuid, p_company uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  pa record; co record; lp record; rec record;
  v_charge uuid; v_link text; v_fee int := 0; v_conta uuid; v_cat uuid; v_total int := 12; i int;
begin
  if auth.uid() is not null and not exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active) then
    raise exception 'sem permissão';
  end if;
  if p_lead is null or p_company is null then return jsonb_build_object('ok', false, 'motivo', 'sem lead ou empresa'); end if;

  select * into pa from asaas_pix_automatico
   where origem = 'lead' and lead_id = p_lead and recurring_charge_id is null and pago_em is not null
     and status not in ('REFUSED', 'CANCELLED', 'EXPIRED')
   order by criado_em desc limit 1 for update;
  if pa.id is null then return jsonb_build_object('ok', false, 'motivo', 'lead sem Pix Automático pago'); end if;

  select id, name, email, phone, cnpj into co from onboarding_companies where id = p_company;
  if co.id is null then return jsonb_build_object('ok', false, 'motivo', 'empresa não encontrada'); end if;

  select * into lp from crm_lead_payments where id = pa.lead_payment_id;
  if lp.receivable_id is not null then
    select * into rec from financial_receivables where id = lp.receivable_id;
  end if;

  v_link := 'https://unvholdings.com.br/#/pix-automatico/' || pa.id;
  select id into v_cat from financial_categories where name = 'Mensalidades' limit 1;
  select id into v_conta from asaas_accounts
   where is_active and case when pa.conta_crm = 'social' then name ilike '%social%' else is_default end
   order by created_at limit 1;

  insert into company_recurring_charges (company_id, description, amount_cents, recurrence, installments, payment_method,
    next_charge_date, customer_name, customer_email, customer_phone, customer_document, category_id, asaas_account_id,
    pagarme_plan_id, pagarme_link_url, send_whatsapp, created_by, notes)
  values (co.id, 'Mensalidade - ' || co.name, pa.valor_cents, 'monthly', v_total, 'pix_automatico',
    pa.primeira_cobranca, co.name, co.email, co.phone, regexp_replace(coalesce(co.cnpj, ''), '\D', '', 'g'), v_cat, v_conta,
    pa.subscription_id, v_link, true, auth.uid(), 'Pix Automático gerado no CRM (lead) e trazido pra empresa no ganho.')
  returning id into v_charge;

  -- conta a receber solta do pagamento do lead: vira a 1ª parcela (senão o mesmo dinheiro apareceria duas vezes)
  if rec.id is not null and rec.company_id is null
     and not exists (select 1 from financial_transactions ft where ft.receivable_id = rec.id) then
    v_fee := greatest(0, round(coalesce(rec.fee_amount, 0) * 100)::int);
    update crm_lead_payments set receivable_id = null, updated_at = now() where id = lp.id;
    delete from financial_receivables where id = rec.id;
  elsif rec.id is not null then
    update financial_receivables set company_id = co.id where id = rec.id and company_id is null;
  end if;

  for i in 0 .. v_total - 1 loop
    insert into company_invoices (company_id, recurring_charge_id, description, amount_cents, due_date, status,
      paid_at, paid_amount_cents, payment_fee_cents, pagarme_charge_id, payment_method, auto_debit,
      installment_number, total_installments, late_fee_percent, daily_interest_percent, category_id,
      payment_link_url, send_whatsapp)
    values (co.id, v_charge, 'Mensalidade - ' || co.name, pa.valor_cents,
      (pa.primeira_cobranca + make_interval(months => i))::date,
      case when i = 0 then 'paid' else 'pending' end,
      case when i = 0 then pa.pago_em end,
      case when i = 0 then pa.valor_cents end,
      case when i = 0 then v_fee else 0 end,
      case when i = 0 then pa.primeiro_pagamento_id end,
      'pix_automatico', true, i + 1, v_total, 2.0, 1.0, v_cat,
      case when i = 0 then v_link else '' end, true);
  end loop;

  update asaas_pix_automatico
     set company_id = co.id, recurring_charge_id = v_charge, asaas_account_id = coalesce(asaas_account_id, v_conta), atualizado_em = now()
   where id = pa.id;

  return jsonb_build_object('ok', true, 'recurring_charge_id', v_charge, 'autorizacao', pa.id, 'parcelas', v_total);
end $$;

revoke all on function public.pix_automatico_lead_para_empresa(uuid, uuid) from public, anon;
grant execute on function public.pix_automatico_lead_para_empresa(uuid, uuid) to authenticated, service_role;
