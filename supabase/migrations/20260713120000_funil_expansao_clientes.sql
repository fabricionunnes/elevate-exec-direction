-- Funil "Expansão — Clientes" no CRM Comercial: toda a base de clientes ativos
-- pra ofertar os demais serviços UNV. Lead ganho em qualquer funil entra
-- automaticamente aqui (trigger). Painel "Cliente UNV" no lead mostra a
-- inteligência do Nexus (RPC get_lead_company_intel).

-- ── Pipeline + funil + etapas ──────────────────────────────────────────────
do $$
declare
  v_pipeline uuid;
  v_origin uuid;
  v_group uuid;
begin
  select id into v_pipeline from crm_pipelines where name = 'Expansão — Clientes' limit 1;
  if v_pipeline is null then
    insert into crm_pipelines (name, description, is_active)
    values ('Expansão — Clientes', 'Base de clientes ativos pra oferta dos demais serviços UNV', true)
    returning id into v_pipeline;
  end if;

  select id into v_group from crm_origin_groups where name = 'Funis Comerciais' limit 1;

  select id into v_origin from crm_origins where name = 'Expansão — Clientes' limit 1;
  if v_origin is null then
    insert into crm_origins (name, group_id, pipeline_id, icon, color, sort_order, is_active)
    values ('Expansão — Clientes', v_group, v_pipeline, 'trending-up', '#0D2B5E',
            coalesce((select max(sort_order) + 1 from crm_origins where group_id = v_group), 99), true)
    returning id into v_origin;
  end if;

  if not exists (select 1 from crm_stages where pipeline_id = v_pipeline) then
    insert into crm_stages (pipeline_id, name, sort_order, is_final, final_type, color) values
      (v_pipeline, 'Base de Clientes', 0, false, null, '#64748b'),
      (v_pipeline, 'Mapeamento de Oportunidade', 1, false, null, '#0ea5e9'),
      (v_pipeline, 'Oferta Apresentada', 2, false, null, '#8b5cf6'),
      (v_pipeline, 'Negociação', 3, false, null, '#f59e0b'),
      (v_pipeline, 'Fechado', 4, true, 'won', '#10b981'),
      (v_pipeline, 'Perdido', 5, true, 'lost', '#ef4444');
  end if;
end $$;

-- ── Trigger: lead ganho em qualquer funil → entra na Expansão ─────────────
create or replace function expansion_on_won()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_final text;
  v_exp_origin uuid;
  v_exp_pipeline uuid;
  v_exp_stage uuid;
  v_origin_name text;
  v_digits text;
