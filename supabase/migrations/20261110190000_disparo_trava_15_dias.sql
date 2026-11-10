-- Trava de 15 dias nos disparos da API oficial (Fabrício, 10/11/2026: "barrasse automaticamente envio de
-- disparos para leads que foram enviados disparo com menos de 15 dias"; vale só pros disparos novos).
create index if not exists wocr_phone_sent_idx on public.whatsapp_official_campaign_recipients (phone, sent_at desc) where sent_at is not null;

create or replace function public.wocr_trava_15_dias()
returns trigger language plpgsql security definer set search_path = public as $$
declare _ultimo timestamptz;
begin
  if NEW.status is distinct from 'pending' then return NEW; end if;
  begin
    if NEW.lead_id is not null then
      select max(o.sent_at) into _ultimo from whatsapp_official_campaign_recipients o
       where o.lead_id = NEW.lead_id and o.campaign_id <> NEW.campaign_id
         and o.sent_at > now() - interval '15 days' and o.status in ('sent','delivered','read');
    end if;
    if _ultimo is null and NEW.phone is not null then
      select max(o.sent_at) into _ultimo from whatsapp_official_campaign_recipients o
       where o.phone = NEW.phone and o.campaign_id <> NEW.campaign_id
         and o.sent_at > now() - interval '15 days' and o.status in ('sent','delivered','read');
    end if;
    if _ultimo is not null then
      NEW.status := 'skipped';
      NEW.error_text := 'Recebeu disparo há menos de 15 dias (em ' || to_char(_ultimo at time zone 'America/Sao_Paulo', 'DD/MM') || ')';
    end if;
  exception when others then
    raise warning 'trava 15 dias falhou: %', sqlerrm; -- nunca derruba a criação do disparo
  end;
  return NEW;
end $$;

drop trigger if exists wocr_trava_15_dias on public.whatsapp_official_campaign_recipients;
create trigger wocr_trava_15_dias before insert on public.whatsapp_official_campaign_recipients
for each row execute function public.wocr_trava_15_dias();
select 'ok' r;
