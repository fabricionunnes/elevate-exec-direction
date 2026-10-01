-- Impulsos: execução em massa por lotes, com ritmo e status por item (benchmark Datacrazy,
-- 30/09/2026). Portado do UNV Sales (migration 0153) e adaptado ao Nexus: sem tenant no
-- CRM da UNV, staff = onboarding_staff, sem crm_automation_outbox.
--
-- Um impulso pega uma lista (seleção do kanban, filtro de funil, etiqueta ou telefones
-- colados) e aplica UMA ação em lotes de N itens a cada Y segundos, dentro da janela de
-- horário escolhida. Ações: mensagem de WhatsApp pelo número conectado (Evolution),
-- template da API oficial, mover de etapa, aplicar etiqueta, trocar responsável e
-- inscrever em cadência.
--
-- Quem roda: pg_cron chama a edge crm-impulso-tick a cada minuto (segredo no header).
-- A edge pede UM lote por impulso (crm_impulso_claim), executa e grava o resultado.
-- Travas: teto diário por número, um lead só entra uma vez no impulso, telefone repetido
-- é pulado, quem tem a etiqueta "Opt-out" é pulado (na criação e de novo na hora do lote).
-- Cada impulso é uma linha da Central de Execuções (crm_executions, kind 'impulso').

create table if not exists public.crm_impulsos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  action text not null check (action in ('whatsapp_text', 'official_template', 'move_stage', 'add_tag', 'assign_owner', 'cadence')),
  config jsonb not null default '{}'::jsonb,
  source text not null check (source in ('leads', 'filter', 'tag', 'phones')),
  source_label text,
  status text not null default 'draft' check (status in ('draft', 'running', 'paused', 'done', 'cancelled')),
  batch_size integer not null default 10 check (batch_size between 1 and 500),
  interval_seconds integer not null default 60 check (interval_seconds between 60 and 86400),
  window_start time,                 -- nulo = qualquer horário
  window_end time,
  window_weekdays integer[],         -- 0 = domingo. nulo = todos os dias
  daily_cap integer check (daily_cap is null or daily_cap > 0),   -- teto por número por dia
  total integer not null default 0,
  sent integer not null default 0,
  failed integer not null default 0,
  skipped integer not null default 0,
  batches integer not null default 0,
  next_batch_at timestamptz,
  last_batch_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  pause_reason text,
  campaign_id uuid references public.whatsapp_official_campaigns(id) on delete set null,
  execution_id uuid references public.crm_executions(id) on delete set null,
  created_by uuid references public.onboarding_staff(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_impulsos_created_idx on public.crm_impulsos (created_at desc);
create index if not exists crm_impulsos_due_idx on public.crm_impulsos (next_batch_at) where status = 'running';

create table if not exists public.crm_impulso_items (
  id uuid primary key default gen_random_uuid(),
  impulso_id uuid not null references public.crm_impulsos(id) on delete cascade,
  lead_id uuid references public.crm_leads(id) on delete set null,
  name text,
  phone text,
  company text,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped', 'cancelled')),
  error text,
  batch_no integer,
  sender_id uuid,            -- número que enviou (whatsapp_instances ou whatsapp_official_instances)
  message_id uuid,           -- crm_whatsapp_messages: de onde vem entregue/lido
  conversation_id uuid,
  recipient_id uuid,         -- whatsapp_official_campaign_recipients (template oficial)
  claimed_at timestamptz,
  sent_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
-- o mesmo lead (ou o mesmo telefone solto) nunca entra duas vezes no mesmo impulso
create unique index if not exists crm_impulso_items_lead_uniq on public.crm_impulso_items (impulso_id, lead_id) where lead_id is not null;
create unique index if not exists crm_impulso_items_phone_uniq on public.crm_impulso_items (impulso_id, phone) where lead_id is null;
create index if not exists crm_impulso_items_status_idx on public.crm_impulso_items (impulso_id, status, created_at);
create index if not exists crm_impulso_items_sender_idx on public.crm_impulso_items (sender_id, sent_at) where status in ('sent', 'sending');
create index if not exists crm_impulso_items_recipient_idx on public.crm_impulso_items (recipient_id) where recipient_id is not null;
create index if not exists crm_impulso_items_sending_idx on public.crm_impulso_items (claimed_at) where status = 'sending';

alter table public.crm_impulsos enable row level security;
alter table public.crm_impulso_items enable row level security;

drop policy if exists "Staff ve impulsos" on public.crm_impulsos;
create policy "Staff ve impulsos" on public.crm_impulsos for select to authenticated
  using (not public.current_user_is_tenant() and (public.is_crm_admin() or created_by = public.get_current_staff_id()));
drop policy if exists "Staff ve itens do impulso" on public.crm_impulso_items;
create policy "Staff ve itens do impulso" on public.crm_impulso_items for select to authenticated
  using (exists (select 1 from public.crm_impulsos i where i.id = impulso_id));

-- escrita só pelas funções (security definer) e pela edge (service_role)
grant select on public.crm_impulsos, public.crm_impulso_items to authenticated;
grant all on public.crm_impulsos, public.crm_impulso_items to service_role;

-- ---------------------------------------------------------------- utilitários
-- Telefone no formato que o WhatsApp espera: 55 + DDD + número. Mesmo critério do
-- disparo de template (toE164BR). Válido = 12 ou 13 dígitos.
create or replace function public.crm_impulso_phone(p text)
returns text language sql immutable as $$
  select case when d = '' then null
              when left(d, 2) <> '55' or length(d) < 12 then '55' || d
              else d end
  from (select ltrim(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '0') as d) x
$$;

-- Próxima abertura da janela (horário de Brasília). Dentro da janela devolve p_from.
create or replace function public.crm_impulso_window_next(p_start time, p_end time, p_weekdays integer[], p_from timestamptz default now())
returns timestamptz language plpgsql stable as $$
declare
  loc timestamp := p_from at time zone 'America/Sao_Paulo';
  wd integer[] := coalesce(p_weekdays, array[0, 1, 2, 3, 4, 5, 6]);
  d date;
  k integer;
begin
  if p_start is null or p_end is null then return p_from; end if;
  for k in 0..7 loop
    d := loc::date + k;
    if extract(dow from d)::integer = any(wd) then
      if k = 0 then
        if loc::time >= p_start and loc::time < p_end then return p_from; end if;
        if loc::time < p_start then return (d + p_start) at time zone 'America/Sao_Paulo'; end if;
      else
        return (d + p_start) at time zone 'America/Sao_Paulo';
      end if;
    end if;
  end loop;
  return p_from + interval '1 hour';
end $$;

-- Status que a tela mostra: enviado vira entregue/lido quando o WhatsApp confirma.
create or replace function public.crm_impulso_item_status(x_status text, m_status text, r_status text)
returns text language sql immutable as $$
  select case
    when x_status <> 'sent' then x_status
    when r_status is not null then
      case public.official_recipient_status(r_status, m_status)
        when 'error' then 'failed' when 'failed' then 'failed'
        when 'read' then 'read' when 'delivered' then 'delivered' else 'sent' end
    when m_status in ('read', 'delivered') then m_status
    else 'sent' end
$$;

-- Quantos envios o número já fez hoje (dia de Brasília). Template oficial conta todos os
-- disparos do número (impulso ou não); texto conta o que saiu por impulso.
create or replace function public.crm_impulso_enviados_hoje(p_action text, p_sender uuid)
returns integer language sql stable security definer set search_path = public as $$
  with d as (select date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' as ini)
  select case when p_action = 'official_template' then
    (select count(*)::integer
       from whatsapp_official_campaigns c
       join whatsapp_official_campaign_recipients r on r.campaign_id = c.id, d
      where c.official_instance_id = p_sender and c.created_at >= d.ini - interval '60 days'
        and ((r.status in ('sent', 'delivered', 'read', 'failed') and r.sent_at >= d.ini)
          or (r.status in ('pending', 'processing') and r.created_at >= d.ini)))
  else
    (select count(*)::integer from crm_impulso_items x, d
      where x.sender_id = p_sender and ((x.status = 'sent' and x.sent_at >= d.ini) or x.status = 'sending'))
  end
$$;
revoke all on function public.crm_impulso_enviados_hoje(text, uuid) from public, anon;
grant execute on function public.crm_impulso_enviados_hoje(text, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- de onde vêm os itens
-- p_source: {"type":"leads","lead_ids":[...]} | {"type":"filter","pipeline_id":..,"stage_id":..,"owner_id":..,"tag_id":..}
--         | {"type":"tag","tag_id":..} | {"type":"phones","phones":[{"phone":"..","name":".."}]}
-- Telefone colado é casado com o lead mais recente do mesmo número (DDD + 8 últimos dígitos).
create or replace function public.crm_impulso_resolver(p_source jsonb)
returns table (lead_id uuid, name text, phone text, company text)
language plpgsql stable security definer set search_path = public as $$
declare
  t text := p_source->>'type';
  st record;
begin
  select s.id, s.tenant_id into st from onboarding_staff s where s.user_id = auth.uid() and s.is_active limit 1;
  if st.id is null then raise exception 'Sem acesso ao CRM'; end if;

  if t = 'leads' then
    return query
      select l.id, l.name, l.phone, l.company from crm_leads l
       where l.id in (select (jsonb_array_elements_text(coalesce(p_source->'lead_ids', '[]'::jsonb)))::uuid)
         and l.tenant_id is not distinct from st.tenant_id;
  elsif t = 'filter' then
    if nullif(p_source->>'pipeline_id', '') is null then raise exception 'Escolha o funil'; end if;
    return query
      select l.id, l.name, l.phone, l.company from crm_leads l
       where l.tenant_id is not distinct from st.tenant_id
         and l.pipeline_id = (p_source->>'pipeline_id')::uuid
         and (nullif(p_source->>'stage_id', '') is null or l.stage_id = (p_source->>'stage_id')::uuid)
         and (nullif(p_source->>'owner_id', '') is null or l.owner_staff_id = (p_source->>'owner_id')::uuid)
         and (nullif(p_source->>'tag_id', '') is null or exists (
               select 1 from crm_lead_tags lt where lt.lead_id = l.id and lt.tag_id = (p_source->>'tag_id')::uuid));
  elsif t = 'tag' then
    if nullif(p_source->>'tag_id', '') is null then raise exception 'Escolha a etiqueta'; end if;
    return query
      select l.id, l.name, l.phone, l.company from crm_leads l
       where l.tenant_id is not distinct from st.tenant_id
         and exists (select 1 from crm_lead_tags lt where lt.lead_id = l.id and lt.tag_id = (p_source->>'tag_id')::uuid);
  elsif t = 'phones' then
    return query
      with raw as (
        select distinct on (substr(x.ph, 3, 2) || right(x.ph, 8)) x.ph, x.nm
          from (select public.crm_impulso_phone(e->>'phone') as ph, nullif(btrim(e->>'name'), '') as nm
                  from jsonb_array_elements(coalesce(p_source->'phones', '[]'::jsonb)) e) x
         where x.ph is not null
         order by substr(x.ph, 3, 2) || right(x.ph, 8), (x.nm is null), x.ph
      )
      select m.id, coalesce(raw.nm, m.name), raw.ph, m.company
        from raw
        left join lateral (
          select l.id, l.name, l.company from crm_leads l
           where right(regexp_replace(coalesce(l.phone, ''), '\D', '', 'g'), 8) = right(raw.ph, 8)
             and substr(public.crm_impulso_phone(l.phone), 3, 2) = substr(raw.ph, 3, 2)
             and l.tenant_id is not distinct from st.tenant_id
           order by l.created_at desc limit 1
        ) m on true;
  else
    raise exception 'Fonte de itens inválida';
  end if;
end $$;
revoke all on function public.crm_impulso_resolver(jsonb) from public, anon, authenticated;

-- Alvos já classificados: quem entra e quem é pulado (e por quê).
create or replace function public.crm_impulso_alvos(p_source jsonb, p_action text)
returns table (lead_id uuid, name text, phone text, company text, skip_reason text)
language sql stable security definer set search_path = public as $$
  with base as (
    select r.lead_id, r.name, r.company,
           case when p_action in ('whatsapp_text', 'official_template') then public.crm_impulso_phone(r.phone) else r.phone end as phone,
           r.lead_id is not null and exists (
             select 1 from crm_lead_tags lt join crm_tags t on t.id = lt.tag_id
              where lt.lead_id = r.lead_id and t.name ilike 'opt-out') as optout
      from public.crm_impulso_resolver(p_source) r
  ), marcado as (
    select b.*,
           (p_action in ('whatsapp_text', 'official_template')) as msg,
           (b.phone is not null and length(b.phone) between 12 and 13) as fone_ok
      from base b
  ), numerado as (
    select m.*,
           case when m.msg and m.fone_ok and not m.optout
                then row_number() over (partition by (m.msg and m.fone_ok and not m.optout), m.phone order by m.lead_id nulls last)
                else 1 end as rn
      from marcado m
  )
  select n.lead_id, n.name, n.phone, n.company,
         case when n.msg and not n.fone_ok then 'Sem telefone válido'
              when n.msg and n.optout then 'Pediu pra não receber (Opt-out)'
              when n.msg and n.rn > 1 then 'Telefone repetido no impulso'
              when not n.msg and n.lead_id is null then 'Telefone sem lead no CRM'
         end
    from numerado n
$$;
revoke all on function public.crm_impulso_alvos(jsonb, text) from public, anon, authenticated;

-- Contagem pra confirmação antes de começar.
create or replace function public.crm_impulso_preview(p_source jsonb, p_action text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_crm_admin() then raise exception 'Só administrador do CRM cria impulso'; end if;
  select jsonb_build_object(
    'total', count(*),
    'elegiveis', count(*) filter (where a.skip_reason is null),
    'sem_telefone', count(*) filter (where a.skip_reason = 'Sem telefone válido'),
    'opt_out', count(*) filter (where a.skip_reason like 'Pediu%'),
    'repetidos', count(*) filter (where a.skip_reason like 'Telefone repetido%'),
    'sem_lead', count(*) filter (where a.skip_reason like 'Telefone sem lead%'),
    'amostra', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'phone', s.phone, 'company', s.company))
                           from (select a2.name, a2.phone, a2.company from public.crm_impulso_alvos(p_source, p_action) a2
                                  where a2.skip_reason is null limit 3) s), '[]'::jsonb)
  ) into r
  from public.crm_impulso_alvos(p_source, p_action) a;
  return r;
end $$;
revoke all on function public.crm_impulso_preview(jsonb, text) from public, anon;
grant execute on function public.crm_impulso_preview(jsonb, text) to authenticated;

-- ---------------------------------------------------------------- contadores
-- Reconta o impulso, fecha quando não sobra item aberto e espelha na Central de Execuções.
create or replace function public.crm_impulso_recontar(p_id uuid)
returns text language plpgsql volatile security definer set search_path = public as $$
declare _status text;
begin
  update crm_impulsos i set
    sent = c.sent, failed = c.failed, skipped = c.skipped, updated_at = now(),
    status = case when i.status in ('running', 'paused') and c.abertos = 0 then 'done' else i.status end,
    finished_at = case when i.status in ('running', 'paused') and c.abertos = 0 then now() else i.finished_at end,
    pause_reason = case when i.status in ('running', 'paused') and c.abertos = 0 then null else i.pause_reason end
  from (select count(*) filter (where status = 'sent') as sent,
               count(*) filter (where status = 'failed') as failed,
               count(*) filter (where status in ('skipped', 'cancelled')) as skipped,
               count(*) filter (where status in ('pending', 'sending')) as abertos
          from crm_impulso_items where impulso_id = p_id) c
  where i.id = p_id
  returning i.status into _status;

  update crm_executions e set
    total = i.total, done = i.sent, failed = i.failed, skipped = i.skipped,
    status = case i.status when 'draft' then 'queued' when 'running' then 'running' when 'paused' then 'paused'
                           when 'done' then 'done' else 'cancelled' end,
    error = i.pause_reason, started_at = i.started_at, finished_at = i.finished_at, updated_at = now()
  from crm_impulsos i
  where i.id = p_id and e.id = i.execution_id;

  return _status;
end $$;
revoke all on function public.crm_impulso_recontar(uuid) from public, anon, authenticated;
grant execute on function public.crm_impulso_recontar(uuid) to service_role;

-- Template oficial: o item acompanha o destinatário do disparo.
create or replace function public.crm_impulso_sync_official(p_id uuid)
returns void language sql volatile security definer set search_path = public as $$
  update crm_impulso_items x set
    status = case when r.status in ('sent', 'delivered', 'read') then 'sent'
                  when r.status in ('failed', 'error') then 'failed'
                  when r.status = 'skipped' then 'skipped' else x.status end,
    error = case when r.status in ('failed', 'error', 'skipped') then r.error_text end,
    message_id = r.message_id, conversation_id = r.conversation_id,
    sent_at = coalesce(r.sent_at, x.sent_at), done_at = now()
  from whatsapp_official_campaign_recipients r
  where x.impulso_id = p_id and x.status = 'sending' and r.id = x.recipient_id
    and r.status not in ('pending', 'processing');
$$;
revoke all on function public.crm_impulso_sync_official(uuid) from public, anon, authenticated;
grant execute on function public.crm_impulso_sync_official(uuid) to service_role;

-- ---------------------------------------------------------------- criar
create or replace function public.crm_impulso_criar(
  p_name text, p_action text, p_config jsonb, p_source jsonb,
  p_batch_size integer default 10, p_interval_seconds integer default 60,
  p_window jsonb default null, p_daily_cap integer default null, p_start boolean default true
) returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  st record;
  _id uuid; _exec uuid; _max integer; _n integer; _eleg integer;
  _cfg jsonb := coalesce(p_config, '{}'::jsonb);
  _ws time; _we time; _wd integer[];
  _label text; _nome text;
begin
  select s.id, s.name into st from onboarding_staff s where s.user_id = auth.uid() and s.is_active limit 1;
  if st.id is null or not public.is_crm_admin() then raise exception 'Só administrador do CRM cria impulso'; end if;
  if p_action not in ('whatsapp_text', 'official_template', 'move_stage', 'add_tag', 'assign_owner', 'cadence') then
    raise exception 'Ação inválida';
  end if;
  if p_source->>'type' = 'phones' and p_action not in ('whatsapp_text', 'official_template') then
    raise exception 'Lista de telefones só serve pra envio de mensagem';
  end if;

  -- configuração de cada ação
  if p_action = 'whatsapp_text' then
    if coalesce(btrim(_cfg->>'message'), '') = '' then raise exception 'Escreva a mensagem'; end if;
    if not exists (select 1 from whatsapp_instances w where w.id = nullif(_cfg->>'instance_id', '')::uuid) then
      raise exception 'Escolha o número que envia';
    end if;
  elsif p_action = 'official_template' then
    if not exists (select 1 from whatsapp_official_instances w where w.id = nullif(_cfg->>'official_instance_id', '')::uuid) then
      raise exception 'Escolha o número da API oficial';
    end if;
    if coalesce(_cfg->>'template_name', '') = '' then raise exception 'Escolha o template'; end if;
  elsif p_action = 'move_stage' then
    if not exists (select 1 from crm_stages s where s.id = nullif(_cfg->>'stage_id', '')::uuid) then raise exception 'Escolha a etapa'; end if;
  elsif p_action = 'add_tag' then
    if not exists (select 1 from crm_tags t where t.id = nullif(_cfg->>'tag_id', '')::uuid) then raise exception 'Escolha a etiqueta'; end if;
  elsif p_action = 'assign_owner' then
    if not exists (select 1 from onboarding_staff s where s.id = nullif(_cfg->>'owner_id', '')::uuid and s.is_active) then
      raise exception 'Escolha o responsável';
    end if;
  elsif p_action = 'cadence' then
    if not exists (select 1 from crm_cadences c join crm_cadence_steps cs on cs.cadence_id = c.id and cs.is_active
                    where c.id = nullif(_cfg->>'cadence_id', '')::uuid and c.is_active) then
      raise exception 'Escolha uma cadência ativa com pelo menos um passo';
    end if;
  end if;

  -- ritmo: texto sai um por um dentro da edge, por isso o lote é menor
  _max := case p_action when 'whatsapp_text' then 30 when 'official_template' then 100 else 500 end;
  if coalesce(p_batch_size, 0) < 1 or p_batch_size > _max then
    raise exception 'Itens por lote: de 1 a % pra essa ação', _max;
  end if;
  if coalesce(p_interval_seconds, 0) < 60 or p_interval_seconds > 86400 then
    raise exception 'Intervalo entre lotes: de 60 segundos a 24 horas';
  end if;

  if p_window is not null and coalesce(p_window->>'start', '') <> '' and coalesce(p_window->>'end', '') <> '' then
    _ws := (p_window->>'start')::time; _we := (p_window->>'end')::time;
    if _ws >= _we then raise exception 'A janela precisa terminar depois de começar'; end if;
    if jsonb_typeof(p_window->'weekdays') = 'array' then
      select array_agg(v::integer) into _wd from jsonb_array_elements_text(p_window->'weekdays') v;
    end if;
    if _wd is not null and array_length(_wd, 1) is null then raise exception 'Marque pelo menos um dia da semana'; end if;
  end if;

  _label := case p_source->>'type' when 'leads' then 'Seleção do kanban' when 'filter' then 'Filtro de funil'
                                   when 'tag' then 'Etiqueta' else 'Lista de telefones' end;
  _nome := coalesce(nullif(btrim(p_name), ''), 'Impulso');

  insert into crm_impulsos (name, action, config, source, source_label, status, batch_size, interval_seconds,
                            window_start, window_end, window_weekdays, daily_cap, created_by, created_by_name,
                            started_at, next_batch_at)
  values (_nome, p_action, _cfg, p_source->>'type', coalesce(nullif(p_source->>'label', ''), _label),
          case when p_start then 'running' else 'draft' end, p_batch_size, p_interval_seconds,
          _ws, _we, _wd, case when p_action in ('whatsapp_text', 'official_template') then p_daily_cap end, st.id, st.name,
          case when p_start then now() end, case when p_start then now() end)
  returning id into _id;

  insert into crm_impulso_items (impulso_id, lead_id, name, phone, company, status, error, done_at)
  select _id, a.lead_id, a.name, a.phone, a.company,
         case when a.skip_reason is null then 'pending' else 'skipped' end, a.skip_reason,
         case when a.skip_reason is null then null else now() end
    from public.crm_impulso_alvos(p_source, p_action) a
  on conflict do nothing;

  select count(*), count(*) filter (where status = 'pending') into _n, _eleg from crm_impulso_items where impulso_id = _id;
  if _eleg = 0 then raise exception 'Nenhum item elegível: todos os % foram pulados (sem telefone, opt-out ou repetidos)', _n; end if;

  insert into crm_executions (kind, title, status, total, skipped, ref_id, started_by, started_by_name, started_at, params)
  values ('impulso', _nome, case when p_start then 'running' else 'queued' end, _n, _n - _eleg, _id, st.id, st.name,
          case when p_start then now() end, jsonb_build_object('action', p_action, 'source', p_source->>'type'))
  returning id into _exec;

  update crm_impulsos set total = _n, skipped = _n - _eleg, execution_id = _exec where id = _id;
  return _id;
end $$;
revoke all on function public.crm_impulso_criar(text, text, jsonb, jsonb, integer, integer, jsonb, integer, boolean) from public, anon;
grant execute on function public.crm_impulso_criar(text, text, jsonb, jsonb, integer, integer, jsonb, integer, boolean) to authenticated;

-- ---------------------------------------------------------------- iniciar / pausar / retomar / cancelar
create or replace function public.crm_impulso_set_status(p_id uuid, p_status text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare _i record;
begin
  if public.get_current_staff_id() is null then raise exception 'Sem acesso ao CRM'; end if;
  select * into _i from crm_impulsos where id = p_id for update;
  if not found then raise exception 'Impulso não encontrado'; end if;
  if not (public.is_crm_admin() or _i.created_by = public.get_current_staff_id()) then raise exception 'Sem permissão nesse impulso'; end if;

  if p_status = 'running' then
    if _i.status in ('done', 'cancelled') then raise exception 'Impulso já encerrado'; end if;
    update crm_impulsos set status = 'running', started_at = coalesce(started_at, now()), next_batch_at = now(),
           pause_reason = null, updated_at = now() where id = p_id;
    -- o disparo oficial tinha sido pausado pela Meta (pagamento, spam): volta a valer a
    -- partir de agora (resumed_at zera a contagem de recusas do official-campaign-dispatch)
    if _i.campaign_id is not null then
      update whatsapp_official_campaigns set status = 'sending', notes = 'Impulso: ' || _i.name, resumed_at = now(), finished_at = null
       where id = _i.campaign_id and (status = 'paused' or (status = 'done' and notes like 'Encerrado com falhas%'));
    end if;
  elsif p_status = 'paused' then
    if _i.status <> 'running' then raise exception 'Só dá pra pausar um impulso rodando'; end if;
    update crm_impulsos set status = 'paused', pause_reason = 'Pausado manualmente', updated_at = now() where id = p_id;
  elsif p_status = 'cancelled' then
    if _i.status in ('done', 'cancelled') then raise exception 'Impulso já encerrado'; end if;
    -- quem ainda não saiu não sai mais. Item que já está enviando termina (não dá pra desfazer).
    if _i.campaign_id is not null then
      update whatsapp_official_campaign_recipients set status = 'skipped', error_text = 'Impulso cancelado antes do envio'
       where campaign_id = _i.campaign_id and status = 'pending';
      update whatsapp_official_campaigns set status = 'canceled', finished_at = now()
       where id = _i.campaign_id and status in ('sending', 'paused');
      perform public.crm_impulso_sync_official(p_id);
    end if;
    update crm_impulso_items set status = 'cancelled', error = 'Impulso cancelado', done_at = now()
     where impulso_id = p_id and status = 'pending';
    update crm_impulsos set status = 'cancelled', finished_at = now(), pause_reason = null, updated_at = now() where id = p_id;
  else
    raise exception 'Status inválido';
  end if;
  perform public.crm_impulso_recontar(p_id);
  return jsonb_build_object('ok', true, 'status', p_status);
end $$;
revoke all on function public.crm_impulso_set_status(uuid, text) from public, anon;
grant execute on function public.crm_impulso_set_status(uuid, text) to authenticated;

-- Cancelar pela Central de Execuções (qualquer tipo de execução).
create or replace function public.crm_execution_cancel(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare e record; _st uuid := public.get_current_staff_id();
begin
  if _st is null then raise exception 'Sem acesso ao CRM'; end if;
  select * into e from crm_executions where id = p_id for update;
  if not found then raise exception 'Execução não encontrada'; end if;
  if not (public.is_crm_admin() or e.started_by = _st) then raise exception 'Sem permissão pra cancelar essa execução'; end if;
  if e.status not in ('queued', 'running', 'paused') then raise exception 'Essa execução já terminou'; end if;
  if e.kind = 'impulso' and e.ref_id is not null then
    perform public.crm_impulso_set_status(e.ref_id, 'cancelled');
  else
    update crm_executions set status = 'cancelled', cancel_requested = true, finished_at = now(), updated_at = now() where id = p_id;
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.crm_execution_cancel(uuid) from public, anon;
grant execute on function public.crm_execution_cancel(uuid) to authenticated;

-- ---------------------------------------------------------------- o lote
-- Chamada pela edge crm-impulso-tick. Escolhe UM impulso com lote vencido, confere janela e
-- teto diário, reserva até batch_size itens (pending -> sending) e devolve o que fazer.
-- p_dry = true só mostra o que sairia, sem mudar nada. p_impulso força um impulso específico.
create or replace function public.crm_impulso_claim(p_impulso uuid default null, p_dry boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  i record; _camp record;
  _msg boolean; _sender uuid; _open timestamptz; _amanha timestamptz;
  _used integer := 0; _n integer; _lote integer; _ids uuid[]; _campaign uuid; _pendentes_camp integer := 0;
  _status text; _preso uuid;
begin
  -- item que ficou "enviando" num impulso que não roda mais (execução morreu no meio)
  if not p_dry then
    for _preso in
      update crm_impulso_items x set status = 'failed', done_at = now(),
             error = 'Envio interrompido no servidor. Não foi reenviado pra evitar mensagem em dobro.'
        from crm_impulsos p
       where p.id = x.impulso_id and x.status = 'sending' and x.recipient_id is null
         and x.claimed_at < now() - interval '15 minutes' and p.status in ('paused', 'cancelled', 'done')
      returning x.impulso_id
    loop
      perform public.crm_impulso_recontar(_preso);
    end loop;
  end if;

  if p_impulso is not null then
    select * into i from crm_impulsos
     where id = p_impulso and (status = 'running' or (p_dry and status in ('draft', 'paused')))
     for update skip locked;
  else
    select * into i from crm_impulsos
     where status = 'running' and next_batch_at <= now()
     order by next_batch_at limit 1 for update skip locked;
  end if;
  if not found then return jsonb_build_object('none', true); end if;

  _msg := i.action in ('whatsapp_text', 'official_template');
  _sender := case i.action when 'whatsapp_text' then nullif(i.config->>'instance_id', '')::uuid
                           when 'official_template' then nullif(i.config->>'official_instance_id', '')::uuid end;

  if not p_dry then
    -- item reservado por uma execução que morreu
    if i.action = 'whatsapp_text' then
      update crm_impulso_items set status = 'failed', done_at = now(),
             error = 'Envio interrompido no servidor. Não foi reenviado pra evitar mensagem em dobro.'
       where impulso_id = i.id and status = 'sending' and claimed_at < now() - interval '10 minutes';
    elsif i.action = 'official_template' then
      perform public.crm_impulso_sync_official(i.id);
    else
      update crm_impulso_items set status = 'pending', claimed_at = null, batch_no = null
       where impulso_id = i.id and status = 'sending' and claimed_at < now() - interval '10 minutes';
    end if;

    -- lote anterior de texto ainda saindo: espera, pra não atropelar o ritmo
    if i.action = 'whatsapp_text' and exists (select 1 from crm_impulso_items where impulso_id = i.id and status = 'sending') then
      update crm_impulsos set next_batch_at = now() + interval '30 seconds', updated_at = now() where id = i.id;
      return jsonb_build_object('impulso_id', i.id, 'info', 'lote anterior ainda enviando');
    end if;

    -- a Meta pausou o disparo (pagamento ou spam): o impulso pausa junto, com o motivo
    if i.campaign_id is not null then
      select c.status, c.notes into _camp from whatsapp_official_campaigns c where c.id = i.campaign_id;
      -- "Encerrado com falhas" = o dispatch quis pausar mas o lote já tinha acabado: mesmo caso
      if _camp.status = 'paused' or (_camp.status = 'done' and _camp.notes like 'Encerrado com falhas%') then
        perform public.crm_impulso_sync_official(i.id);
        update crm_impulsos set status = 'paused', pause_reason = coalesce(_camp.notes, 'O disparo foi pausado'), updated_at = now() where id = i.id;
        perform public.crm_impulso_recontar(i.id);
        return jsonb_build_object('impulso_id', i.id, 'info', 'pausado: ' || coalesce(_camp.notes, 'disparo pausado'));
      elsif _camp.status = 'canceled' then
        -- alguém cancelou o disparo pela tela de Disparos: o impulso encerra junto
        perform public.crm_impulso_sync_official(i.id);
        update crm_impulso_items set status = 'cancelled', error = 'Disparo cancelado', done_at = now()
         where impulso_id = i.id and status in ('pending', 'sending');
        update crm_impulsos set status = 'cancelled', finished_at = now(), pause_reason = null, updated_at = now() where id = i.id;
        perform public.crm_impulso_recontar(i.id);
        return jsonb_build_object('impulso_id', i.id, 'info', 'cancelado junto com o disparo');
      end if;
    end if;
  end if;

  -- janela de horário
  _open := public.crm_impulso_window_next(i.window_start, i.window_end, i.window_weekdays, now());
  if _open > now() then
    if not p_dry then update crm_impulsos set next_batch_at = _open, updated_at = now() where id = i.id; end if;
    return jsonb_build_object('impulso_id', i.id, 'info', 'fora da janela', 'proximo', _open);
  end if;

  -- teto diário do número
  _n := i.batch_size;
  if _msg and i.daily_cap is not null and _sender is not null then
    _used := public.crm_impulso_enviados_hoje(i.action, _sender);
    if _used >= i.daily_cap then
      _amanha := (date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '1 day') at time zone 'America/Sao_Paulo';
      _open := public.crm_impulso_window_next(i.window_start, i.window_end, i.window_weekdays, _amanha);
      if not p_dry then update crm_impulsos set next_batch_at = _open, updated_at = now() where id = i.id; end if;
      return jsonb_build_object('impulso_id', i.id, 'info', 'teto diário do número atingido', 'usados', _used, 'proximo', _open);
    end if;
    _n := least(_n, i.daily_cap - _used);
  end if;

  select array_agg(s.id) into _ids
    from (select x.id from crm_impulso_items x where x.impulso_id = i.id and x.status = 'pending'
           order by x.created_at, x.id limit _n for update skip locked) s;

  if p_dry then
    return jsonb_build_object('impulso', to_jsonb(i), 'dry_run', true, 'usados_hoje', _used,
      'items', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at, x.id) from crm_impulso_items x where x.id = any(_ids)), '[]'::jsonb));
  end if;

  if _ids is null then
    -- nada na fila: fecha, ou espera o retorno dos que ainda estão saindo (template oficial)
    if i.campaign_id is not null then
      select count(*) into _pendentes_camp from whatsapp_official_campaign_recipients where campaign_id = i.campaign_id and status = 'pending';
    end if;
    update crm_impulsos set next_batch_at = now() + interval '1 minute', updated_at = now() where id = i.id;
    _status := public.crm_impulso_recontar(i.id);
    return jsonb_build_object('impulso_id', i.id, 'info', case when _status = 'done' then 'concluído' else 'aguardando retorno dos envios' end,
      'status', _status, 'campaign_id', i.campaign_id, 'dispatch', _pendentes_camp > 0 and _status <> 'done');
  end if;

  -- opt-out de última hora (a etiqueta pode ter entrado depois de o impulso ser criado)
  if _msg then
    update crm_impulso_items x set status = 'skipped', error = 'Pediu pra não receber (Opt-out)', done_at = now()
     where x.id = any(_ids) and x.lead_id is not null
       and exists (select 1 from crm_lead_tags lt join crm_tags t on t.id = lt.tag_id where lt.lead_id = x.lead_id and t.name ilike 'opt-out');
  end if;

  _lote := i.batches + 1;
  update crm_impulso_items set status = 'sending', claimed_at = now(), batch_no = _lote, sender_id = _sender
   where id = any(_ids) and status = 'pending';

  -- template oficial: o lote entra como destinatário do disparo e a edge official-campaign-dispatch envia
  _campaign := i.campaign_id;
  if i.action = 'official_template' then
    if _campaign is null then
      insert into whatsapp_official_campaigns (official_instance_id, template_name, template_language, template_category,
        body_preview, template_body, variables, created_by_staff_id, created_by_name, source, move_mode, move_stage_id,
        tag_name, extra_tag_ids, total, status, notes)
      values (_sender, i.config->>'template_name', coalesce(nullif(i.config->>'template_language', ''), 'pt_BR'),
        nullif(i.config->>'template_category', ''), i.config->>'body_preview', i.config->>'template_body',
        -- created_by_staff_id fica nulo de propósito: o aviso flutuante de disparo (OfficialDispatchProgress)
        -- filtra por ele, e um disparo de impulso abre e fecha a cada lote (viraria um aviso por minuto).
        -- O andamento do impulso fica na aba Impulsos. created_by_name segue valendo pro {sdr}.
        coalesce(i.config->'variables', '[]'::jsonb), null, i.created_by_name, 'impulso',
        coalesce(nullif(i.config->>'move_mode', ''), 'none'), null, 'Template enviado',
        coalesce((select array_agg(v::uuid) from jsonb_array_elements_text(coalesce(i.config->'extra_tag_ids', '[]'::jsonb)) v), '{}'::uuid[]),
        i.total, 'sending', 'Impulso: ' || i.name)
      returning id into _campaign;
    else
      update whatsapp_official_campaigns set status = 'sending', finished_at = null
       where id = _campaign and status in ('done', 'sending');
    end if;
    with ins as (
      insert into whatsapp_official_campaign_recipients (campaign_id, lead_id, lead_name, phone, status)
      select _campaign, x.lead_id, x.name, x.phone, 'pending'
        from crm_impulso_items x where x.id = any(_ids) and x.status = 'sending'
      returning id, phone
    )
    update crm_impulso_items x set recipient_id = ins.id from ins where x.id = any(_ids) and x.phone = ins.phone;
  end if;

  update crm_impulsos set batches = _lote, last_batch_at = now(),
         next_batch_at = now() + make_interval(secs => interval_seconds), campaign_id = _campaign, updated_at = now()
   where id = i.id;
  perform public.crm_impulso_recontar(i.id);

  return jsonb_build_object(
    'impulso', to_jsonb(i) || jsonb_build_object('campaign_id', _campaign, 'batches', _lote),
    'campaign_id', _campaign, 'dispatch', i.action = 'official_template', 'usados_hoje', _used,
    'items', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at, x.id) from crm_impulso_items x where x.id = any(_ids) and x.status = 'sending'), '[]'::jsonb));
