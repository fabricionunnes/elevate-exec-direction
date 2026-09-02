-- 2026-09-02: conciliacao assertiva — fila de revisao resolve com lancamento no razao; sem ajuste automatico de saldo
alter table public.financial_statement_entries add column if not exists ledger_posted boolean not null default false;
create or replace function public.resolve_statement_entry(p_entry_id uuid, p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  e record; v_abs numeric; v_cents bigint; v_type text; v_ref_type text; v_ref_id uuid;
  v_kind text; v_id uuid; v_desc text; v_posted boolean := false; v_exists int;
begin
  select * into e from financial_statement_entries where id = p_entry_id for update;
  if e.id is null then raise exception 'Lancamento do extrato nao encontrado'; end if;
  if e.status = 'matched' and p_action <> 'ignore' then raise exception 'Lancamento ja conciliado — desfaca antes de reclassificar'; end if;
  v_cents := abs(e.amount_cents); v_abs := round(v_cents / 100.0, 2);
  v_type := case when e.amount_cents >= 0 then 'credit' else 'debit' end;
  v_desc := coalesce(nullif(trim(p_payload->>'description'),''), e.description, 'Lancamento Asaas');

  if p_action = 'ignore' then
    update financial_statement_entries set status='ignored', match_kind=null, match_id=null, match_confidence='manual',
      match_reason='ignorado manualmente', reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now() where id=e.id;
    return jsonb_build_object('ok', true, 'action', 'ignore');
  end if;

  if p_action = 'fee' then
    insert into financial_payables (supplier_name, description, amount, due_date, status, paid_date, paid_amount, category_id, notes)
    values ('Asaas', v_desc, v_abs, e.entry_date, 'paid', e.entry_date, v_abs, nullif(p_payload->>'category_id','')::uuid, 'Conciliacao Asaas — taxa')
    returning id into v_id;
    v_kind := 'fee'; v_ref_type := 'payable'; v_ref_id := v_id; v_type := 'debit';
  elsif p_action = 'transfer' then
    v_kind := 'transfer'; v_ref_type := 'statement_entry'; v_ref_id := e.id;
  elsif p_action = 'create_receivable' then
    insert into financial_receivables (company_id, custom_receiver_name, category_id, cost_center_id, description, amount, due_date, status, paid_date, paid_amount, fee_amount, asaas_payment_id, notes)
    values (nullif(p_payload->>'company_id','')::uuid,
            case when nullif(p_payload->>'company_id','') is null then nullif(trim(p_payload->>'party'),'') else null end,
            nullif(p_payload->>'category_id','')::uuid, nullif(p_payload->>'cost_center_id','')::uuid,
            v_desc, coalesce(nullif(p_payload->>'gross','')::numeric, v_abs), e.entry_date, 'paid', e.entry_date, v_abs,
            greatest(coalesce(nullif(p_payload->>'gross','')::numeric, v_abs) - v_abs, 0), e.provider_payment_id, 'Conciliacao Asaas')
    returning id into v_id;
    v_kind := 'receivable'; v_ref_type := 'receivable'; v_ref_id := v_id; v_type := 'credit';
  elsif p_action = 'create_payable' then
    insert into financial_payables (supplier_name, description, amount, due_date, status, paid_date, paid_amount, category_id, notes)
    values (coalesce(nullif(trim(p_payload->>'supplier_name'),''),'Asaas'), v_desc, v_abs, e.entry_date, 'paid', e.entry_date, v_abs, nullif(p_payload->>'category_id','')::uuid, 'Conciliacao Asaas')
    returning id into v_id;
    v_kind := 'payable'; v_ref_type := 'payable'; v_ref_id := v_id; v_type := 'debit';
  elsif p_action = 'link' then
    v_kind := p_payload->>'kind'; v_id := (p_payload->>'id')::uuid;
    if v_kind = 'receivable' then
      update financial_receivables set status='paid', paid_date=e.entry_date, paid_amount=v_abs, asaas_payment_id=coalesce(asaas_payment_id, e.provider_payment_id), updated_at=now() where id=v_id;
    elsif v_kind = 'payable' then
      update financial_payables set status='paid', paid_date=e.entry_date, paid_amount=v_abs, updated_at=now() where id=v_id;
    elsif v_kind = 'invoice' then
      update company_invoices set status='paid', paid_at=(e.entry_date::text||'T12:00:00Z')::timestamptz, paid_amount_cents=v_cents, updated_at=now() where id=v_id;
    else raise exception 'kind invalido'; end if;
    v_ref_type := v_kind; v_ref_id := v_id;
  else
    raise exception 'acao invalida: %', p_action;
  end if;

  -- razao interno: so uma vez por lancamento do extrato, e nunca em duplicidade com o titulo
  if not e.ledger_posted then
    select count(*) into v_exists from financial_bank_transactions
      where reference_type = v_ref_type and reference_id = v_ref_id and type = v_type and v_ref_type <> 'statement_entry';
    if v_exists = 0 then
      insert into financial_bank_transactions (bank_id, type, amount_cents, description, reference_type, reference_id)
      values (e.bank_id, v_type, v_cents, v_desc, v_ref_type, v_ref_id);
      perform increment_bank_balance(e.bank_id, case when v_type='credit' then v_cents else -v_cents end);
    end if;
    v_posted := true;
  end if;

  update financial_statement_entries set status='matched', match_kind=v_kind, match_id=v_id, match_confidence='manual',
    match_reason='resolvido manualmente ('||p_action||')', auto_settled=false, ledger_posted=true,
    reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now() where id=e.id;
  return jsonb_build_object('ok', true, 'action', p_action, 'kind', v_kind, 'id', v_id, 'ledger_posted', v_posted);
end $fn$;
grant execute on function public.resolve_statement_entry(uuid, text, jsonb) to authenticated;