begin
  if new.stage_id is null or new.stage_id = old.stage_id then return new; end if;
  select final_type into v_final from crm_stages where id = new.stage_id;
  if v_final is distinct from 'won' then return new; end if;
  if new.tenant_id is not null then return new; end if; -- white-label fora

  select id, pipeline_id into v_exp_origin, v_exp_pipeline
  from crm_origins where name = 'Expansão — Clientes' limit 1;
  if v_exp_origin is null or new.origin_id = v_exp_origin then return new; end if;

  select id into v_exp_stage from crm_stages
  where pipeline_id = v_exp_pipeline and sort_order = 0 limit 1;
  if v_exp_stage is null then return new; end if;

  -- dedupe: já existe lead ABERTO na Expansão com mesmo telefone (últimos 8) ou nome
  v_digits := right(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g'), 8);
  if exists (
    select 1 from crm_leads l
    join crm_stages s on s.id = l.stage_id
    where l.origin_id = v_exp_origin
      and coalesce(s.final_type, '') = ''
      and (
        (v_digits <> '' and right(regexp_replace(coalesce(l.phone, ''), '\D', '', 'g'), 8) = v_digits)
        or lower(l.name) = lower(new.name)
      )
  ) then return new; end if;

  select name into v_origin_name from crm_origins where id = new.origin_id;

  insert into crm_leads (
    name, phone, email, company, segment, instagram, city, state,
    origin_id, pipeline_id, stage_id, owner_staff_id,
    origin, notes, entered_pipeline_at, stage_entered_at
  ) values (
    new.name, new.phone, new.email, new.company, new.segment, new.instagram, new.city, new.state,
    v_exp_origin, v_exp_pipeline, v_exp_stage,
    coalesce(new.closer_staff_id, new.owner_staff_id),
    'expansao_automatica',
    'Cliente ganho no funil ' || coalesce(v_origin_name, '?') || ' em ' ||
      to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') ||
      coalesce('. Valor do fechamento: R$ ' || to_char(new.opportunity_value, 'FM999G999G990D00'), '') ||
      '. Trabalhar oferta dos demais serviços UNV.',
    now(), now()
  );
  return new;
end;
$$;

drop trigger if exists trg_expansion_on_won on crm_leads;
create trigger trg_expansion_on_won
  after update of stage_id on crm_leads
  for each row execute function expansion_on_won();

-- ── População inicial: empresas ativas com projeto ativo ──────────────────
do $$
declare
  v_exp_origin uuid;
  v_exp_pipeline uuid;
  v_exp_stage uuid;
  r record;
  v_digits text;
begin
  select id, pipeline_id into v_exp_origin, v_exp_pipeline
  from crm_origins where name = 'Expansão — Clientes' limit 1;
  select id into v_exp_stage from crm_stages
  where pipeline_id = v_exp_pipeline and sort_order = 0 limit 1;

  for r in
    select distinct on (c.id)
      c.id company_id, c.name, c.phone, c.segment,
      p.product_name, p.contract_value, p.contract_start_date,
      st.name consultor
    from onboarding_companies c
    join onboarding_projects p on p.onboarding_company_id = c.id
      and p.status in ('active', 'ativo')
    left join onboarding_staff st on st.id = p.consultant_id
    where c.status = 'active'
      and c.name not ilike '%teste%'
      and c.name <> 'UNV'
    order by c.id, p.created_at desc
  loop
    v_digits := right(regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'), 8);
    if exists (
      select 1 from crm_leads l
      where l.origin_id = v_exp_origin
        and (
          lower(l.name) = lower(r.name)
          or (v_digits <> '' and right(regexp_replace(coalesce(l.phone, ''), '\D', '', 'g'), 8) = v_digits)
        )
    ) then continue; end if;

    insert into crm_leads (
      name, phone, company, segment,
      origin_id, pipeline_id, stage_id,
      origin, notes, entered_pipeline_at, stage_entered_at
    ) values (
      r.name, r.phone, r.name, r.segment,
      v_exp_origin, v_exp_pipeline, v_exp_stage,
      'base_clientes',
      'Cliente UNV ativo. Produto atual: ' || coalesce(r.product_name, '?') ||
        coalesce('. Contrato: R$ ' || to_char(r.contract_value, 'FM999G999G990D00'), '') ||
        coalesce('. Desde: ' || to_char(r.contract_start_date, 'DD/MM/YYYY'), '') ||
        coalesce('. Consultor: ' || r.consultor, '') ||
        '. Ver aba Cliente UNV pra inteligência completa.',
      now(), now()
    );
  end loop;
end $$;

-- ── RPC: inteligência do Nexus pro lead (aba Cliente UNV) ─────────────────
create or replace function get_lead_company_intel(p_lead uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_lead record;
  v_company record;
  v_digits text;
  v_out jsonb;
begin
  if not exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active) then
    return null;
  end if;

  select name, phone, company into v_lead from crm_leads where id = p_lead;
  if v_lead is null then return null; end if;
  v_digits := right(regexp_replace(coalesce(v_lead.phone, ''), '\D', '', 'g'), 8);

  select c.* into v_company
  from onboarding_companies c
  where (v_digits <> '' and right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 8) = v_digits)
     or lower(c.name) = lower(coalesce(v_lead.company, ''))
     or lower(c.name) = lower(v_lead.name)
  order by (c.status = 'active') desc
  limit 1;
  if v_company is null then return null; end if;

  select jsonb_build_object(
    'company', jsonb_build_object('id', v_company.id, 'name', v_company.name,
      'segment', v_company.segment, 'status', v_company.status),
    'projetos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'produto', p.product_name, 'status', p.status,
        'contrato', p.contract_value, 'desde', p.contract_start_date,
        'consultor', st.name))
      from onboarding_projects p
      left join onboarding_staff st on st.id = p.consultant_id
      where p.onboarding_company_id = v_company.id
    ), '[]'::jsonb),
    'saude', (
      select jsonb_build_object('score', h.total_score, 'risco', h.risk_level, 'tendencia', h.trend_direction)
      from client_health_scores h
      join onboarding_projects p on p.id = h.project_id
      where p.onboarding_company_id = v_company.id
      order by h.last_calculated_at desc nulls last limit 1
    ),
    'nps', (
      select jsonb_build_object('nota', n.score, 'feedback', left(n.feedback, 300), 'quando', n.created_at)
      from onboarding_nps_responses n
      join onboarding_projects p on p.id = n.project_id
      where p.onboarding_company_id = v_company.id
      order by n.created_at desc limit 1
    ),
    'cerebro', (
      select jsonb_build_object(
        'termometro', b.brain->>'termometro',
        'momento', left(b.brain->>'momento', 500),
        'vitorias', b.brain->'vitorias_recentes')
      from client_brain b
      join onboarding_projects p on p.id = b.project_id
      where p.onboarding_company_id = v_company.id
      order by b.generated_at desc limit 1
    ),
    'boletim_media', (
      select round(avg(rc.score), 1)
      from project_report_cards rc
      join onboarding_projects p on p.id = rc.project_id
      where p.onboarding_company_id = v_company.id
        and rc.period = (
          select max(rc2.period) from project_report_cards rc2
          join onboarding_projects p2 on p2.id = rc2.project_id
          where p2.onboarding_company_id = v_company.id)
    )
  ) into v_out;

  return v_out;
end;
$$;
