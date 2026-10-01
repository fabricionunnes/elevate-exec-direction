-- Suporte dentro do CRM (widget flutuante), 01/10/2026.
-- O item "Ajuda" abria um link do site. Agora o staff abre um chamado sem sair do CRM:
-- fica gravado aqui, o time de suporte da UNV (master/admin, tenant nulo) é avisado pelo
-- sino (onboarding_notifications) e responde em Configurações > Suporte. Sem WhatsApp.

create table if not exists public.crm_support_tickets (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.onboarding_staff(id) on delete cascade,
  tenant_id uuid,
  subject text not null,
  message text not null,
  page_url text,
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references public.onboarding_staff(id) on delete set null
);
create index if not exists crm_support_tickets_staff_idx on public.crm_support_tickets (staff_id, created_at desc);
create index if not exists crm_support_tickets_status_idx on public.crm_support_tickets (status, updated_at desc);

create table if not exists public.crm_support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.crm_support_tickets(id) on delete cascade,
  staff_id uuid references public.onboarding_staff(id) on delete set null,
  from_support boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists crm_support_ticket_messages_ticket_idx on public.crm_support_ticket_messages (ticket_id, created_at);

alter table public.crm_support_tickets enable row level security;
alter table public.crm_support_ticket_messages enable row level security;

-- Quem abriu vê o próprio chamado; o suporte da UNV vê todos. Escrita só pelas funções.
drop policy if exists "crm_support_tickets_select" on public.crm_support_tickets;
create policy "crm_support_tickets_select" on public.crm_support_tickets
  for select to authenticated
  using (staff_id = public.get_current_staff_id() or public.crm_is_unv_admin());

drop policy if exists "crm_support_ticket_messages_select" on public.crm_support_ticket_messages;
create policy "crm_support_ticket_messages_select" on public.crm_support_ticket_messages
  for select to authenticated
  using (exists (
    select 1 from public.crm_support_tickets t
    where t.id = ticket_id and (t.staff_id = public.get_current_staff_id() or public.crm_is_unv_admin())
  ));

revoke all on public.crm_support_tickets from anon;
revoke all on public.crm_support_ticket_messages from anon;
revoke insert, update, delete on public.crm_support_tickets from authenticated;
revoke insert, update, delete on public.crm_support_ticket_messages from authenticated;
grant select on public.crm_support_tickets to authenticated;
grant select on public.crm_support_ticket_messages to authenticated;
grant all on public.crm_support_tickets to service_role;
grant all on public.crm_support_ticket_messages to service_role;