end $$;
revoke all on function public.crm_impulso_claim(uuid, boolean) from public, anon, authenticated;
grant execute on function public.crm_impulso_claim(uuid, boolean) to service_role;

-- Ações que são só banco (mover etapa, etiqueta, responsável, cadência): aplica nos itens
-- reservados do impulso. Um erro num lead (trava de etapa, valor obrigatório) fica no item.
create or replace function public.crm_impulso_apply_db(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  i record; it record; _stage record; _cur record; _enr record; _step record;
  _res text; _motivo text; _ok integer := 0; _pulados integer := 0; _falhas integer := 0; _n integer;
begin
  select * into i from crm_impulsos where id = p_id;
  if not found then raise exception 'Impulso não encontrado'; end if;
  if i.action not in ('move_stage', 'add_tag', 'assign_owner', 'cadence') then raise exception 'Ação não é de banco'; end if;
  if i.action = 'move_stage' then
    select s.id, s.pipeline_id into _stage from crm_stages s where s.id = (i.config->>'stage_id')::uuid;
  elsif i.action = 'cadence' then
    select cs.delay_value, cs.delay_unit into _step from crm_cadence_steps cs
     where cs.cadence_id = (i.config->>'cadence_id')::uuid and cs.is_active order by cs.sort_order limit 1;
  end if;

  for it in select * from crm_impulso_items where impulso_id = p_id and status = 'sending' order by created_at, id loop
    _res := 'sent'; _motivo := null;
    begin
      select l.id, l.stage_id, l.pipeline_id, l.owner_staff_id, l.tenant_id into _cur from crm_leads l where l.id = it.lead_id;
      if _cur.id is null then
        _res := 'skipped'; _motivo := 'Lead não existe mais';
      elsif i.action = 'move_stage' then
        if _stage.id is null then
          _res := 'failed'; _motivo := 'A etapa de destino foi excluída';
        elsif _cur.stage_id = _stage.id then
          _res := 'skipped'; _motivo := 'Já estava na etapa';
        else
          update crm_leads set stage_id = _stage.id, pipeline_id = _stage.pipeline_id where id = _cur.id;
        end if;
      elsif i.action = 'add_tag' then
        insert into crm_lead_tags (lead_id, tag_id) values (_cur.id, (i.config->>'tag_id')::uuid)
        on conflict (lead_id, tag_id) do nothing;
        get diagnostics _n = row_count;
        if _n = 0 then _res := 'skipped'; _motivo := 'Já tinha a etiqueta'; end if;
      elsif i.action = 'assign_owner' then
        if _cur.owner_staff_id = (i.config->>'owner_id')::uuid then
          _res := 'skipped'; _motivo := 'Já era o responsável';
        else
          update crm_leads set owner_staff_id = (i.config->>'owner_id')::uuid where id = _cur.id;
        end if;
      elsif i.action = 'cadence' then
        select e.id, e.status into _enr from crm_cadence_enrollments e
         where e.cadence_id = (i.config->>'cadence_id')::uuid and e.lead_id = _cur.id limit 1;
        if _step.delay_unit is null then
          _res := 'failed'; _motivo := 'A cadência não tem passo ativo';
        elsif _enr.id is null then
          insert into crm_cadence_enrollments (cadence_id, lead_id, current_step_index, status, next_run_at, enrolled_at, tenant_id)
          values ((i.config->>'cadence_id')::uuid, _cur.id, 0, 'active',
                  public.crm_cadence_calc_next_run(now(), _step.delay_value, _step.delay_unit), now(), _cur.tenant_id);
        elsif _enr.status in ('active', 'paused') then
          _res := 'skipped'; _motivo := 'Já estava na cadência';
        else
          update crm_cadence_enrollments set status = 'active', current_step_index = 0,
                 next_run_at = public.crm_cadence_calc_next_run(now(), _step.delay_value, _step.delay_unit),
                 enrolled_at = now(), completed_at = null, stopped_reason = null, last_message_sent_at = null, updated_at = now()
           where id = _enr.id;
        end if;
      end if;
    exception when others then
      _res := 'failed'; _motivo := left(sqlerrm, 300);
    end;
    update crm_impulso_items set status = _res, error = _motivo, done_at = now(),
           sent_at = case when _res = 'sent' then now() end
     where id = it.id;
    if _res = 'sent' then _ok := _ok + 1; elsif _res = 'skipped' then _pulados := _pulados + 1; else _falhas := _falhas + 1; end if;
  end loop;
  return jsonb_build_object('ok', _ok, 'pulados', _pulados, 'falhas', _falhas);
end $$;
revoke all on function public.crm_impulso_apply_db(uuid) from public, anon, authenticated;
grant execute on function public.crm_impulso_apply_db(uuid) to service_role;

-- ---------------------------------------------------------------- telas
create or replace function public.crm_impulsos_painel()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'name', i.name, 'action', i.action, 'config', i.config, 'source', i.source, 'source_label', i.source_label,
      'status', i.status, 'batch_size', i.batch_size, 'interval_seconds', i.interval_seconds,
      'window_start', i.window_start, 'window_end', i.window_end, 'window_weekdays', i.window_weekdays, 'daily_cap', i.daily_cap,
      'total', i.total, 'sent', i.sent, 'failed', i.failed, 'skipped', i.skipped, 'batches', i.batches,
      'pending', c.pending, 'sending', c.sending, 'delivered', c.delivered, 'read', c.lidos,
      'next_batch_at', i.next_batch_at, 'last_batch_at', i.last_batch_at, 'started_at', i.started_at, 'finished_at', i.finished_at,
      'pause_reason', i.pause_reason, 'campaign_id', i.campaign_id, 'execution_id', i.execution_id,
      'created_at', i.created_at, 'created_by_name', i.created_by_name
    ) order by i.created_at desc), '[]'::jsonb)
  from (select * from crm_impulsos x
         where public.get_current_staff_id() is not null and not public.current_user_is_tenant()
           and (public.is_crm_admin() or x.created_by = public.get_current_staff_id())
         order by x.created_at desc limit 60) i
  left join lateral (
    select count(*) filter (where q.st = 'pending') as pending, count(*) filter (where q.st = 'sending') as sending,
           count(*) filter (where q.st in ('delivered', 'read')) as delivered, count(*) filter (where q.st = 'read') as lidos
      from (select public.crm_impulso_item_status(x.status, m.status, r.status) as st
              from crm_impulso_items x
              left join crm_whatsapp_messages m on m.id = x.message_id
              left join whatsapp_official_campaign_recipients r on r.id = x.recipient_id
             where x.impulso_id = i.id and x.status in ('pending', 'sending', 'sent')) q
  ) c on true
