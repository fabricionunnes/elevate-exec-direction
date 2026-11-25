-- Funil de mini-eventos (25/11/2026): evento presencial de um dia, ingresso de R$ 97 vendido em 7 dias,
-- que leva o empresário à call de onde sai o Mastermind Alpha.
-- Páginas: unvholdings.com.br/evento (venda), /evento/checkout e /evento/obrigado (função mini-evento, Asaas).
-- Painel em tempo real: /#/crm/mini-eventos.
-- O funil "Mini-eventos" do CRM (pipeline e1e00000-…0001, 13 etapas), a origem, as etiquetas, o agente e o
-- vínculo do formulário do Meta foram criados no CRM em 25/11/2026, a pedido do Fabrício.

create table if not exists public.miniev_turmas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  promessa text,
  data_evento date not null,
  horario text not null default '14h às 21h',
  cidade text not null default 'Belo Horizonte',
  local_nome text, endereco text, mapa_url text, grupo_whatsapp text,
  preco_cents int not null default 9700,
  preco_socio_cents int not null default 4700,
  vagas int not null default 25,
  venda_ate timestamptz,
  teto_trafego_cents int not null default 250000,
  metas jsonb not null default '{"cliques":1000,"leads":100,"pagina":90,"checkout":45,"ingressos":25,"presentes":20,"calls_agendadas":10,"calls_realizadas":8,"fechamentos":2}'::jsonb,
  curva int[] not null default '{2,1,0,12,4,6}',
  venda_desde date,
  meta_campaign_ids text[] not null default '{}',
  form_id text,
  pipeline_id uuid references public.crm_pipelines(id),
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.miniev_inscricoes (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.miniev_turmas(id) on delete cascade,
  lead_id uuid references public.crm_leads(id) on delete set null,
  nome text, telefone text, email text, documento text,
  com_socio boolean not null default false, socio_nome text,
  valor_cents int not null,
  status text not null default 'checkout',          -- checkout | pago | cancelado
  asaas_customer_id text, asaas_payment_id text, invoice_url text, pix_payload text, pix_image text,
  utm jsonb,
  criado_em timestamptz not null default now(),
  pago_em timestamptz, avisado_em timestamptz,
  presente_em timestamptz
);
-- Cartão pelo Mercado Pago da Yasmim (Pix segue no Asaas da UNV)
alter table public.miniev_inscricoes add column if not exists mp_preference_id text, add column if not exists cartao_url text;
create index if not exists miniev_inscricoes_turma on public.miniev_inscricoes (turma_id, status);
create index if not exists miniev_inscricoes_lead on public.miniev_inscricoes (lead_id);

-- Registro do que acontece no funil fora do CRM (visita à página, checkout, pagamento, presença)
create table if not exists public.miniev_eventos (
  id bigint generated always as identity primary key,
  turma_id uuid not null references public.miniev_turmas(id) on delete cascade,
  tipo text not null,                               -- captura_vista | lead_criado | pagina_vista | checkout_iniciado | ingresso_pago | presenca | presenca_desfeita
  lead_id uuid, inscricao_id uuid, sessao text,
  dados jsonb, em timestamptz not null default now()
);
create index if not exists miniev_eventos_turma on public.miniev_eventos (turma_id, tipo, em desc);

do $$
declare t text;
begin
  foreach t in array array['miniev_turmas','miniev_inscricoes','miniev_eventos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.is_staff_admin_or_master()))', t || '_staff', t);
  end loop;
end $$;
grant update (nome, promessa, local_nome, endereco, mapa_url, grupo_whatsapp, vagas, venda_ate, venda_desde, meta_campaign_ids, metas, curva, ativa)
  on public.miniev_turmas to authenticated;
drop policy if exists miniev_turmas_staff_edita on public.miniev_turmas;
create policy miniev_turmas_staff_edita on public.miniev_turmas for update to authenticated
  using ((select public.is_staff_admin_or_master())) with check ((select public.is_staff_admin_or_master()));

-- Tempo real do painel: cada evento novo chega na tela sem recarregar
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'miniev_eventos') then
    alter publication supabase_realtime add table public.miniev_eventos;
  end if;
end $$;

