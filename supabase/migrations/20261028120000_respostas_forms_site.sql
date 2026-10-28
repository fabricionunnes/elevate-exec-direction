-- Respostas dos formulários do site (UNV Ads, Social, Finance, Mansão) na aba "Respostas" do lead
-- (Fabrício, 28/10/2026). O submit-pipeline-form grava o diagnóstico só nas notes ("Desafio:
-- Pergunta: resposta | Pergunta: resposta | UTM Source: …"); a aba lê crm_lead_form_answers, que
-- aceita resposta sem pergunta cadastrada (question_label), igual às do formulário do Meta.
create or replace function public.crm_respostas_do_site(p_lead uuid, p_notes text)
 returns int language plpgsql security definer set search_path to 'public'
as $$
declare v_txt text; v_parte text; v_label text; v_resp text; n int := 0;
begin
  if p_notes is null or position('Desafio: ' in p_notes) = 0 then return 0; end if;
  if exists (select 1 from crm_lead_form_answers where lead_id = p_lead and source = 'formulario_site') then return 0; end if;
  v_txt := substring(p_notes from position('Desafio: ' in p_notes) + 9);
  -- o diagnóstico termina onde começam os campos do sistema
  v_txt := regexp_replace(v_txt, '\s\|\s(UTM Source|UTM Medium|UTM Campaign|Origem):.*$', '');
  foreach v_parte in array string_to_array(v_txt, ' | ') loop
    v_label := btrim(split_part(v_parte, ': ', 1));
    v_resp := btrim(substring(v_parte from length(split_part(v_parte, ': ', 1)) + 3));
    if v_label = '' or v_resp is null or v_resp = '' or position(': ' in v_parte) = 0 or v_label in ('Via') then continue; end if;
    insert into crm_lead_form_answers (lead_id, question_label, answer_text, source, created_at) values (p_lead, v_label, v_resp, 'formulario_site', clock_timestamp()); -- clock_timestamp mantém a ordem do formulário
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.trg_crm_respostas_do_site()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if NEW.notes is not null and position('Desafio: ' in NEW.notes) > 0 then
    perform crm_respostas_do_site(NEW.id, NEW.notes);
  end if;
  return NEW;
exception when others then
  raise warning 'trg_crm_respostas_do_site: %', sqlerrm;
  return NEW; -- nunca trava a criação do lead
end $$;
drop trigger if exists crm_respostas_do_site on public.crm_leads;
create trigger crm_respostas_do_site after insert or update of notes on public.crm_leads
  for each row execute function public.trg_crm_respostas_do_site();

-- leads que já chegaram pelos formulários do site
delete from crm_lead_form_answers where source = 'formulario_site';
select sum(crm_respostas_do_site(id, notes)) from crm_leads where notes like '%Desafio: %';
