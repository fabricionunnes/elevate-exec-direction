-- Segurança 17/09/2026: o formulário público de kickoff lia a empresa INTEIRA (CPF do dono, contrato)
-- e podia alterar qualquer coluna de qualquer empresa. Passa a usar duas funções que só
-- entregam/gravam os campos do próprio formulário, para a empresa do link.
create or replace function public.kickoff_form_get(p_company_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', c.name,
    'north_star_metric_cents', c.north_star_metric_cents, 'north_star_metric_label', c.north_star_metric_label,
    'main_challenges', c.main_challenges, 'sales_team_size', c.sales_team_size, 'conversion_rate', c.conversion_rate,
    'average_ticket', c.average_ticket, 'acquisition_channels', c.acquisition_channels, 'target_audience', c.target_audience,
    'has_structured_process', c.has_structured_process, 'crm_usage', c.crm_usage, 'competitors', c.competitors,
    'has_sales_goals', c.has_sales_goals, 'swot_strengths', c.swot_strengths, 'swot_weaknesses', c.swot_weaknesses,
    'swot_opportunities', c.swot_opportunities, 'swot_threats', c.swot_threats, 'commercial_structure', c.commercial_structure,
    'growth_target', c.growth_target, 'tools_used', c.tools_used, 'objectives_with_unv', c.objectives_with_unv,
    'key_results', c.key_results, 'quarterly_goals', c.quarterly_goals,
    'growth_expectation_3m', c.growth_expectation_3m, 'growth_expectation_6m', c.growth_expectation_6m,
    'growth_expectation_12m', c.growth_expectation_12m, 'company_units', c.company_units, 'notes', c.notes,
    'sales_history', coalesce((select jsonb_agg(jsonb_build_object('month_year', h.month_year, 'revenue', h.revenue, 'sales_count', h.sales_count) order by h.month_year desc)
                               from company_sales_history h where h.company_id = c.id and h.is_pre_unv), '[]'::jsonb)
  ) from onboarding_companies c where c.id = p_company_id;
$$;

create or replace function public.kickoff_form_save(p_company_id uuid, p_data jsonb, p_sales jsonb default '[]'::jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare t text; n int;
begin
  if p_company_id is null or p_data is null then return false; end if;
  -- limites simples contra abuso (link é público)
  if length(p_data::text) > 200000 or length(coalesce(p_sales,'[]'::jsonb)::text) > 20000 then
    raise exception 'dados grandes demais';
  end if;
  update onboarding_companies c set
    north_star_metric_cents = nullif(nullif(p_data->>'north_star_metric_cents',''),'0')::bigint,
    north_star_metric_label = nullif(p_data->>'north_star_metric_label',''),
    main_challenges = nullif(p_data->>'main_challenges',''), sales_team_size = nullif(p_data->>'sales_team_size',''),
    conversion_rate = nullif(p_data->>'conversion_rate',''), average_ticket = nullif(p_data->>'average_ticket',''),
    acquisition_channels = nullif(p_data->>'acquisition_channels',''), target_audience = nullif(p_data->>'target_audience',''),
    has_structured_process = nullif(p_data->>'has_structured_process',''), crm_usage = nullif(p_data->>'crm_usage',''),
    competitors = nullif(p_data->>'competitors',''), has_sales_goals = nullif(p_data->>'has_sales_goals',''),
    swot_strengths = nullif(p_data->>'swot_strengths',''), swot_weaknesses = nullif(p_data->>'swot_weaknesses',''),
    swot_opportunities = nullif(p_data->>'swot_opportunities',''), swot_threats = nullif(p_data->>'swot_threats',''),
    commercial_structure = nullif(p_data->>'commercial_structure',''), growth_target = nullif(p_data->>'growth_target',''),
    tools_used = nullif(p_data->>'tools_used',''), objectives_with_unv = nullif(p_data->>'objectives_with_unv',''),
    key_results = nullif(p_data->>'key_results',''),
    quarterly_goals = coalesce(p_data->'quarterly_goals', c.quarterly_goals),
    growth_expectation_3m = nullif(p_data->>'growth_expectation_3m',''),
    growth_expectation_6m = nullif(p_data->>'growth_expectation_6m',''),
    growth_expectation_12m = nullif(p_data->>'growth_expectation_12m',''),
    company_units = coalesce(p_data->'company_units', c.company_units),
    notes = nullif(p_data->>'notes','')
  where c.id = p_company_id;
  get diagnostics n = row_count;
  if n = 0 then return false; end if;

  if jsonb_typeof(p_sales) = 'array' and jsonb_array_length(p_sales) > 0 then
    if jsonb_array_length(p_sales) > 36 then raise exception 'histórico grande demais'; end if;
    delete from company_sales_history where company_id = p_company_id and is_pre_unv = true;
    insert into company_sales_history (company_id, month_year, revenue, sales_count, is_pre_unv)
    select p_company_id, (e->>'month_year')::date, (e->>'revenue')::numeric, nullif(e->>'sales_count','')::int, true
    from jsonb_array_elements(p_sales) e where coalesce((e->>'revenue')::numeric, 0) > 0;
  end if;
  return true;
end $$;

revoke all on function public.kickoff_form_get(uuid) from public;
revoke all on function public.kickoff_form_save(uuid, jsonb, jsonb) from public;
grant execute on function public.kickoff_form_get(uuid) to anon, authenticated, service_role;
grant execute on function public.kickoff_form_save(uuid, jsonb, jsonb) to anon, authenticated, service_role;
