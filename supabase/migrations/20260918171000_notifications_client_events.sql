-- 18/09/2026 — Eventos que geram notificação pro CLIENTE (e comunicados). Tudo passa por app_notify,
-- que respeita a preferência de cada pessoa. Nenhum gatilho pode derrubar a operação original.
delete from public.notification_types where key in ('client_meeting_notes','client_goal_hit','client_report_ready','client_survey_pending');

create or replace function public.notif_brl(p_cents bigint) returns text language sql immutable as $$
  select 'R$ ' || replace(replace(replace(to_char(coalesce(p_cents,0) / 100.0, 'FM999G999G990D00'), ',', '#'), '.', ','), '#', '.');
$$;
create or replace function public.notif_quando(p timestamptz) returns text language sql stable as $$
  select to_char(p at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI');
$$;

-- 1) Reuniões do projeto: agendada e remarcada
create or replace function public.trg_notif_client_meeting() returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if coalesce(NEW.is_internal, false) or NEW.project_id is null or NEW.meeting_date is null or NEW.meeting_date < now() then return NEW; end if;
    if tg_op = 'INSERT' then
      perform app_notify_project_clients(NEW.project_id, 'client_meeting_scheduled', 'Reunião agendada',
        coalesce(NEW.meeting_title, 'Reunião') || ' em ' || notif_quando(NEW.meeting_date) || coalesce('. Link: ' || nullif(NEW.meeting_link,''), ''),
        NEW.id, 'meeting', '/#/onboarding-client/' || NEW.project_id);
    elsif abs(extract(epoch from (NEW.meeting_date - OLD.meeting_date))) > 300 then
      perform app_notify_project_clients(NEW.project_id, 'client_meeting_scheduled', 'Reunião remarcada',
        coalesce(NEW.meeting_title, 'Reunião') || ' passou para ' || notif_quando(NEW.meeting_date) || '.',
        NEW.id, 'meeting', '/#/onboarding-client/' || NEW.project_id);
    end if;
  exception when others then raise warning 'notif reunião falhou: %', sqlerrm;
  end;
  return NEW;
end $$;
drop trigger if exists zz_notif_client_meeting on public.onboarding_meeting_notes;
create trigger zz_notif_client_meeting after insert or update of meeting_date on public.onboarding_meeting_notes for each row execute function public.trg_notif_client_meeting();

-- 2) Tarefa atribuída a um usuário do cliente
create or replace function public.trg_notif_client_task() returns trigger language plpgsql security definer set search_path = public as $$
declare u record;
begin
  begin
    if NEW.assignee_id is null or coalesce(NEW.is_internal, false) or NEW.completed_at is not null then return NEW; end if;
    if tg_op = 'UPDATE' and NEW.assignee_id is not distinct from OLD.assignee_id then return NEW; end if;
    select id, project_id into u from onboarding_users where id = NEW.assignee_id and user_id is not null;
    if u.id is null then return NEW; end if;
    perform app_notify(null, u.id, 'client_task_assigned', 'Tarefa pra você',
      NEW.title || coalesce(' (prazo ' || to_char(NEW.due_date, 'DD/MM') || ')', ''), NEW.project_id, NEW.id, 'task', '/#/onboarding-client/' || NEW.project_id);
  exception when others then raise warning 'notif tarefa falhou: %', sqlerrm;
  end;
  return NEW;
end $$;
drop trigger if exists zz_notif_client_task on public.onboarding_tasks;
create trigger zz_notif_client_task after insert or update of assignee_id on public.onboarding_tasks for each row execute function public.trg_notif_client_task();

-- 3) Faturas: gerada e paga (só dono/admin do cliente). Vencendo/vencida vão pelo cron.
create or replace function public.notif_invoice_clients(p_invoice uuid, p_type text, p_title text, p_msg text, p_ref_type text) returns int
language plpgsql security definer set search_path = public as $$
declare iv record; pj record; u record; n int := 0;
begin
  select * into iv from company_invoices where id = p_invoice;
  if not found then return 0; end if;
  for pj in select id from onboarding_projects where onboarding_company_id = iv.company_id and status in ('active','notice_period','cancellation_signaled') loop
    for u in select id from onboarding_users where project_id = pj.id and user_id is not null and role::text in ('client','admin') loop
      if exists (select 1 from onboarding_notifications where user_id = u.id and type = p_type and reference_id = iv.id and coalesce(reference_type,'') = p_ref_type) then continue; end if;
      if app_notify(null, u.id, p_type, p_title, p_msg, pj.id, iv.id, p_ref_type, coalesce(nullif(iv.payment_link_url,''), '/#/onboarding-client/' || pj.id)) is not null then n := n + 1; end if;
    end loop;
  end loop;
  return n;
