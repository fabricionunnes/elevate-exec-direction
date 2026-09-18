-- 18/09/2026 — Sistema de notificações do app (staff e cliente). Pedido do Fabrício.
-- Base: onboarding_notifications (já existia: staff_id = onboarding_staff.id, user_id = onboarding_users.id).
-- Novo: catálogo de tipos, preferências por pessoa (no app / push), assinaturas de push e função central app_notify.
alter table public.onboarding_notifications
  add column if not exists action_url text,
  add column if not exists category text,
  add column if not exists priority text not null default 'normal',
  add column if not exists push_status text;
create index if not exists onboarding_notifications_user_unread on public.onboarding_notifications (user_id, is_read, created_at desc) where user_id is not null;
create index if not exists onboarding_notifications_ref on public.onboarding_notifications (type, reference_id);

create table if not exists public.notification_types (
  key text primary key,
  audience text not null check (audience in ('staff','client','both')),
  category text not null,
  label text not null,
  description text,
  default_inapp boolean not null default true,
  default_push boolean not null default true,
  mandatory boolean not null default false,   -- não dá pra desligar no app
  sort int not null default 100
);
create table if not exists public.notification_preferences (
  auth_user_id uuid not null,
  type_key text not null references public.notification_types(key) on delete cascade,
  inapp boolean not null default true,
  push boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (auth_user_id, type_key)
);
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  failed_count int not null default 0
);
create index if not exists push_subscriptions_user on public.push_subscriptions (auth_user_id);

alter table public.notification_types enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
revoke all on public.notification_types, public.notification_preferences, public.push_subscriptions from anon;
grant select on public.notification_types to authenticated;
grant select, insert, update, delete on public.notification_preferences, public.push_subscriptions to authenticated;
grant all on public.notification_types, public.notification_preferences, public.push_subscriptions to service_role;
drop policy if exists notification_types_read on public.notification_types;
create policy notification_types_read on public.notification_types for select to authenticated using (true);
drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own on public.notification_preferences for all to authenticated using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

insert into public.notification_types (key, audience, category, label, description, default_push, mandatory, sort) values
 -- equipe (tipos que já existiam)
 ('task_assigned','staff','Tarefas','Tarefa atribuída a você',null,true,false,10),
 ('new_lead','staff','Comercial','Lead novo pra você',null,true,false,20),
 ('crm_activity_due','staff','Comercial','Atividade do CRM vencendo',null,true,false,21),
 ('lead_request','staff','Comercial','Pedido de lead por um colega',null,true,false,22),
 ('pending_meeting','staff','Reuniões','Reunião pendente de finalizar',null,false,false,30),
 ('meeting_scheduled','staff','Reuniões','Reunião agendada',null,true,false,31),
 ('contract','staff','Contratos','Contrato assinado ou dados contratuais enviados',null,true,false,40),
 ('kickoff_form','staff','Clientes','Cliente enviou o kickoff',null,true,false,41),
 ('nps_alert','staff','Clientes','Alerta de NPS baixo',null,true,false,42),
 ('company_no_consultant','staff','Clientes','Empresa sem consultor',null,false,false,43),
 ('payment_confirmed','staff','Financeiro','Pagamento confirmado',null,false,false,50),
 ('last_installment_paid','staff','Financeiro','Última parcela paga',null,false,false,51),
 ('new_candidate','both','RH','Novo candidato na vaga',null,false,false,60),
 ('job_opening','staff','RH','Vaga aberta',null,false,false,61),
 ('job_closed','staff','RH','Vaga encerrada',null,false,false,62),
 ('support_room','staff','Suporte','Chamado na sala de suporte',null,true,false,70),
 ('referral','staff','Comercial','Indicação recebida',null,true,false,23),
 -- cliente
 ('client_meeting_scheduled','client','Reuniões','Reunião agendada ou remarcada','Quando a UNV marca ou muda uma reunião do seu projeto.',true,false,110),
 ('client_meeting_reminder','client','Reuniões','Lembrete 1 hora antes da reunião',null,true,false,111),
 ('client_meeting_notes','client','Reuniões','Ata e gravação da reunião disponíveis',null,false,false,112),
 ('client_task_assigned','client','Tarefas','Tarefa pra você',null,true,false,120),
 ('client_task_due','client','Tarefas','Tarefa vencendo amanhã',null,true,false,121),
 ('client_invoice_created','client','Financeiro','Fatura gerada',null,false,false,130),
 ('client_invoice_due','client','Financeiro','Fatura vencendo','3 dias antes e no dia do vencimento.',true,false,131),
 ('client_invoice_overdue','client','Financeiro','Fatura vencida',null,true,true,132),
 ('client_invoice_paid','client','Financeiro','Pagamento confirmado',null,false,false,133),
 ('client_kpi_reminder','client','Resultados','Lembrete de lançar as vendas do dia','Às 18h, só se você ainda não lançou.',true,false,140),
 ('client_goal_hit','client','Resultados','Meta do mês batida',null,true,false,141),
 ('client_report_ready','client','Resultados','Relatório do projeto pronto',null,false,false,142),
 ('client_academy_new','client','Conteúdo','Aulas novas no Academy',null,false,false,150),
 ('client_survey_pending','client','Conteúdo','Pesquisa NPS/CSAT pra responder',null,false,false,151),
 ('announcement','both','Comunicados','Comunicado da UNV',null,true,true,5)