-- ── Painel ──────────────────────────────────────────────────────────────────
-- Interna (sem trava, só service_role) + a que a tela chama (trava por papel). Assim a interna roda pela API de gestão.
create or replace function public.miniev_painel_interno(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  t miniev_turmas%rowtype;
  v_desde timestamptz;
  v_ads jsonb; v_leads jsonb; v_etapas jsonb; v_dias jsonb; v_fila jsonb; v_abertos jsonb; v_recentes jsonb; v_insc jsonb;
  v_gasto numeric; v_cliques numeric; v_impr numeric; v_n_leads int; v_pagina int; v_checkout int; v_pagos int; v_receita numeric; v_presentes int;
begin
  select * into t from miniev_turmas where slug = p_slug;
  if not found then return null; end if;
  -- leads da turma: do que vier primeiro, a criação da turma ou 10 dias antes de abrir a venda (o teste de promessa roda antes)
  v_desde := least(t.criado_em, coalesce(t.venda_desde::timestamptz, t.criado_em) - interval '10 days') - interval '1 hour';

  -- anúncios: gasto, cliques e leads do Meta por nome de anúncio + leads e ingressos do CRM
  with gasto as (
    select upper(ad_name) as chave, max(ad_name) as nome, max(adset_name) as conjunto,
           sum(spend) as gasto, sum(clicks) as cliques, sum(impressions) as impressoes
    from crm_meta_ads_ads where campaign_id = any(t.meta_campaign_ids) group by 1
  ), l as (
    select upper(coalesce(l.ad_name, '')) as chave, count(*) as leads,
           count(*) filter (where exists (select 1 from miniev_inscricoes i where i.lead_id = l.id and i.turma_id = t.id and i.status = 'pago')) as vendas
    from crm_leads l where l.pipeline_id = t.pipeline_id and l.created_at >= v_desde group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object('anuncio', g.nome, 'conjunto', g.conjunto, 'gasto', g.gasto, 'cliques', g.cliques,
           'impressoes', g.impressoes, 'leads', coalesce(l.leads, 0), 'vendas', coalesce(l.vendas, 0)) order by g.cliques desc nulls last), '[]'::jsonb),
         coalesce(sum(g.gasto), 0), coalesce(sum(g.cliques), 0), coalesce(sum(g.impressoes), 0)
    into v_ads, v_gasto, v_cliques, v_impr
  from gasto g left join l on l.chave = g.chave;

  select count(*) into v_n_leads from crm_leads where pipeline_id = t.pipeline_id and created_at >= v_desde;
  select coalesce(jsonb_agg(jsonb_build_object('etapa', s.name, 'ordem', s.sort_order, 'cor', s.color,
           'leads', (select count(*) from crm_leads l where l.stage_id = s.id and l.created_at >= v_desde)) order by s.sort_order), '[]'::jsonb)
    into v_etapas from crm_stages s where s.pipeline_id = t.pipeline_id;

  select count(distinct coalesce(sessao, id::text)) into v_pagina from miniev_eventos where turma_id = t.id and tipo = 'pagina_vista';
  select count(*) into v_checkout from miniev_inscricoes where turma_id = t.id;
  select count(*), coalesce(sum(valor_cents), 0) / 100.0, count(*) filter (where presente_em is not null)
    into v_pagos, v_receita, v_presentes from miniev_inscricoes where turma_id = t.id and status = 'pago';

  select coalesce(jsonb_agg(jsonb_build_object('dia', d, 'vendas', n, 'receita', r) order by d), '[]'::jsonb) into v_dias from (
    select (pago_em at time zone 'America/Sao_Paulo')::date as d, count(*) as n, sum(valor_cents) / 100.0 as r
    from miniev_inscricoes where turma_id = t.id and status = 'pago' group by 1) x;

  -- fila: lead que ainda está na primeira etapa (ninguém chamou) e checkout aberto sem pagamento
  select coalesce(jsonb_agg(jsonb_build_object('lead_id', l.id, 'nome', l.name, 'telefone', l.phone, 'anuncio', l.ad_name,
           'minutos', floor(extract(epoch from now() - l.created_at) / 60)) order by l.created_at), '[]'::jsonb)
    into v_fila from (
      select l.* from crm_leads l join crm_stages s on s.id = l.stage_id
      where l.pipeline_id = t.pipeline_id and l.created_at >= v_desde and s.sort_order = 0 order by l.created_at limit 60) l;
  select coalesce(jsonb_agg(jsonb_build_object('inscricao_id', i.id, 'lead_id', i.lead_id, 'nome', i.nome, 'telefone', i.telefone,
           'valor', i.valor_cents / 100.0, 'minutos', floor(extract(epoch from now() - i.criado_em) / 60)) order by i.criado_em), '[]'::jsonb)
    into v_abertos from miniev_inscricoes i
    where i.turma_id = t.id and i.status = 'checkout'
      and not exists (select 1 from miniev_inscricoes p where p.turma_id = t.id and p.status = 'pago' and p.telefone = i.telefone);

  select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'lead_id', i.lead_id, 'nome', i.nome, 'telefone', i.telefone, 'com_socio', i.com_socio,
           'socio_nome', i.socio_nome, 'valor', i.valor_cents / 100.0, 'pago_em', i.pago_em, 'presente_em', i.presente_em) order by i.nome), '[]'::jsonb)
    into v_insc from miniev_inscricoes i where i.turma_id = t.id and i.status = 'pago';

  select coalesce(jsonb_agg(x order by (x->>'em') desc), '[]'::jsonb) into v_recentes from (
    select jsonb_build_object('id', e.id, 'tipo', e.tipo, 'em', e.em, 'nome', coalesce(i.nome, l.name), 'dados', e.dados) as x
    from miniev_eventos e left join miniev_inscricoes i on i.id = e.inscricao_id left join crm_leads l on l.id = e.lead_id
    where e.turma_id = t.id order by e.em desc limit 40) y;

  return jsonb_build_object(
    'turma', to_jsonb(t),
    'placar', jsonb_build_object('cliques', v_cliques, 'impressoes', v_impr, 'gasto', v_gasto, 'leads', v_n_leads, 'pagina', v_pagina,
              'checkout', v_checkout, 'ingressos', v_pagos, 'receita', v_receita, 'presentes', v_presentes),
    'anuncios', v_ads, 'etapas', v_etapas, 'dias', v_dias, 'fila', v_fila, 'checkouts_abertos', v_abertos,
    'inscritos', v_insc, 'recentes', v_recentes, 'agora', now());
