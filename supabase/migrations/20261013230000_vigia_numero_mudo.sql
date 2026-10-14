-- Vigia por número (13/10/2026). Já aplicado em produção pela Management API.
-- Ver public.check_instance_silence() e o cron 'wa-instance-silence-alert' (5 14-22 * * 1-5).
create table if not exists public.wa_instance_silence_alerts (
  instance_id uuid not null,
  last_event_at timestamptz not null,
  alerted_at timestamptz not null default now(),
  primary key (instance_id, last_event_at)
);
alter table public.wa_instance_silence_alerts enable row level security;
CREATE OR REPLACE FUNCTION public.check_instance_silence(_simular boolean DEFAULT false, _fora_de_hora boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  agora_sp timestamp := now() at time zone 'America/Sao_Paulo';
  r record;
  remetente record;
  v_url text;
  v_msg text;
  saida jsonb := '[]'::jsonb;
begin
  -- só em dia útil, das 11h às 19h59 (às 11h já dá pra ver 3h de silêncio desde as 8h)
  if not _fora_de_hora and (extract(isodow from agora_sp) > 5 or extract(hour from agora_sp) not between 11 and 19) then
    return saida;
  end if;

  for r in
    select i.id, i.instance_name, coalesce(i.display_name, i.instance_name) nome, ev.ultimo, ev.semana
      from public.whatsapp_instances i
      cross join lateral (
        select max(m.created_at) ultimo, count(*) semana
          from public.crm_whatsapp_messages m
          join public.crm_whatsapp_conversations cv on cv.id = m.conversation_id
         where cv.instance_id = i.id
           and m.created_at > now() - interval '7 days'
           and (m.direction = 'inbound' or (m.sent_by is null and not coalesce(m.is_ai, false)))
      ) ev
     where i.status = 'connected'
       and ev.semana >= 150                      -- número movimentado; o pouco usado fica horas quieto por natureza
       and ev.ultimo < now() - interval '3 hours'
  loop
    if exists (select 1 from public.wa_instance_silence_alerts a where a.instance_id = r.id and a.last_event_at = r.ultimo) then
      continue;                                  -- esse silêncio já foi avisado
    end if;

    v_msg := 'Nexus: o número ' || r.nome || ' está MUDO. Nada dele entra no CRM desde '
      || to_char(r.ultimo at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')
      || ' (' || round(extract(epoch from (now() - r.ultimo)) / 3600) || 'h). O servidor mostra conectado, então a sessão travou. '
      || 'Reinicie ou reconecte por QR em Atendimento > Dispositivos. As respostas dos leads nesse intervalo não aparecem no sistema.';
    saida := saida || jsonb_build_object('numero', r.nome, 'ultimo_evento', r.ultimo, 'eventos_7d', r.semana, 'mensagem', v_msg);
    if _simular then continue; end if;

    -- quem avisa é outro número, que esteja funcionando
    select i.instance_name, i.api_url, i.api_key into remetente
      from public.whatsapp_instances i
     where i.status = 'connected' and i.api_key is not null and i.api_url is not null and i.id <> r.id
     order by (i.instance_name = 'fabricionunnes') desc, (i.instance_name = 'financeirounv') desc
     limit 1;
    if remetente is null then continue; end if;
    v_url := regexp_replace(remetente.api_url, '/+$', '') || '/message/sendText/' || remetente.instance_name;
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', remetente.api_key),
      body := jsonb_build_object('number', '5531989840003', 'text', v_msg),
      timeout_milliseconds := 25000
    );
    insert into public.wa_instance_silence_alerts (instance_id, last_event_at) values (r.id, r.ultimo) on conflict do nothing;
  end loop;
  return saida;
end $function$

;
select cron.schedule('wa-instance-silence-alert', '5 14-22 * * 1-5', $cmd$ select public.check_instance_silence(); $cmd$);
