-- Formulário da Mansão Empreendedora (GP de Outubro, 24/10/2026) no rastreio de abandono.
-- Página: /mansao/forms/. O lead vai pro funil "Mansão Empreendedora" pelo submit-pipeline-form
-- (token e735fc7d80e18c7136a9c5678bf334d2) e funciona sem esta migração. Ela só libera o
-- "mansao" no form_track, pra aparecer em CRM > Dashboard > Formulários (funil pergunta a
-- pergunta, abandono e recuperação pelo WhatsApp), igual UNV Ads / Social / Finance.

alter table public.crm_form_sessions drop constraint if exists crm_form_sessions_form_check;
alter table public.crm_form_sessions
  add constraint crm_form_sessions_form_check check (form in ('unvads','unvsocial','unvfinance','mansao'));

-- Mesma função de 20261016120000_formularios_recuperar_whatsapp.sql, só com 'mansao' na lista.
create or replace function public.form_track(
  p_session uuid, p_form text, p_step int default null, p_step_name text default null,
  p_question int default null, p_total int default null, p_status text default null,
  p_lead uuid default null, p_meta jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_ms bigint; v_start timestamptz; v_wpp text; v_nome text;
begin
  if p_session is null or p_form not in ('unvads','unvsocial','unvfinance','mansao') then return; end if;
  if p_meta is not null and length(p_meta::text) > 4000 then p_meta := null; end if;
  if p_status is not null and p_status not in ('em_andamento','enviou','desqualificado','cortado_perfil','cortado_faturamento','erro_envio') then
    p_status := null;
  end if;
  -- contato: só número com 10 a 13 dígitos e nome curto
  v_wpp := nullif(regexp_replace(coalesce(p_meta#>>'{contato,whatsapp}', ''), '\D', '', 'g'), '');
  if v_wpp is not null and (length(v_wpp) < 10 or length(v_wpp) > 13) then v_wpp := null; end if;
  v_nome := nullif(left(trim(coalesce(p_meta#>>'{contato,nome}', '')), 80), '');

  insert into crm_form_sessions (id, form, total_questions, utm_source, utm_medium, utm_campaign, utm_content, ad_name, referrer, device)
  values (p_session, p_form, p_total,
          left(p_meta->>'utm_source',120), left(p_meta->>'utm_medium',120), left(p_meta->>'utm_campaign',200),
          left(p_meta->>'utm_content',200), left(p_meta->>'ad_name',200), left(p_meta->>'referrer',300), left(p_meta->>'device',20))
  on conflict (id) do nothing;

  select started_at into v_start from crm_form_sessions where id = p_session;
  v_ms := (extract(epoch from (now() - v_start)) * 1000)::bigint;

  update crm_form_sessions set
    updated_at = now(),
    last_step = coalesce(p_step, last_step),
    last_step_name = coalesce(left(p_step_name, 40), last_step_name),
    max_question = greatest(max_question, coalesce(p_question, 0)),
    total_questions = coalesce(p_total, total_questions),
    passos = case when p_step is null or jsonb_array_length(passos) >= 60 then passos
                  else passos || jsonb_build_array(jsonb_build_object('s', p_step, 'n', left(p_step_name, 40), 'q', coalesce(p_question, 0), 't', v_ms)) end,
    respostas = case when p_meta ? 'respostas' and jsonb_typeof(p_meta->'respostas') = 'object' then respostas || (p_meta->'respostas') else respostas end,
    status = case when p_status is null then status
                  when status in ('enviou','desqualificado') then status
                  else p_status end,
    lead_id = coalesce(p_lead, lead_id),
    contato_whatsapp = coalesce(v_wpp, contato_whatsapp),
    contato_nome = coalesce(v_nome, contato_nome),
    contato_em = case when v_wpp is not null and contato_em is null then now() else contato_em end
  where id = p_session and form = p_form;
end $$;
revoke all on function public.form_track(uuid,text,int,text,int,int,text,uuid,jsonb) from public;
grant execute on function public.form_track(uuid,text,int,text,int,int,text,uuid,jsonb) to anon, authenticated, service_role;
