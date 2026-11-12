-- Parcelar várias contas a pagar (Fabrício, 12/11/2026: "selecionar várias dívidas e parcelar elas, adicionar
-- juros se preciso"). Opção A, aprovada por ele: as contas originais saem da lista e viram as parcelas novas;
-- fica o registro do parcelamento com a fotografia das originais, e dá pra desfazer.
alter table public.financial_payables add column if not exists renegotiation_id uuid;
create index if not exists financial_payables_renegotiation_idx on public.financial_payables (renegotiation_id) where renegotiation_id is not null;

create table if not exists public.financial_payable_renegotiations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid,
  created_by_name text,
  originals jsonb not null,
  params jsonb not null,
  total_original numeric not null,
  total_novo numeric not null,
  undone_at timestamptz,
  undone_by uuid
);
alter table public.financial_payable_renegotiations enable row level security;
grant select on public.financial_payable_renegotiations to authenticated;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='financial_payable_renegotiations' and policyname='Financeiro le parcelamentos') then
    create policy "Financeiro le parcelamentos" on public.financial_payable_renegotiations for select using (public.pode_anexo_financeiro());
  end if;
end $$;

-- mesma regra de empresa das políticas da tabela (tenant_iso_modify)
create or replace function public.fin_conta_da_minha_empresa(p_tenant uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case when is_master_user() then p_tenant is null
              when current_user_tenant_id() is not null then p_tenant = current_user_tenant_id()
              else true end
$$;

create or replace function public.financial_parcelar_contas(p_ids uuid[], p_params jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  st record;
  r record;
  v_n int := greatest(1, least(120, coalesce((p_params->>'parcelas')::int, 1)));
  v_intervalo int := greatest(1, least(12, coalesce((p_params->>'intervalo_meses')::int, 1)));
  v_primeira date := (p_params->>'primeira_data')::date;
  v_entrada numeric := greatest(0, coalesce((p_params->>'entrada')::numeric, 0));
  v_entrada_data date := coalesce(nullif(p_params->>'entrada_data','')::date, current_date);
  v_juros numeric := greatest(0, coalesce((p_params->>'juros_mes')::numeric, 0)) / 100;
  v_ajuste numeric := coalesce((p_params->>'ajuste')::numeric, 0);
  v_fornecedor text := nullif(btrim(coalesce(p_params->>'supplier_name','')), '');
  v_descricao text := nullif(btrim(coalesce(p_params->>'description','')), '');
  v_categoria uuid := nullif(p_params->>'category_id','')::uuid;
  v_centro uuid := nullif(p_params->>'cost_center_id','')::uuid;
  v_tipo text := nullif(p_params->>'cost_type','');
  v_saldo numeric := 0;
  v_base numeric;
  v_parcela numeric;
  v_total_novo numeric := 0;
  v_reneg uuid;
  v_tenant uuid;
  v_qtd int := 0;
  v_fotos jsonb := '[]'::jsonb;
  v_nota text;
  v_valor numeric;
  k int;
begin
  select s.id, s.name into st from onboarding_staff s where s.user_id = auth.uid() and s.is_active limit 1;
  if st.id is null or not public.staff_has_menu_permission(st.id, 'financial') then raise exception 'Sem acesso ao financeiro'; end if;
  if p_ids is null or cardinality(p_ids) = 0 then raise exception 'Nenhuma conta selecionada'; end if;
  if v_primeira is null then raise exception 'Informe o vencimento da primeira parcela'; end if;
  if v_fornecedor is null or v_descricao is null then raise exception 'Fornecedor e descrição são obrigatórios'; end if;

  for r in select * from financial_payables where id = any(p_ids) order by due_date for update loop
    if not public.fin_conta_da_minha_empresa(r.tenant_id) then raise exception 'Conta de outra empresa na seleção'; end if;
    if r.status = 'paid' then raise exception 'A conta "%" já está paga e não pode entrar no parcelamento', r.description; end if;
    if v_qtd = 0 then v_tenant := r.tenant_id;
    elsif v_tenant is distinct from r.tenant_id then raise exception 'As contas selecionadas são de empresas diferentes'; end if;
    v_qtd := v_qtd + 1;
    v_saldo := v_saldo + (r.amount - coalesce(r.paid_amount, 0));
    v_fotos := v_fotos || to_jsonb(r);
  end loop;
  if v_qtd <> cardinality(p_ids) then raise exception 'Alguma conta selecionada não existe mais. Atualize a tela.'; end if;

  v_base := v_saldo + v_ajuste - v_entrada;
  if v_base <= 0 then raise exception 'O valor a parcelar ficou zerado ou negativo'; end if;
  if v_juros > 0 then v_parcela := round(v_base * v_juros / (1 - power(1 + v_juros, -v_n)), 2);
  else v_parcela := round(v_base / v_n, 2); end if;

  insert into financial_payable_renegotiations (tenant_id, created_by, created_by_name, originals, params, total_original, total_novo)
  values (v_tenant, st.id, st.name, v_fotos, p_params, v_saldo, 0) returning id into v_reneg;

  v_nota := format('Parcelamento de %s conta(s), saldo original R$ %s%s%s. Feito por %s em %s.',
    v_qtd, to_char(v_saldo, 'FM999G999G990D00'),
    case when v_juros > 0 then format(', juros de %s%% ao mês', to_char(v_juros * 100, 'FM990D0099')) else '' end,
    case when v_ajuste <> 0 then format(', ajuste de R$ %s', to_char(v_ajuste, 'FM999G999G990D00')) else '' end,
    st.name, to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'));

  -- contas com pagamento parcial ficam na lista só com o que já foi pago (o histórico dos pagamentos é delas);
  -- as sem pagamento saem
  for r in select * from financial_payables where id = any(p_ids) loop
    if coalesce(r.paid_amount, 0) > 0 then
      update financial_payables set amount = r.paid_amount,
        notes = btrim(coalesce(r.notes, '') || ' | Saldo de R$ ' || to_char(r.amount - r.paid_amount, 'FM999G999G990D00') || ' foi pro parcelamento.')
      where id = r.id;
    else
      delete from financial_payables where id = r.id;
    end if;
  end loop;

  if v_entrada > 0 then
    insert into financial_payables (supplier_name, description, amount, due_date, status, is_recurring, category_id, cost_center_id, cost_type,
      reference_month, notes, tenant_id, renegotiation_id)
    values (v_fornecedor, v_descricao || ' (entrada)', v_entrada, v_entrada_data, 'pending', false, v_categoria, v_centro, v_tipo,
      to_char(v_entrada_data, 'YYYY-MM'), v_nota, v_tenant, v_reneg);
    v_total_novo := v_total_novo + v_entrada;
  end if;
  for k in 1..v_n loop
    v_valor := v_parcela;
    -- sem juros, a última parcela absorve o centavo do arredondamento
    if v_juros = 0 and k = v_n then v_valor := v_base - v_parcela * (v_n - 1); end if;
    insert into financial_payables (supplier_name, description, amount, due_date, status, is_recurring, category_id, cost_center_id, cost_type,
      reference_month, installment_number, total_installments, notes, tenant_id, renegotiation_id)
    values (v_fornecedor, format('%s (%s/%s)', v_descricao, k, v_n), v_valor,
      (v_primeira + make_interval(months => (k - 1) * v_intervalo))::date, 'pending', false, v_categoria, v_centro, v_tipo,
      to_char((v_primeira + make_interval(months => (k - 1) * v_intervalo))::date, 'YYYY-MM'), k, v_n, v_nota, v_tenant, v_reneg);
    v_total_novo := v_total_novo + v_valor;
  end loop;
  update financial_payable_renegotiations set total_novo = v_total_novo where id = v_reneg;

  return jsonb_build_object('ok', true, 'id', v_reneg, 'contas', v_qtd, 'saldo_original', v_saldo, 'parcelas', v_n,
    'valor_parcela', v_parcela, 'total_novo', v_total_novo, 'juros_total', v_total_novo - (v_saldo + v_ajuste));
end $$;

create or replace function public.financial_desfazer_parcelamento(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  st record;
  rn record;
  e jsonb;
  v_volta int := 0;
begin
  select s.id, s.name into st from onboarding_staff s where s.user_id = auth.uid() and s.is_active limit 1;
  if st.id is null or not public.staff_has_menu_permission(st.id, 'financial') then raise exception 'Sem acesso ao financeiro'; end if;
  select * into rn from financial_payable_renegotiations where id = p_id for update;
  if rn.id is null then raise exception 'Parcelamento não encontrado'; end if;
  if rn.undone_at is not null then raise exception 'Este parcelamento já foi desfeito'; end if;
  if not public.fin_conta_da_minha_empresa(rn.tenant_id) then raise exception 'Parcelamento de outra empresa'; end if;
  if exists (select 1 from financial_payables where renegotiation_id = p_id and (status in ('paid', 'partial') or coalesce(paid_amount, 0) > 0)) then
    raise exception 'Já existe pagamento em parcela deste parcelamento. Estorne o pagamento antes de desfazer.';
  end if;
  delete from financial_payables where renegotiation_id = p_id;
  for e in select * from jsonb_array_elements(rn.originals) loop
    if exists (select 1 from financial_payables where id = (e->>'id')::uuid) then
      -- a que tinha pagamento parcial ficou na lista: volta o valor e as observações de antes
      update financial_payables set amount = (e->>'amount')::numeric, notes = e->>'notes' where id = (e->>'id')::uuid;
    else
      insert into financial_payables select * from jsonb_populate_record(null::financial_payables, e);
    end if;
    v_volta := v_volta + 1;
  end loop;
  update financial_payable_renegotiations set undone_at = now(), undone_by = st.id where id = p_id;
  return jsonb_build_object('ok', true, 'contas_restauradas', v_volta);
end $$;

revoke all on function public.financial_parcelar_contas(uuid[], jsonb) from public, anon;
revoke all on function public.financial_desfazer_parcelamento(uuid) from public, anon;
grant execute on function public.financial_parcelar_contas(uuid[], jsonb) to authenticated;
grant execute on function public.financial_desfazer_parcelamento(uuid) to authenticated;
select 'ok' r;