end $$;
revoke all on function public.miniev_painel_interno(text) from public, anon, authenticated;
grant execute on function public.miniev_painel_interno(text) to service_role;

create or replace function public.miniev_painel(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff_admin_or_master() then raise exception 'sem acesso'; end if;
  return public.miniev_painel_interno(p_slug);
end $$;
revoke all on function public.miniev_painel(text) from public, anon;
grant execute on function public.miniev_painel(text) to authenticated;

-- ── Presença na porta ───────────────────────────────────────────────────────
create or replace function public.miniev_checkin(p_inscricao uuid, p_presente boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare i miniev_inscricoes%rowtype; t miniev_turmas%rowtype; v_etapa uuid; v_atual int;
begin
  if not public.is_staff_admin_or_master() then raise exception 'sem acesso'; end if;
  select * into i from miniev_inscricoes where id = p_inscricao and status = 'pago';
  if not found then raise exception 'inscrição não encontrada ou não paga'; end if;
  select * into t from miniev_turmas where id = i.turma_id;
  update miniev_inscricoes set presente_em = case when p_presente then coalesce(presente_em, now()) else null end where id = i.id;
  insert into miniev_eventos (turma_id, tipo, lead_id, inscricao_id)
    values (i.turma_id, case when p_presente then 'presenca' else 'presenca_desfeita' end, i.lead_id, i.id);
  if i.lead_id is not null then
    select s.sort_order into v_atual from crm_leads l join crm_stages s on s.id = l.stage_id where l.id = i.lead_id;
    -- só anda pra frente: quem já está em call não volta pra "Presente no evento"
    if p_presente and coalesce(v_atual, 0) < 5 then
      select id into v_etapa from crm_stages where pipeline_id = t.pipeline_id and name = 'Presente no evento';
    elsif not p_presente and v_atual = 5 then
      select id into v_etapa from crm_stages where pipeline_id = t.pipeline_id and name = 'Ingresso pago';
    end if;
    if v_etapa is not null then update crm_leads set stage_id = v_etapa where id = i.lead_id; end if;
  end if;
  return jsonb_build_object('ok', true, 'presente', p_presente);
end $$;
revoke all on function public.miniev_checkin(uuid, boolean) from public, anon;
grant execute on function public.miniev_checkin(uuid, boolean) to authenticated;

-- ── Turma 1: quinta 10/12/2026, Belo Horizonte ──────────────────────────────
insert into public.miniev_turmas (slug, nome, promessa, data_evento, horario, cidade, venda_ate, venda_desde, meta_campaign_ids, form_id, pipeline_id)
values ('bh-10dez', 'Workshop presencial · BH · 10/12', 'Saia em um dia com o planejamento comercial de 2027 pronto',
        '2026-12-10', '14h às 21h', 'Belo Horizonte', '2026-12-09 18:00:00-03', '2026-12-03',
        array['120251672176750504'], '1152182700649939', 'e1e00000-0000-4000-8000-000000000001')
on conflict (slug) do nothing;

-- Confere a cada 5 minutos os checkouts abertos (quem pagou e fechou a aba)
select cron.unschedule(jobid) from cron.job where jobname = 'mini-evento-conferir';
select cron.schedule('mini-evento-conferir', '*/5 * * * *', $c$
  select net.http_post(
    url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/mini-evento',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{"action":"conferir"}'::jsonb,
    timeout_milliseconds := 30000)
$c$);

notify pgrst, 'reload schema';
