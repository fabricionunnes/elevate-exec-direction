-- Formulários de diagnóstico (UNV Ads, Social, Finance, Mansão): quem é cortado (perfil ou
-- faturamento) depois de deixar o WhatsApp vira lead no funil do formulário, já PERDIDO com o
-- motivo "Fora do ICP" (Fabrício, 21/10/2026: "estes leads que chegam, quero que continuem no funil
-- mas na etapa perdido, como fora do ICP"). Lead nascido em etapa perdida não manda conversão pra
-- Meta (trg_capi_lead) nem entra em cadência; nenhum fluxo de "lead criado" está ativo.

create or replace function public.crm_form_cortado_vira_lead()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_pipeline uuid; v_origin uuid; v_stage uuid; v_motivo uuid; v_label text;
  v_digits text; v_lead uuid; v_resp text;
begin
  if NEW.lead_id is not null or NEW.status not in ('cortado_perfil', 'cortado_faturamento') then return NEW; end if;
  v_digits := regexp_replace(coalesce(NEW.contato_whatsapp, ''), '\D', '', 'g');
  if length(v_digits) < 10 then return NEW; end if;
  if not v_digits like '55%' or length(v_digits) <= 11 then v_digits := '55' || v_digits; end if;

  select p, o, l into v_pipeline, v_origin, v_label from (values
    ('unvfinance', '8e1e8cae-08ed-4b98-ac12-6b4857d0af3a'::uuid, 'b375905d-aaea-411e-bd6f-c1ac030bad7a'::uuid, 'UNV Finance'),
    ('unvads',     '650ee7b4-d726-4b91-bc4f-138792747cdf'::uuid, '9cd8adbe-3069-4a71-9374-4f37b9cc4a03'::uuid, 'UNV Ads'),
    ('unvsocial',  '96bbbbaf-cf87-43eb-af1e-2ab15ccfdf00'::uuid, '357b1c33-afe8-4fff-bbcb-7aadebc4c010'::uuid, 'UNV Social'),
    ('mansao',     'd75962f6-4369-4d92-9386-52d477602149'::uuid, 'f10a6f38-ec09-4465-b362-dbb4a117c691'::uuid, 'Mansão Empreendedora')
  ) as m(f, p, o, l) where m.f = NEW.form;
  if v_pipeline is null then return NEW; end if;

  select id into v_stage from crm_stages where pipeline_id = v_pipeline and final_type = 'lost' order by sort_order limit 1;
  select id into v_motivo from crm_loss_reasons where name = 'Fora do ICP' and is_active limit 1;
  if v_stage is null then return NEW; end if;

  select string_agg(key || ': ' || value, ', ') into v_resp from jsonb_each_text(coalesce(NEW.respostas, '{}'::jsonb));

  insert into crm_leads (name, phone, pipeline_id, stage_id, origin_id, loss_reason_id, closed_at, notes,
                         utm_source, utm_campaign, utm_content)
  values (coalesce(nullif(trim(NEW.contato_nome), ''), 'Lead ' || v_digits), v_digits, v_pipeline, v_stage, v_origin, v_motivo, now(),
          'Cortado no formulário ' || v_label || ' (' || case when NEW.status = 'cortado_faturamento' then 'faturamento' else 'perfil' end || ')'
            || coalesce('. Respostas: ' || v_resp, ''),
          NEW.utm_source, NEW.utm_campaign, NEW.utm_content)
  returning id into v_lead;

  NEW.lead_id := v_lead;
  return NEW;
exception when others then
  raise warning 'crm_form_cortado_vira_lead (%): %', NEW.id, sqlerrm;
  return NEW; -- nunca trava o formulário
end $$;

drop trigger if exists trg_form_cortado_vira_lead on public.crm_form_sessions;
create trigger trg_form_cortado_vira_lead
  before insert or update of status, contato_whatsapp, contato_nome on public.crm_form_sessions
  for each row execute function public.crm_form_cortado_vira_lead();

-- os que já foram cortados com WhatsApp e ficaram sem lead
update public.crm_form_sessions set status = status
 where lead_id is null and status in ('cortado_perfil', 'cortado_faturamento') and contato_whatsapp is not null;
