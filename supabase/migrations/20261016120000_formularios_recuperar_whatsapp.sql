-- Recuperar quem abandona o formulário depois de digitar o WhatsApp (Fabrício autorizou, 16/10/2026).
-- O formulário só manda nome e WhatsApp DEPOIS que a pessoa avança da pergunta do WhatsApp;
-- antes disso nada pessoal é guardado. Só o time UNV lê (RLS da tabela).
alter table public.crm_form_sessions
  add column if not exists contato_nome text,
  add column if not exists contato_whatsapp text,
  add column if not exists contato_em timestamptz,
  add column if not exists recuperacao_por uuid references public.onboarding_staff(id) on delete set null,
  add column if not exists recuperacao_em timestamptz;

create or replace function public.form_track(
  p_session uuid, p_form text, p_step int default null, p_step_name text default null,
  p_question int default null, p_total int default null, p_status text default null,
  p_lead uuid default null, p_meta jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_ms bigint; v_start timestamptz; v_wpp text; v_nome text;
begin
  if p_session is null or p_form not in ('unvads','unvsocial','unvfinance') then return; end if;
  if p_meta is not null and length(p_meta::text) > 4000 then p_meta := null; end if;
  if p_status is not null and p_status not in ('em_andamento','enviou','desqualificado','cortado_perfil','cortado_faturamento','erro_envio') then
    p_status := null;
  end if;
  -- contato: só número com 10 a 13 dígitos e nome curto
  v_wpp := nullif(regexp_replace(coalesce(p_meta#>>'{contato,whatsapp}', ''), '\D', '', 'g'), '');
  if v_wpp is not null and (length(v_wpp) < 10 or length(v_wpp) > 13) then v_wpp := null; end if;
  v_nome := nullif(left(trim(coalesce(p_meta#>>'{contato,nome}', '')), 80), '');

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
    status = case when p_status is null then status
                  when status in ('enviou','desqualificado') then status
                  else p_status end,
    lead_id = coalesce(p_lead, lead_id),
    contato_whatsapp = coalesce(v_wpp, contato_whatsapp),
    contato_nome = coalesce(v_nome, contato_nome),
    contato_em = case when v_wpp is not null and contato_em is null then now() else contato_em end
  where id = p_session and form = p_form;
end $$;
revoke all on function public.form_track(uuid,text,int,text,int,int,text,uuid,jsonb) from public;
grant execute on function public.form_track(uuid,text,int,text,int,int,text,uuid,jsonb) to anon, authenticated, service_role;

-- time marca que já chamou a pessoa (pra não chamar duas vezes)
create or replace function public.form_session_recuperado(p_session uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_staff uuid;
begin
  select id into v_staff from onboarding_staff where user_id = auth.uid() and is_active;
  if v_staff is null then raise exception 'Só o time UNV'; end if;
  update crm_form_sessions set recuperacao_por = v_staff, recuperacao_em = now() where id = p_session;
end $$;
revoke all on function public.form_session_recuperado(uuid) from public, anon;
grant execute on function public.form_session_recuperado(uuid) to authenticated;

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
      count(*) filter (where situacao = 'abandonou' and contato_whatsapp is not null) recuperaveis,
      count(*) filter (where situacao = 'abandonou' and contato_whatsapp is not null and recuperacao_em is null) recuperaveis_pendentes,
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
      respostas, utm_source, utm_campaign, ad_name, device, contato_nome, contato_whatsapp, recuperacao_em
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
