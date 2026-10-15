-- Onde o lead para no formulário (UNV Ads, UNV Social, UNV Finance), 16/10/2026.
-- Cada visita ao /<produto>/forms/ é uma sessão anônima: o formulário avisa cada tela que abre
-- (form_track), e o CRM (Dashboard > Formulários) monta o funil pergunta a pergunta (form_funnel).
-- Não guarda nome, telefone nem e-mail de quem não enviou: só a etapa, o tempo, as respostas de
-- múltipla escolha, a origem (UTM/anúncio) e o aparelho. Quem envia fica ligado ao lead do CRM.

create table if not exists public.crm_form_sessions (
  id uuid primary key,                       -- gerado no navegador (sessionStorage)
  form text not null check (form in ('unvads','unvsocial','unvfinance')),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_step int,                             -- índice da tela (s0, s10, s1...)
  last_step_name text,
  max_question int not null default 0,       -- maior "Pergunta X" que a pessoa viu
  total_questions int,
  status text not null default 'em_andamento'
    check (status in ('em_andamento','enviou','desqualificado','cortado_perfil','cortado_faturamento','erro_envio')),
  lead_id uuid,
  passos jsonb not null default '[]',        -- [{s, n, q, t(ms desde o início)}]
  respostas jsonb not null default '{}',     -- só múltipla escolha (faturamento, investimento, dor...)
  utm_source text, utm_medium text, utm_campaign text, utm_content text,
  ad_name text, referrer text, device text
);
create index if not exists crm_form_sessions_form_inicio_idx on public.crm_form_sessions (form, started_at desc);

alter table public.crm_form_sessions enable row level security;
drop policy if exists "staff lê" on public.crm_form_sessions;
create policy "staff lê" on public.crm_form_sessions for select to authenticated
  using (exists (select 1 from onboarding_staff s where s.user_id = (select auth.uid()) and s.is_active));