end $$;
create or replace function public.trg_notif_client_invoice() returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if tg_op = 'INSERT' and NEW.status = 'pending' and NEW.due_date >= current_date then
      perform notif_invoice_clients(NEW.id, 'client_invoice_created', 'Fatura gerada',
        coalesce(NEW.description, 'Fatura') || ' de ' || notif_brl(NEW.amount_cents) || ', vence em ' || to_char(NEW.due_date, 'DD/MM') || '.', 'invoice_created');
    elsif tg_op = 'UPDATE' and NEW.status = 'paid' and OLD.status is distinct from 'paid' then
      perform notif_invoice_clients(NEW.id, 'client_invoice_paid', 'Pagamento confirmado',
        'Recebemos o pagamento de ' || coalesce(NEW.description, 'sua fatura') || ' (' || notif_brl(coalesce(NEW.paid_amount_cents, NEW.amount_cents)) || '). Obrigado.', 'invoice_paid');
    end if;
  exception when others then raise warning 'notif fatura falhou: %', sqlerrm;
  end;
  return NEW;
end $$;
drop trigger if exists zz_notif_client_invoice on public.company_invoices;
create trigger zz_notif_client_invoice after insert or update of status on public.company_invoices for each row execute function public.trg_notif_client_invoice();

-- 4) Rotinas por horário (um único ponto de entrada pro cron)
create or replace function public.notif_run_scheduled(p_kind text) returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if p_kind = 'meeting_reminder' then
    for r in select id, project_id, meeting_title, meeting_date, meeting_link from onboarding_meeting_notes
      where not coalesce(is_internal,false) and not coalesce(is_finalized,false) and project_id is not null
        and meeting_date between now() + interval '45 minutes' and now() + interval '70 minutes' loop
      n := n + app_notify_project_clients(r.project_id, 'client_meeting_reminder', 'Reunião em 1 hora',
        coalesce(r.meeting_title,'Reunião') || ' às ' || to_char(r.meeting_date at time zone 'America/Sao_Paulo','HH24:MI') || coalesce('. Link: ' || nullif(r.meeting_link,''), ''),
        r.id, 'meeting_reminder', '/#/onboarding-client/' || r.project_id, null, true);
    end loop;
  elsif p_kind = 'invoices' then
    for r in select id, description, amount_cents, due_date from company_invoices where status in ('pending','overdue') and due_date in (v_hoje + 3, v_hoje, v_hoje - 1) loop
      if r.due_date = v_hoje + 3 then
        n := n + notif_invoice_clients(r.id, 'client_invoice_due', 'Fatura vence em 3 dias', coalesce(r.description,'Fatura') || ' de ' || notif_brl(r.amount_cents) || ' vence em ' || to_char(r.due_date,'DD/MM') || '.', 'invoice_d3');
      elsif r.due_date = v_hoje then
        n := n + notif_invoice_clients(r.id, 'client_invoice_due', 'Fatura vence hoje', coalesce(r.description,'Fatura') || ' de ' || notif_brl(r.amount_cents) || ' vence hoje.', 'invoice_d0');
      else
        n := n + notif_invoice_clients(r.id, 'client_invoice_overdue', 'Fatura vencida', coalesce(r.description,'Fatura') || ' de ' || notif_brl(r.amount_cents) || ' venceu ontem. Se já pagou, desconsidere.', 'invoice_overdue');
      end if;
    end loop;
  elsif p_kind = 'task_due' then
    for r in select t.id, t.title, t.project_id, u.id uid from onboarding_tasks t join onboarding_users u on u.id = t.assignee_id and u.user_id is not null
      where t.completed_at is null and not coalesce(t.is_internal,false) and t.due_date = v_hoje + 1 loop
      if not exists (select 1 from onboarding_notifications where user_id = r.uid and type = 'client_task_due' and reference_id = r.id) then
        if app_notify(null, r.uid, 'client_task_due', 'Tarefa vence amanhã', r.title, r.project_id, r.id, 'task', '/#/onboarding-client/' || r.project_id) is not null then n := n + 1; end if;
      end if;
    end loop;
  elsif p_kind = 'kpi_reminder' then
    for r in select u.id uid, u.project_id from onboarding_users u join onboarding_projects p on p.id = u.project_id and p.status = 'active'
      where u.user_id is not null and u.salesperson_id is not null
        and not exists (select 1 from kpi_entries e where e.salesperson_id = u.salesperson_id and e.entry_date = v_hoje)
        and not exists (select 1 from onboarding_notifications x where x.user_id = u.id and x.type = 'client_kpi_reminder' and x.created_at::date = current_date) loop
      if app_notify(null, r.uid, 'client_kpi_reminder', 'Lance suas vendas de hoje', 'Você ainda não registrou os números de hoje. Leva menos de um minuto.', r.project_id, null, 'kpi', '/#/onboarding-client/' || r.project_id) is not null then n := n + 1; end if;
    end loop;
  elsif p_kind = 'academy_digest' then
    select count(*) into n from academy_lessons where is_active and created_at > now() - interval '24 hours';
    if n > 0 then
      for r in select u.id uid, u.project_id from onboarding_users u join onboarding_projects p on p.id = u.project_id and p.status = 'active' where u.user_id is not null loop
        perform app_notify(null, r.uid, 'client_academy_new', case when n = 1 then 'Aula nova no Academy' else n || ' aulas novas no Academy' end, 'Tem conteúdo novo esperando por você.', r.project_id, null, 'academy', '/#/academy');
      end loop;
    end if;
  end if;
  return jsonb_build_object('kind', p_kind, 'notificadas', n);