$$;
revoke all on function public.crm_impulsos_painel() from public, anon;
grant execute on function public.crm_impulsos_painel() to authenticated;

-- Itens de um impulso, paginados no servidor. p_status usa o status da tela
-- (pending, sending, sent, delivered, read, failed, skipped, cancelled).
create or replace function public.crm_impulso_itens(
  p_id uuid, p_status text default null, p_search text default null, p_limit integer default 100, p_offset integer default 0
) returns jsonb language sql stable security definer set search_path = public as $$
  with ok as (
    select 1 from crm_impulsos i
     where i.id = p_id and public.get_current_staff_id() is not null and not public.current_user_is_tenant()
       and (public.is_crm_admin() or i.created_by = public.get_current_staff_id())
  ), base as (
    select x.id, x.lead_id, coalesce(x.name, l.name) as name, x.phone, x.company, x.batch_no, x.error, x.conversation_id,
           x.sent_at, x.done_at, x.claimed_at, x.created_at,
           public.crm_impulso_item_status(x.status, m.status, r.status) as st,
           case when x.status = 'sent' and public.crm_impulso_item_status(x.status, m.status, r.status) = 'failed'
                then coalesce(r.error_text, m.error_text, 'O WhatsApp não entregou') else x.error end as motivo
      from crm_impulso_items x
      left join crm_leads l on l.id = x.lead_id
      left join crm_whatsapp_messages m on m.id = x.message_id
      left join whatsapp_official_campaign_recipients r on r.id = x.recipient_id
     where x.impulso_id = p_id and exists (select 1 from ok)
  ), filtrado as (
    select * from base b
     where (p_status is null or b.st = p_status)
       and (coalesce(p_search, '') = '' or b.name ilike '%' || p_search || '%' or b.phone ilike '%' || regexp_replace(p_search, '\D', '', 'g') || '%' and regexp_replace(p_search, '\D', '', 'g') <> '')
  )
  select jsonb_build_object(
    'total', (select count(*) from filtrado),
    'resumo', coalesce((select jsonb_object_agg(s.st, s.n) from (select st, count(*) as n from base group by st) s), '{}'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', f.id, 'lead_id', f.lead_id, 'name', f.name, 'phone', f.phone, 'company', f.company, 'status', f.st,
        'batch_no', f.batch_no, 'error', f.motivo, 'conversation_id', f.conversation_id,
        'at', coalesce(f.done_at, f.sent_at, f.claimed_at)) order by f.batch_no nulls last, f.created_at, f.id)
      from (select * from filtrado order by batch_no nulls last, created_at, id
            limit greatest(1, least(coalesce(p_limit, 100), 5000)) offset greatest(0, coalesce(p_offset, 0))) f), '[]'::jsonb)
  )
$$;
revoke all on function public.crm_impulso_itens(uuid, text, text, integer, integer) from public, anon;
grant execute on function public.crm_impulso_itens(uuid, text, text, integer, integer) to authenticated, service_role;
