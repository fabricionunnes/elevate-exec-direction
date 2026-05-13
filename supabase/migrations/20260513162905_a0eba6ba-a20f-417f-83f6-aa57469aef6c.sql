
CREATE OR REPLACE FUNCTION public.create_lead_from_mastermind_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pipeline_id uuid;
  v_pipeline_name text;
  v_stage_id uuid;
  v_owner_id uuid;
  v_origin_id uuid;
  v_notes text;
  v_lead_id uuid;
  v_clean_phone text;
  v_existing uuid;
BEGIN
  SELECT id, name INTO v_pipeline_id, v_pipeline_name
  FROM public.crm_pipelines
  WHERE is_active = true AND name ILIKE '%MasterMind UNV%'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_pipeline_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_stage_id
  FROM public.crm_stages
  WHERE pipeline_id = v_pipeline_id
  ORDER BY sort_order ASC
  LIMIT 1;

  IF v_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Dedup por telefone no pipeline nas últimas 24h
  v_clean_phone := regexp_replace(coalesce(NEW.phone,''), '\D', '', 'g');
  IF length(v_clean_phone) >= 8 THEN
    SELECT id INTO v_existing
    FROM public.crm_leads
    WHERE pipeline_id = v_pipeline_id
      AND created_at > now() - interval '24 hours'
      AND (phone = NEW.phone OR phone = v_clean_phone OR phone ILIKE '%' || right(v_clean_phone, 8) || '%')
    LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT id INTO v_owner_id
  FROM public.onboarding_staff
  WHERE is_active = true AND role IN ('master','admin')
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT id INTO v_origin_id
  FROM public.crm_origins
  WHERE name ILIKE '%mastermind%' OR name ILIKE '%aplicação%' OR name ILIKE '%landing%'
  ORDER BY created_at ASC
  LIMIT 1;

  v_notes := concat_ws(' | ',
    'Origem: Mastermind Application',
    CASE WHEN NEW.role IS NOT NULL THEN 'Cargo: ' || NEW.role ELSE NULL END,
    CASE WHEN NEW.monthly_revenue IS NOT NULL THEN 'Faturamento: ' || NEW.monthly_revenue ELSE NULL END,
    CASE WHEN NEW.company_age IS NOT NULL THEN 'Tempo empresa: ' || NEW.company_age ELSE NULL END,
    CASE WHEN NEW.employees_count IS NOT NULL THEN 'Funcionários: ' || NEW.employees_count ELSE NULL END,
    CASE WHEN NEW.salespeople_count IS NOT NULL THEN 'Vendedores: ' || NEW.salespeople_count ELSE NULL END,
    CASE WHEN NEW.aware_of_investment IS NOT NULL THEN 'Investimento: ' || NEW.aware_of_investment ELSE NULL END
  );

  INSERT INTO public.crm_leads (
    name, phone, email, company, main_pain, notes, urgency,
    pipeline_id, stage_id, owner_staff_id, origin_id,
    entered_pipeline_at, stage_entered_at
  ) VALUES (
    NEW.full_name, NEW.phone, NEW.email, NEW.company,
    NEW.main_challenge, v_notes, 'high',
    v_pipeline_id, v_stage_id, v_owner_id, v_origin_id,
    now(), now()
  )
  RETURNING id INTO v_lead_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'create_lead_from_mastermind_application failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mastermind_application_to_lead ON public.mastermind_applications;
CREATE TRIGGER trg_mastermind_application_to_lead
AFTER INSERT ON public.mastermind_applications
FOR EACH ROW
EXECUTE FUNCTION public.create_lead_from_mastermind_application();