-- Avisa o time de suporte (menos quem escreveu). Falha no aviso não derruba o chamado.
create or replace function public.crm_support_notify_team(p_ticket_id uuid, p_author uuid, p_title text, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.onboarding_notifications (staff_id, type, title, message, reference_id, reference_type, action_url)
  select s.id, 'crm_support_ticket', p_title, p_message, p_ticket_id, 'crm_support_ticket',
         '/crm/settings?tab=suporte&chamado=' || p_ticket_id::text
  from public.onboarding_staff s
  where s.is_active = true and s.tenant_id is null and s.role in ('master', 'admin') and s.id <> p_author;
exception when others then
  raise warning 'crm_support_notify_team falhou: %', sqlerrm;
end $$;
revoke all on function public.crm_support_notify_team(uuid, uuid, text, text) from public, anon, authenticated;

create or replace function public.crm_support_ticket_open(p_subject text, p_message text, p_page_url text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.onboarding_staff;
  v_id uuid;
begin
  select * into v_staff from public.onboarding_staff where user_id = auth.uid() and is_active = true limit 1;
  if v_staff.id is null then
    raise exception 'Só usuário da equipe abre chamado';
  end if;
  if coalesce(trim(p_subject), '') = '' or coalesce(trim(p_message), '') = '' then
    raise exception 'Preencha o assunto e a mensagem';
  end if;

  insert into public.crm_support_tickets (staff_id, tenant_id, subject, message, page_url)
  values (v_staff.id, v_staff.tenant_id, left(trim(p_subject), 200), left(trim(p_message), 5000), left(p_page_url, 500))
  returning id into v_id;

  perform public.crm_support_notify_team(
    v_id, v_staff.id,
    'Novo chamado de suporte: ' || left(trim(p_subject), 80),
    v_staff.name || ': ' || left(trim(p_message), 160)
  );
  return v_id;
end $$;
revoke all on function public.crm_support_ticket_open(text, text, text) from public, anon;
grant execute on function public.crm_support_ticket_open(text, text, text) to authenticated, service_role;

-- Resposta: de quem abriu (reabre e avisa o suporte) ou do suporte (marca respondido e avisa quem abriu).
create or replace function public.crm_support_ticket_reply(p_ticket_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.onboarding_staff;
  v_ticket public.crm_support_tickets;
  v_is_owner boolean;
  v_id uuid;
begin
  select * into v_staff from public.onboarding_staff where user_id = auth.uid() and is_active = true limit 1;
  select * into v_ticket from public.crm_support_tickets where id = p_ticket_id;
  if v_staff.id is null or v_ticket.id is null then
    raise exception 'Chamado não encontrado';
  end if;
  v_is_owner := v_ticket.staff_id = v_staff.id;
  if not v_is_owner and not public.crm_is_unv_admin() then
    raise exception 'Sem permissão pra responder este chamado';
  end if;
  if coalesce(trim(p_body), '') = '' then
    raise exception 'Escreva a mensagem';
  end if;

  insert into public.crm_support_ticket_messages (ticket_id, staff_id, from_support, body)
  values (p_ticket_id, v_staff.id, not v_is_owner, left(trim(p_body), 5000))
  returning id into v_id;

  update public.crm_support_tickets
     set status = case when v_is_owner then 'open' else 'answered' end,
         updated_at = now(), closed_at = null, closed_by = null
   where id = p_ticket_id;

  if v_is_owner then
    perform public.crm_support_notify_team(
      p_ticket_id, v_staff.id,
      'Nova mensagem no chamado: ' || left(v_ticket.subject, 80),
      v_staff.name || ': ' || left(trim(p_body), 160)
    );
  else
    begin
      insert into public.onboarding_notifications (staff_id, type, title, message, reference_id, reference_type, action_url)
      values (v_ticket.staff_id, 'crm_support_reply', 'O suporte respondeu: ' || left(v_ticket.subject, 80),
              left(trim(p_body), 160), p_ticket_id, 'crm_support_ticket', '/crm/reports?suporte=' || p_ticket_id::text);
    exception when others then
      raise warning 'aviso de resposta do suporte falhou: %', sqlerrm;
    end;
  end if;
  return v_id;
end $$;
revoke all on function public.crm_support_ticket_reply(uuid, text) from public, anon;
grant execute on function public.crm_support_ticket_reply(uuid, text) to authenticated, service_role;

create or replace function public.crm_support_ticket_close(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid := public.get_current_staff_id();
  v_ticket public.crm_support_tickets;
begin
  select * into v_ticket from public.crm_support_tickets where id = p_ticket_id;
  if v_ticket.id is null or v_staff_id is null then
    raise exception 'Chamado não encontrado';
  end if;
  if v_ticket.staff_id <> v_staff_id and not public.crm_is_unv_admin() then
    raise exception 'Sem permissão pra encerrar este chamado';
  end if;
  update public.crm_support_tickets
     set status = 'closed', closed_at = now(), closed_by = v_staff_id, updated_at = now()
   where id = p_ticket_id and status <> 'closed';
end $$;
revoke all on function public.crm_support_ticket_close(uuid) from public, anon;
grant execute on function public.crm_support_ticket_close(uuid) to authenticated, service_role;
