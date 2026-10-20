-- Triagem por intenção dos agentes de IA (Fabrício, 20/10/2026): na primeira mensagem do lead,
-- o motor crm-agent-respond classifica o serviço pedido e fixa o agente/funil da rota.
-- Rota SEM agente e COM funil (comercial → Funil SE) marca o funil de ENTRADA: a triagem só age aí.
create table if not exists public.crm_agent_intent_routes (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  descricao text not null,
  agent_id uuid references public.crm_ai_agents(id) on delete set null,
  pipeline_id uuid references public.crm_pipelines(id) on delete set null,
  channels text[] not null default array['whatsapp','instagram'],
  is_active boolean not null default true,
  priority integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.crm_agent_intent_routes enable row level security;
grant select, insert, update, delete on public.crm_agent_intent_routes to service_role;
grant select on public.crm_agent_intent_routes to authenticated;
drop policy if exists "leitura crm" on public.crm_agent_intent_routes;
create policy "leitura crm" on public.crm_agent_intent_routes for select to authenticated using (true);
insert into public.crm_agent_intent_routes (key, label, descricao, agent_id, pipeline_id, priority) values
 ('social','Social Media','O lead quer serviço de social media, redes sociais, Instagram, conteúdo, posts, gestão de redes, UNV Social.', (select id from crm_ai_agents where name='Ricardo Santos - Social Media'), (select id from crm_pipelines where name='Social Media'), 30),
 ('trafego','Tráfego Pago','O lead quer tráfego pago, anúncios, gestor de tráfego, Meta Ads, Google Ads, campanhas pagas, UNV Ads.', (select id from crm_ai_agents where name='Agente Tráfego Pago'), (select id from crm_pipelines where name='Tráfego Pago'), 20),
 ('finance','UNV Finance','O lead quer serviço financeiro: BPO financeiro, fluxo de caixa, DRE, contas a pagar e receber, organização financeira, UNV Finance.', (select id from crm_ai_agents where name='Agente UNV Finance'), (select id from crm_pipelines where name='UNV Finance'), 10),
 ('comercial','Comercial','O lead quer aumentar vendas, estruturar time comercial, diretor comercial, gestão comercial, treinamento de vendedores, consultoria de vendas.', null, (select id from crm_pipelines where name='Funil SE'), 0)
on conflict (key) do nothing;
