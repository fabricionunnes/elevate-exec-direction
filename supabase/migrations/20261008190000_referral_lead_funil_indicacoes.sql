-- Indicação (pesquisa NPS / portal do cliente) -> lead no funil "Indicações".
-- O gatilho antigo apontava pra um funil fixo (f1b9d320...) que não existe mais e pra origem "Indicação" (hoje é "Indicações"),
-- então nenhuma indicação virava lead. Agora acha o funil e a origem pelo nome e não duplica por telefone.
CREATE OR REPLACE FUNCTION public.create_crm_lead_from_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pipeline_id UUID;
  v_first_stage_id UUID;
  v_origin_id UUID;
  v_company_name TEXT;
  v_notes TEXT;
  v_name TEXT;
  v_phone TEXT;
BEGIN
  SELECT id INTO v_pipeline_id FROM crm_pipelines
  WHERE tenant_id IS NULL AND lower(name) IN ('indicações','indicacoes','indicação','indicacao')
  ORDER BY created_at LIMIT 1;
  IF v_pipeline_id IS NULL THEN
    RAISE WARNING 'create_crm_lead_from_referral: funil Indicações não encontrado';
    RETURN NEW;
  END IF;

  SELECT id INTO v_first_stage_id FROM crm_stages WHERE pipeline_id = v_pipeline_id ORDER BY sort_order ASC LIMIT 1;
  IF v_first_stage_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_origin_id FROM crm_origins
  WHERE is_active = true AND lower(name) IN ('indicações','indicacoes','indicação','indicacao')
  ORDER BY created_at LIMIT 1;

  IF NEW.referrer_company_id IS NOT NULL THEN
    SELECT name INTO v_company_name FROM onboarding_companies WHERE id = NEW.referrer_company_id;
  END IF;

  v_phone := nullif(regexp_replace(coalesce(NEW.referred_phone,''), '\D', '', 'g'), '');

  -- já existe lead com esse telefone no funil de Indicações? não duplica
  IF v_phone IS NOT NULL AND EXISTS (
    SELECT 1 FROM crm_leads l WHERE l.pipeline_id = v_pipeline_id
      AND right(regexp_replace(coalesce(l.phone,''), '\D', '', 'g'), 8) = right(v_phone, 8)
  ) THEN
    RETURN NEW;
  END IF;

  v_name := coalesce(nullif(trim(NEW.referred_name),''), 'Indicado sem nome')
    || ' - Indicação ' || coalesce(nullif(trim(NEW.referrer_name),''), 'não informado')
    || CASE WHEN v_company_name IS NOT NULL THEN ' - ' || v_company_name ELSE '' END;

  v_notes := 'Indicação feita por: ' || coalesce(NEW.referrer_name, 'Não informado');
  IF v_company_name IS NOT NULL THEN v_notes := v_notes || ' (Empresa: ' || v_company_name || ')'; END IF;
  v_notes := v_notes || '. Fonte: ' || CASE WHEN NEW.source = 'nps' THEN 'Pesquisa NPS' ELSE coalesce(NEW.source, 'portal') END;

  INSERT INTO crm_leads (name, phone, pipeline_id, stage_id, origin_id, origin, notes, entered_pipeline_at)
  VALUES (v_name, v_phone, v_pipeline_id, v_first_stage_id, v_origin_id, 'Indicação', v_notes, now());

  RETURN NEW;
END;
$$;
