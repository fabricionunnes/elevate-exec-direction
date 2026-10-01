-- Visão geral, bloco "Onde estão nossos clientes": lista por UF ao clicar no estado do mapa
-- (pedido do Fabrício, 01/10/2026: "quero poder clicar no estado e ver quais são os clientes de lá, ou os leads").
-- Mesmas regras do bloco 'estados' de crm_visao_geral: cliente = lead com ganho no CRM Comercial no
-- histórico todo (etapa de ganho ou venda em crm_sales, fora de funis de evento) + empresa ativa em
-- carteira não ligada a um lead ganho; lead = criado no período fora das etapas exclude_from_lead_count.
-- Mesmo recorte por papel (crm_escopo_atual). p_uf = sigla ou 'Sem UF'. Devolve o total e até 500 linhas.
create or replace function public.crm_visao_geral_uf(
  p_from timestamptz, p_to timestamptz, p_uf text, p_tipo text default 'clientes',
  p_origin uuid default null, p_campaign text default null, p_product text default null, p_staff uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb; v_esc jsonb; v_ids uuid[];
  v_uf text := nullif(upper(trim(coalesce(p_uf, ''))), '');
  v_sem_uf boolean;
begin
  if not exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and coalesce(s.is_active, true)) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  v_esc := public.crm_escopo_atual();
  v_ids := public.crm_escopo_ids(v_esc);
  p_staff := case when v_ids is null then p_staff when p_staff = any(v_ids) then p_staff
                  when v_esc->>'papel' = 'head_comercial' then null else (v_esc->>'staff_id')::uuid end;
  v_sem_uf := v_uf is null or v_uf in ('SEM UF', 'SEM');

  if coalesce(p_tipo, 'clientes') = 'leads' then
    with leads as (
      select l.id, l.name, l.company, l.city, l.created_at, l.opportunity_value::numeric valor,
             coalesce(o.name, nullif(l.origin, ''), 'Sem origem') origem, p.name funil, s.name etapa, st.name dono
        from crm_leads l
        left join crm_stages s on s.id = l.stage_id
        left join crm_pipelines p on p.id = l.pipeline_id
        left join crm_origins o on o.id = l.origin_id
        left join onboarding_staff st on st.id = l.owner_staff_id
       where l.tenant_id is null and l.created_at >= p_from and l.created_at < p_to
         and coalesce(s.exclude_from_lead_count, false) = false
         and (case when v_sem_uf then nullif(trim(coalesce(l.state, '')), '') is null else upper(trim(l.state)) = v_uf end)
         and (p_origin is null or l.origin_id = p_origin)
         and (p_campaign is null or l.meta_campaign_id = p_campaign)
         and (p_product is null or l.product_id in (select id from onboarding_services where name = p_product))
         and (p_staff is null or l.owner_staff_id = p_staff or l.sdr_staff_id = p_staff or l.closer_staff_id = p_staff)
         and (v_ids is null or l.owner_staff_id = any(v_ids) or l.sdr_staff_id = any(v_ids) or l.closer_staff_id = any(v_ids))
    )
    select jsonb_build_object(
      'escopo', v_esc, 'tipo', 'leads', 'uf', case when v_sem_uf then 'Sem UF' else v_uf end,
      'total', (select count(*) from leads),
      'itens', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
          select jsonb_build_object('id', id, 'kind', 'lead', 'nome', coalesce(nullif(name, ''), company, 'Lead'), 'empresa', company, 'cidade', city,
                   'origem', origem, 'funil', funil, 'etapa', etapa, 'dono', dono, 'data', created_at, 'valor', valor) x
            from leads order by created_at desc limit 500) y)
    ) into v;
    return v;
  end if;

  with clientes_crm as (
    select l.id, l.name, l.company, l.city,
           coalesce(nullif(upper(trim(l.state)), ''),
                    (select upper(trim(c.address_state)) from onboarding_projects pj join onboarding_companies c on c.id = pj.company_id
                      where pj.crm_lead_id = l.id and nullif(trim(c.address_state), '') is not null limit 1)) uf,
           (select coalesce(sum(s.revenue_value), 0) from crm_sales s where s.lead_id = l.id) receita,
           l.opportunity_value::numeric valor_lead,
           coalesce(l.closed_at, (select max(s.sale_date)::timestamptz from crm_sales s where s.lead_id = l.id), l.stage_entered_at) ganho_em,
           coalesce((select s.product_name from crm_sales s where s.lead_id = l.id and nullif(s.product_name, '') is not null order by s.sale_date desc limit 1),
                    (select sv.name from onboarding_services sv where sv.id = l.product_id)) produto,
           coalesce(cl.name, ow.name) closer, p.name funil
      from crm_leads l
      left join crm_stages st on st.id = l.stage_id
      left join crm_pipelines p on p.id = l.pipeline_id
      left join onboarding_staff cl on cl.id = l.closer_staff_id
      left join onboarding_staff ow on ow.id = l.owner_staff_id
     where l.tenant_id is null
       and (st.final_type = 'won' or exists (select 1 from crm_sales s where s.lead_id = l.id))
       and coalesce(p.name, '') !~* 'evento|mans[ãa]o|palestra'
       and (p_origin is null or l.origin_id = p_origin)
       and (p_campaign is null or l.meta_campaign_id = p_campaign)
       and (p_product is null or l.product_id in (select id from onboarding_services where name = p_product))
       and (p_staff is null or l.owner_staff_id = p_staff or l.sdr_staff_id = p_staff or l.closer_staff_id = p_staff)
       and (v_ids is null or l.owner_staff_id = any(v_ids) or l.sdr_staff_id = any(v_ids) or l.closer_staff_id = any(v_ids))
  ),
  carteira as (
    select c.id, c.name, c.address_city, nullif(upper(trim(c.address_state)), '') uf, c.contract_value::numeric valor, c.contract_start_date,
           cs.name responsavel
      from onboarding_companies c
      left join onboarding_staff cs on cs.id = coalesce(c.consultant_id, c.cs_id)
     where c.status = 'active' and c.tenant_id is null
       and v_ids is null and p_staff is null and p_origin is null and p_campaign is null and p_product is null
       and not exists (select 1 from onboarding_projects pj join clientes_crm g on g.id = pj.crm_lead_id where pj.company_id = c.id)
  ),
  todos as (
    select g.id, 'lead'::text kind, 'ganho'::text tipo, coalesce(nullif(g.name, ''), g.company, 'Cliente') nome, g.company empresa, g.city cidade,
           g.closer, g.ganho_em data, case when g.receita > 0 then g.receita else g.valor_lead end valor, g.produto, g.funil
      from clientes_crm g
     where case when v_sem_uf then g.uf is null else g.uf = v_uf end
    union all
    select c.id, 'company', 'carteira', c.name, c.name, c.address_city, c.responsavel, c.contract_start_date::timestamptz, c.valor, null, null
      from carteira c
     where case when v_sem_uf then c.uf is null else c.uf = v_uf end
  )
  select jsonb_build_object(
    'escopo', v_esc, 'tipo', 'clientes', 'uf', case when v_sem_uf then 'Sem UF' else v_uf end,
    'total', (select count(*) from todos),
    'ganhos', (select count(*) from todos where tipo = 'ganho'),
    'carteira', (select count(*) from todos where tipo = 'carteira'),
    'itens', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select jsonb_build_object('id', id, 'kind', kind, 'tipo', tipo, 'nome', nome, 'empresa', empresa, 'cidade', cidade,
                 'closer', closer, 'data', data, 'valor', valor, 'produto', produto, 'funil', funil) x
          from todos order by valor desc nulls last, data desc nulls last limit 500) y)
  ) into v;
  return v;
end;
$$;
revoke all on function public.crm_visao_geral_uf(timestamptz, timestamptz, text, text, uuid, text, text, uuid) from public;
grant execute on function public.crm_visao_geral_uf(timestamptz, timestamptz, text, text, uuid, text, text, uuid) to authenticated;