end $$;
revoke all on function public.notif_run_scheduled(text) from public, anon, authenticated;

-- 5) Comunicados (master/admin): pra todos os clientes, uma empresa, ou a equipe
create table if not exists public.app_announcements (
  id uuid primary key default gen_random_uuid(), title text not null, message text not null, audience text not null,
  company_id uuid, action_url text, sent_count int not null default 0, created_by uuid, created_at timestamptz not null default now());
alter table public.app_announcements enable row level security;
revoke all on public.app_announcements from anon;
grant select on public.app_announcements to authenticated;
drop policy if exists app_announcements_read on public.app_announcements;
create policy app_announcements_read on public.app_announcements for select to authenticated using (crm_is_settings_admin());

create or replace function public.send_announcement(p_title text, p_message text, p_audience text, p_company uuid default null, p_action_url text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid; r record; n int := 0; v_id uuid;
begin
  select id into me from onboarding_staff where user_id = auth.uid() and is_active and role in ('master','admin');
  if me is null then raise exception 'só master ou admin envia comunicado'; end if;
  if coalesce(btrim(p_title),'') = '' or coalesce(btrim(p_message),'') = '' then raise exception 'título e mensagem são obrigatórios'; end if;
  if p_audience not in ('clients','company','staff','all') then raise exception 'público inválido'; end if;
  insert into app_announcements (title, message, audience, company_id, action_url, created_by) values (btrim(p_title), btrim(p_message), p_audience, p_company, nullif(btrim(coalesce(p_action_url,'')),''), me) returning id into v_id;
  if p_audience in ('clients','company','all') then
    for r in select u.id uid, u.project_id from onboarding_users u join onboarding_projects p on p.id = u.project_id and p.status in ('active','notice_period','cancellation_signaled')
      where u.user_id is not null and u.role::text <> 'consultant' and (p_audience <> 'company' or p.onboarding_company_id = p_company) loop
      if app_notify(null, r.uid, 'announcement', btrim(p_title), btrim(p_message), r.project_id, v_id, 'announcement', coalesce(nullif(btrim(coalesce(p_action_url,'')),''), '/#/onboarding-client/' || r.project_id), 'high') is not null then n := n + 1; end if;
    end loop;
  end if;
  if p_audience in ('staff','all') then
    for r in select id from onboarding_staff where is_active and user_id is not null and tenant_id is null loop
      if app_notify(r.id, null, 'announcement', btrim(p_title), btrim(p_message), null, v_id, 'announcement', nullif(btrim(coalesce(p_action_url,'')),''), 'high') is not null then n := n + 1; end if;
    end loop;
  end if;
  update app_announcements set sent_count = n where id = v_id;
  return jsonb_build_object('ok', true, 'enviadas', n);
end $$;
revoke all on function public.send_announcement(text,text,text,uuid,text) from public, anon;
grant execute on function public.send_announcement(text,text,text,uuid,text) to authenticated;

-- crons (horário de Brasília = UTC-3)
select cron.unschedule(jobname) from cron.job where jobname in ('notif-meeting-reminder','notif-invoices','notif-task-due','notif-kpi-reminder','notif-academy-digest');
select cron.schedule('notif-meeting-reminder', '*/10 * * * *', $c$select public.notif_run_scheduled('meeting_reminder')$c$);
select cron.schedule('notif-invoices',        '0 12 * * *',   $c$select public.notif_run_scheduled('invoices')$c$);
select cron.schedule('notif-task-due',        '0 11 * * *',   $c$select public.notif_run_scheduled('task_due')$c$);
select cron.schedule('notif-kpi-reminder',    '0 21 * * 1-6', $c$select public.notif_run_scheduled('kpi_reminder')$c$);
select cron.schedule('notif-academy-digest',  '30 12 * * *',  $c$select public.notif_run_scheduled('academy_digest')$c$);
