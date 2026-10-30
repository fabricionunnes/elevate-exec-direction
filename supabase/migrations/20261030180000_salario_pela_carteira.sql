-- 30/10/2026, Fabrício: "no contas a pagar o Weslley está que recebe 3 mil; em novembro será 3 mil, de dezembro em diante
-- o valor de acordo com o menu Carteira do consultor. Atualizar diariamente: dezembro, janeiro e todos os próximos,
-- conforme cancelamento, renovação e cliente novo na carteira dele."
--
-- Regra: parcela que vence no mês M paga a comissão do mês M-1 (mês fechado anterior, combinado em 27/10).
-- Projeção do mês X, a partir da carteira de hoje (carteira_consultores_raw):
--   piso (se tem algum contrato no mês) + % de entrega sobre o mensal + % de venda sobre o mensal do que ele vendeu.
--   Entra o projeto que NÃO está saindo (pediu cancelamento sem ser retido) e cujo contrato ainda vale em X
--   (recorrente, sem data de término ou término >= 1º dia de X). Mês futuro conta pago (fator 1).
-- Só mexe em parcela pendente, a partir da data configurada.

create table if not exists public.salario_pela_carteira (
  staff_id      uuid primary key references public.onboarding_staff(id) on delete cascade,
  supplier_name text not null,          -- fornecedor das parcelas no Contas a Pagar
  a_partir      date not null,          -- 1ª parcela (vencimento) que segue a carteira
  ativo         boolean not null default true,
  atualizado_em timestamptz
);
alter table public.salario_pela_carteira enable row level security;
revoke all on public.salario_pela_carteira from anon, authenticated;

create or replace function public.projecao_comissao_mes(p_staff uuid, p_mes date)
returns bigint
language plpgsql stable security definer set search_path = public as $$
declare
  v_ini   date := date_trunc('month', p_mes)::date;
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
    select * from carteira_consultores_raw() x
     where not (x.saindo and not coalesce(x.retido, false))
       and (x.recorrente or x.contract_end_date is null or x.contract_end_date >= v_ini)
  )
  select count(*) filter (where r.consultant_id = p_staff),
         coalesce(sum(r.monthly_cents) filter (where r.consultant_id = p_staff), 0) * v_pct / 100,
         coalesce(sum(r.monthly_cents) filter (where r.vendido_por = p_staff and r.comissao_venda_cents is not null), 0) * coalesce(v_pctv, 0) / 100
    into v_qt, v_ent, v_ven
    from r;

  return round((case when v_qt > 0 then coalesce(v_piso, 0) else 0 end) + v_ent + v_ven)::bigint;
end $$;
revoke all on function public.projecao_comissao_mes(uuid, date) from anon, authenticated, public;

create or replace function public.atualizar_salarios_pela_carteira()
returns table(staff text, vencimento date, mes_comissao text, antes numeric, depois numeric)
language plpgsql security definer set search_path = public as $$
declare s record; p record; v_novo numeric;
begin
  for s in select c.*, st.name from salario_pela_carteira c join onboarding_staff st on st.id = c.staff_id where c.ativo loop
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

insert into public.salario_pela_carteira (staff_id, supplier_name, a_partir)
values ('33d33570-cac2-4983-9a37-484ece9f41ae', 'Wesley Gestor de Tráfego', '2026-12-01')
on conflict (staff_id) do update set supplier_name = excluded.supplier_name, a_partir = excluded.a_partir, ativo = true;

-- todo dia 06:10 (BRT)
select cron.unschedule(jobid) from cron.job where jobname = 'salarios-pela-carteira-diario';
select cron.schedule('salarios-pela-carteira-diario', '10 9 * * *', $$select public.atualizar_salarios_pela_carteira()$$);