on conflict (key) do update set audience=excluded.audience, category=excluded.category, label=excluded.label, description=excluded.description, sort=excluded.sort;

-- quer receber? (mandatory ignora preferência; sem linha = padrão do tipo; tipo fora do catálogo = recebe)
create or replace function public.notification_wants(p_auth uuid, p_type text, p_channel text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when t.key is null then true
    when t.mandatory then true
    when p_channel = 'push' then coalesce(p.push, t.default_push)
    else coalesce(p.inapp, t.default_inapp) end
  from (select 1) x
  left join notification_types t on t.key = p_type
  left join notification_preferences p on p.type_key = p_type and p.auth_user_id = p_auth;
$$;

-- ponto único pra criar notificação (respeita a preferência "no app"). Um dos dois: p_staff ou p_user.
create or replace function public.app_notify(p_staff uuid, p_user uuid, p_type text, p_title text, p_message text,
  p_project uuid default null, p_ref_id uuid default null, p_ref_type text default null, p_action_url text default null, p_priority text default 'normal')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_auth uuid; v_id uuid; v_cat text;
begin
  if p_staff is not null then select user_id into v_auth from onboarding_staff where id = p_staff and is_active;
  elsif p_user is not null then select user_id into v_auth from onboarding_users where id = p_user;
  else return null; end if;
  if v_auth is null then return null; end if;                 -- sem login = não tem onde ver
  if not notification_wants(v_auth, p_type, 'inapp') then return null; end if;
  select category into v_cat from notification_types where key = p_type;
  insert into onboarding_notifications (staff_id, user_id, project_id, type, title, message, reference_id, reference_type, action_url, category, priority)
  values (p_staff, p_user, p_project, p_type, left(p_title, 200), left(p_message, 1000), p_ref_id, p_ref_type, p_action_url, v_cat, coalesce(p_priority,'normal'))
  returning id into v_id;
  return v_id;
end $$;

-- avisa todos os usuários do CLIENTE num projeto (p_roles nulo = todos os papéis de cliente com login)
create or replace function public.app_notify_project_clients(p_project uuid, p_type text, p_title text, p_message text,
  p_ref_id uuid default null, p_ref_type text default null, p_action_url text default null, p_roles text[] default null, p_once boolean default false)
returns int language plpgsql security definer set search_path = public as $$
declare u record; n int := 0;
begin
  for u in select id from onboarding_users where project_id = p_project and user_id is not null
           and role::text <> 'consultant' and (p_roles is null or role::text = any(p_roles)) loop
    if p_once and p_ref_id is not null and exists (select 1 from onboarding_notifications where user_id = u.id and type = p_type and reference_id = p_ref_id) then continue; end if;
    if app_notify(null, u.id, p_type, p_title, p_message, p_project, p_ref_id, p_ref_type, p_action_url) is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function public.app_notify(uuid,uuid,text,text,text,uuid,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.app_notify_project_clients(uuid,text,text,text,uuid,text,text,text[],boolean) from public, anon, authenticated;
grant execute on function public.app_notify(uuid,uuid,text,text,text,uuid,uuid,text,text,text) to service_role;
grant execute on function public.app_notify_project_clients(uuid,text,text,text,uuid,text,text,text[],boolean) to service_role;

-- push: toda notificação nova dispara a função de envio, só se a pessoa tiver aparelho cadastrado e quiser push daquele tipo
create or replace function public.trg_notification_push() returns trigger language plpgsql security definer set search_path = public as $$
declare v_auth uuid;
begin
  begin
    if NEW.staff_id is not null then select user_id into v_auth from onboarding_staff where id = NEW.staff_id;
    elsif NEW.user_id is not null then select user_id into v_auth from onboarding_users where id = NEW.user_id; end if;
    if v_auth is not null and exists (select 1 from push_subscriptions where auth_user_id = v_auth) and notification_wants(v_auth, NEW.type, 'push') then
      perform net.http_post(url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/push-send',
        headers := jsonb_build_object('Content-Type','application/json'), body := jsonb_build_object('notification_id', NEW.id), timeout_milliseconds := 20000);
    end if;
  exception when others then raise warning 'push trigger falhou: %', sqlerrm;
  end;
  return NEW;
end $$;
drop trigger if exists zz_notification_push on public.onboarding_notifications;
create trigger zz_notification_push after insert on public.onboarding_notifications for each row execute function public.trg_notification_push();
