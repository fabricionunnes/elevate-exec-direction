-- 09/11/2026: manda "Schedule" pro Meta quando o card vai pra etapa de agendamento SEM reunião
-- registrada (Fabrício: "Mandar o Schedule também quando o card vai pra Agendado"). Na Triagem NÃO
-- manda nada ("lá que estamos qualificando o lead").
-- Não duplica com o capi_meeting: só dispara se o lead não tem crm_meeting_events 'scheduled' nem
-- Schedule já aceito (200) no meta_capi_log. Mesmo se os dois dispararem na mesma transação, o
-- event_id é o mesmo (`<lead>:Schedule`) e o Meta deduplica.
-- Etapas por stage_id explícito: os 3 funis pedidos (Funil SE, UNV Finance, Tráfego Pago) e os
-- funis que tiveram reunião agendada nos últimos 90 dias.
create or replace function public.trg_capi_schedule_stage()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if NEW.stage_id is not distinct from OLD.stage_id then return NEW; end if;
  if not (NEW.stage_id = any (array[
    'cd7f88fd-998b-4b68-aff8-a62deae455ee', -- Funil SE · Agendado
    'a9133185-80ea-4fcb-af84-ac6cbcba7e5d', -- UNV Finance · Agendado
    '130b2ee4-c77e-4c9a-be94-60efce474f03', -- Tráfego Pago · Agendado
    'ff384bd6-06f0-483d-8207-ea494dc720a7', -- Social Media · Agendado
    '1c0af476-c500-4b6c-95a5-70b09d9449eb', -- Funil SE Antigo · Agendado
    'dedd4fb2-34f6-490d-9ea6-161bf03dd2c9', -- Funil SS · Agendado
    'c0c46b06-9e4f-40a1-a92d-c392f5ed4c8c', -- Imersão Crescer · Agendado
    '34d24cd8-120e-4c8f-bbdd-eba0bd5de4c4', -- Palestras · Agendado
    '3978666c-fc1e-4c7a-a661-8da629101a40', -- Typeforms · Agendado
    '1bfd57ad-a2ef-4d39-8cab-3f079188b803', -- Funil de recuperação · Agendado
    'f3526c48-fe63-4a05-a0ac-642a9a4252ad', -- Indicações · Agendado
    '85d1cdab-166b-406d-9d38-5ccb379ff635', -- Mastermind · Agendado
    '9f6d8df1-0e97-491f-98be-c0e7b54577bd'  -- Mansão Empreendedora · Reunião agendada
  ]::uuid[])) then
    return NEW;
  end if;
  if exists (select 1 from public.crm_meeting_events e where e.lead_id = NEW.id and e.event_type = 'scheduled') then
    return NEW;
  end if;
  if exists (select 1 from public.meta_capi_log l where l.lead_id = NEW.id and l.event_name = 'Schedule' and l.status_code = 200) then
    return NEW;
  end if;
  perform public.fire_capi(NEW.id, 'Schedule', null);
  return NEW;
exception when others then
  -- evento pro Meta nunca pode travar a mudança de etapa do card
  raise warning 'trg_capi_schedule_stage: %', sqlerrm;
  return NEW;
end;
$function$;

drop trigger if exists capi_schedule_stage on public.crm_leads;
create trigger capi_schedule_stage
  after update of stage_id on public.crm_leads
  for each row execute function public.trg_capi_schedule_stage();