-- Chamada pelo formulário público (anon). Upsert por sessão; nunca rebaixa um status final.
create or replace function public.form_track(
  p_session uuid, p_form text, p_step int default null, p_step_name text default null,
  p_question int default null, p_total int default null, p_status text default null,
  p_lead uuid default null, p_meta jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_ms bigint; v_start timestamptz;
begin
  if p_session is null or p_form not in ('unvads','unvsocial','unvfinance') then return; end if;
  if p_meta is not null and length(p_meta::text) > 4000 then p_meta := null; end if;
  if p_status is not null and p_status not in ('em_andamento','enviou','desqualificado','cortado_perfil','cortado_faturamento','erro_envio') then
    p_status := null;
  end if;

  insert into crm_form_sessions (id, form, total_questions, utm_source, utm_medium, utm_campaign, utm_content, ad_name, referrer, device)
  values (p_session, p_form, p_total,
          left(p_meta->>'utm_source',120), left(p_meta->>'utm_medium',120), left(p_meta->>'utm_campaign',200),
          left(p_meta->>'utm_content',200), left(p_meta->>'ad_name',200), left(p_meta->>'referrer',300), left(p_meta->>'device',20))
  on conflict (id) do nothing;

  select started_at into v_start from crm_form_sessions where id = p_session;
  v_ms := (extract(epoch from (now() - v_start)) * 1000)::bigint;

  update crm_form_sessions set
    updated_at = now(),
    last_step = coalesce(p_step, last_step),
    last_step_name = coalesce(left(p_step_name, 40), last_step_name),
    max_question = greatest(max_question, coalesce(p_question, 0)),
    total_questions = coalesce(p_total, total_questions),
    passos = case when p_step is null or jsonb_array_length(passos) >= 60 then passos
                  else passos || jsonb_build_array(jsonb_build_object('s', p_step, 'n', left(p_step_name, 40), 'q', coalesce(p_question, 0), 't', v_ms)) end,
    respostas = case when p_meta ? 'respostas' and jsonb_typeof(p_meta->'respostas') = 'object' then respostas || (p_meta->'respostas') else respostas end,
    -- status final não volta pra trás (ex.: aba recarregada depois de enviar)
    status = case when p_status is null then status
                  when status in ('enviou','desqualificado') then status
                  else p_status end,
    lead_id = coalesce(p_lead, lead_id)
  where id = p_session and form = p_form;
end $$;
revoke all on function public.form_track(uuid,text,int,text,int,int,text,uuid,jsonb) from public;
grant execute on function public.form_track(uuid,text,int,text,int,int,text,uuid,jsonb) to anon, authenticated, service_role;

-- Funil pro CRM (só time UNV). Abandono = em andamento sem mexer há 30 min.
create or replace function public.form_funnel(p_form text, p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not exists (select 1 from onboarding_staff s where s.user_id = auth.uid() and s.is_active) then
    raise exception 'Só o time UNV';
  end if;
  with base as (
    select *, case when status = 'em_andamento' and updated_at < now() - interval '30 minutes' then 'abandonou'
                   else status end as situacao
    from crm_form_sessions
    where form = p_form and started_at >= p_from and started_at < p_to
  ),
  tot as (
    select count(*) visitas,
      count(*) filter (where max_question >= 1) comecaram,
      count(*) filter (where situacao = 'enviou') enviaram,
      count(*) filter (where situacao = 'desqualificado') desqualificados,
      count(*) filter (where situacao = 'cortado_perfil') cortados_perfil,
      count(*) filter (where situacao = 'cortado_faturamento') cortados_faturamento,
      count(*) filter (where situacao = 'abandonou') abandonaram,
      count(*) filter (where situacao = 'em_andamento') preenchendo_agora,
      count(*) filter (where situacao = 'erro_envio') erros,
      max(total_questions) total_perguntas,
      percentile_cont(0.5) within group (order by extract(epoch from (updated_at - started_at))) filter (where situacao = 'enviou') mediana_seg_envio
    from base
  ),
  -- quantos chegaram em cada pergunta e quantos pararam nela
  perguntas as (
    select q,
      (select count(*) from base b where b.max_question >= q) chegaram,
      (select count(*) from base b where b.situacao = 'abandonou' and b.max_question = q) pararam
    from generate_series(1, greatest(coalesce((select max(total_questions) from base), 0), coalesce((select max(max_question) from base), 0))) q
  ),
  nomes as (
    select (p->>'q')::int q, mode() within group (order by p->>'n') nome
    from base b, jsonb_array_elements(b.passos) p where (p->>'q')::int > 0 group by 1
  ),
  campanhas as (
    select coalesce(nullif(utm_campaign,''), nullif(utm_source,''), 'Sem UTM (direto/orgânico)') campanha,
      count(*) visitas, count(*) filter (where max_question >= 1) comecaram,
      count(*) filter (where situacao in ('enviou','desqualificado')) enviaram,
      count(*) filter (where situacao = 'abandonou') abandonaram
    from base group by 1 order by 2 desc limit 15
  ),
  aparelhos as (
    select coalesce(device,'?') device, count(*) visitas, count(*) filter (where situacao in ('enviou','desqualificado')) enviaram
    from base group by 1
  ),
  recentes as (
    select id, started_at, updated_at, situacao, last_step_name, max_question, total_questions, lead_id,
      respostas, utm_source, utm_campaign, ad_name, device
    from base order by started_at desc limit 150
  )
  select jsonb_build_object(
    'totais', (select to_jsonb(tot) from tot),
    'perguntas', coalesce((select jsonb_agg(jsonb_build_object('q', p.q, 'nome', n.nome, 'chegaram', p.chegaram, 'pararam', p.pararam) order by p.q)
                  from perguntas p left join nomes n on n.q = p.q), '[]'),
    'campanhas', coalesce((select jsonb_agg(to_jsonb(c)) from campanhas c), '[]'),
    'aparelhos', coalesce((select jsonb_agg(to_jsonb(a)) from aparelhos a), '[]'),
    'recentes', coalesce((select jsonb_agg(to_jsonb(r) order by r.started_at desc) from recentes r), '[]')
  ) into v;
  return v;
end $$;
revoke all on function public.form_funnel(text,timestamptz,timestamptz) from public, anon;
grant execute on function public.form_funnel(text,timestamptz,timestamptz) to authenticated, service_role;
