-- Mensagem do WhatsApp vinda de QUALQUER formulário (UNV Ads, UNV Social, UNV Finance) casa com o lead
-- do formulário antes das automações. Antes só reconhecia "diagnóstico" (UNV Ads) e, quando não achava o
-- lead, criava no Tráfego Pago mesmo pra Social/Finance. Resultado: lead do formulário Social/Finance
-- ganhava um duplicado no Funil SE pela regra "Leads Funil SE" (casos Paula, Alessandra, José Costa).
CREATE OR REPLACE FUNCTION public.crm_wa_lead_from_form_text(p_conversation uuid, p_text text, p_apply boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare
  v_email text; v_tel text; v_nome text; v_lead uuid; v_ct record; v_cv record;
  v_pipe uuid; v_stage uuid; v_form text;
begin
  if p_text is null or p_text !~* 'acabei de preencher (o|a) (diagn[óo]stico|formul[áa]rio)' then return null; end if;
  -- de qual formulário veio (pra preferir o funil certo e, se precisar criar, criar no lugar certo)
  if p_text ~* 'unv social|diagn[óo]stico de redes' then v_pipe := '96bbbbaf-cf87-43eb-af1e-2ab15ccfdf00'; v_form := 'UNV Social';
  elsif p_text ~* 'unv finance|financeir' then v_pipe := '8e1e8cae-08ed-4b98-ac12-6b4857d0af3a'; v_form := 'UNV Finance';
  elsif p_text ~* 'unv ads|tr[áa]fego' then v_pipe := '650ee7b4-d726-4b91-bc4f-138792747cdf'; v_form := 'UNV Ads';
  end if;
  v_email := lower(btrim(substring(p_text from '(?i)e-?mail:[ \t]*([^\s]+)')));
  v_tel := regexp_replace(coalesce(substring(p_text from '(?i)(?:whatsapp|telefone|celular):[ \t]*([0-9()+ .-]{8,})'), ''), '\D', '', 'g');
  v_nome := btrim(substring(p_text from '(?i)nome:[ \t]*([^\n]+)'));
  select * into v_cv from crm_whatsapp_conversations where id = p_conversation;
  if not found then return null; end if;
  select phone, name into v_ct from crm_whatsapp_contacts where id = v_cv.contact_id;

  select l.id into v_lead from crm_leads l
   where l.tenant_id is null and l.created_at >= now() - interval '30 days'
     and ((v_email <> '' and lower(l.email) = v_email)
          or (length(br_phone_key(v_tel)) = 10 and br_phone_key(l.phone) = br_phone_key(v_tel))
          or (length(br_phone_key(v_ct.phone)) = 10 and br_phone_key(l.phone) = br_phone_key(v_ct.phone)))
   order by (v_pipe is not null and l.pipeline_id = v_pipe) desc, l.created_at desc limit 1;

  if v_lead is null then
    -- formulário sem lead (submit falhou?): cria no funil do próprio formulário. Sem funil identificado, não cria.
    if v_pipe is null then return null; end if;
    select id into v_stage from crm_stages where pipeline_id = v_pipe order by sort_order nulls last, created_at limit 1;
    if not p_apply then return null; end if;
    insert into crm_leads (name, phone, email, pipeline_id, stage_id, notes)
    values (coalesce(nullif(v_nome,''), v_ct.name, v_ct.phone), coalesce(nullif(v_tel,''), v_ct.phone), nullif(v_email,''), v_pipe, v_stage,
            'Criado pela mensagem do formulário ' || v_form || ' no WhatsApp (lead do formulário não encontrado).')
    returning id into v_lead;
  end if;

  if p_apply then
    update crm_whatsapp_conversations set lead_id = v_lead where id = p_conversation and lead_id is null;
    -- a pessoa escreveu de um número diferente do que digitou no formulário: anota no lead
    if length(br_phone_key(v_ct.phone)) = 10 and br_phone_key(v_ct.phone) <> br_phone_key((select phone from crm_leads where id = v_lead)) then
      update crm_leads set extra_phones = array_append(coalesce(extra_phones, '{}'::text[]), v_ct.phone)
       where id = v_lead
         and not exists (select 1 from unnest(coalesce(extra_phones, '{}'::text[])) x where br_phone_key(x) = br_phone_key(v_ct.phone));
    end if;
  end if;
  return v_lead;
exception when others then return null;
end $function$;
