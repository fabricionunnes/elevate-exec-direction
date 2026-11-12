-- Atendimento: quem não é admin só vê conversa de lead sem dono ou de lead dele (Fabrício, 12/11/2026: "o usuário
-- Ricardo não pode ver as conversas com ele, mesmo tendo acesso ao número de whatsapp, só pode ver conversas de
-- lead que não está vinculado a ninguém, ou que está vinculado a ele mesmo").
-- Devolve os ids das conversas (WhatsApp e Instagram) que a pessoa logada NÃO deve ver: lead com dono ou closer
-- definido, em que ela não é dono, closer nem SDR, e a conversa não está atribuída a ela.
-- Master, admin e head comercial veem tudo (lista vazia). Um vetor só, pra não bater no limite de 1.000 linhas.
create or replace function public.crm_inbox_conversas_de_outros()
returns uuid[] language sql stable security definer set search_path = public as $$
  with eu as (
    select s.id, s.role from onboarding_staff s where s.user_id = auth.uid() and s.is_active limit 1
  ), bloqueadas as (
    select v.id from crm_whatsapp_conversations v join crm_leads l on l.id = v.lead_id cross join eu
     where eu.role not in ('master', 'admin', 'head_comercial')
       and coalesce(l.owner_staff_id, l.closer_staff_id) is not null
       and eu.id is distinct from l.owner_staff_id and eu.id is distinct from l.closer_staff_id and eu.id is distinct from l.sdr_staff_id
       and v.assigned_to is distinct from eu.id
    union all
    select c.id from instagram_conversations c join crm_leads l on l.id = c.lead_id cross join eu
     where eu.role not in ('master', 'admin', 'head_comercial')
       and coalesce(l.owner_staff_id, l.closer_staff_id) is not null
       and eu.id is distinct from l.owner_staff_id and eu.id is distinct from l.closer_staff_id and eu.id is distinct from l.sdr_staff_id
       and c.assigned_to is distinct from eu.id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) from bloqueadas
$$;
revoke all on function public.crm_inbox_conversas_de_outros() from public, anon;
grant execute on function public.crm_inbox_conversas_de_outros() to authenticated;
select 'ok' r;
