-- Painel de Controle mostrava 2 "reuniões agendadas" em outubro com 18 reuniões criadas. O evento
-- "scheduled" em crm_meeting_events só era gravado por dois caminhos (botão do card do lead e
-- agente de IA); reuniões vindas da agenda Google, do portal e de outros fluxos só criavam a
-- atividade. Agora toda atividade de reunião nova gera o evento, sem duplicar quando o caminho
-- antigo já gravou (janela de 10 minutos pro mesmo lead).
CREATE OR REPLACE FUNCTION public.crm_meeting_activity_scheduled_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare l record;
begin
  if NEW.type <> 'meeting' or NEW.lead_id is null then return NEW; end if;
  if coalesce(NEW.status, '') in ('cancelled', 'canceled') then return NEW; end if;
  if exists (
    select 1 from crm_meeting_events e
    where e.lead_id = NEW.lead_id and e.event_type = 'scheduled'
      and e.created_at between NEW.created_at - interval '10 minutes' and NEW.created_at + interval '10 minutes'
  ) then return NEW; end if;
  select pipeline_id, stage_id, owner_staff_id into l from crm_leads where id = NEW.lead_id;
  insert into crm_meeting_events (lead_id, pipeline_id, event_type, credited_staff_id, triggered_by_staff_id, stage_id, event_date, owner_staff_id, created_at)
  values (NEW.lead_id, l.pipeline_id, 'scheduled', coalesce(NEW.responsible_staff_id, NEW.created_by, l.owner_staff_id), NEW.created_by, l.stage_id, NEW.created_at, l.owner_staff_id, NEW.created_at);
  return NEW;
exception when others then
  raise warning 'crm_meeting_activity_scheduled_event: %', sqlerrm; return NEW;
end $$;
DROP TRIGGER IF EXISTS trg_crm_meeting_activity_scheduled_event ON public.crm_activities;
CREATE TRIGGER trg_crm_meeting_activity_scheduled_event AFTER INSERT ON public.crm_activities
FOR EACH ROW EXECUTE FUNCTION public.crm_meeting_activity_scheduled_event();
