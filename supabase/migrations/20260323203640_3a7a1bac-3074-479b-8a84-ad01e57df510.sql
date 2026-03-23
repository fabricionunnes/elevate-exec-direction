
-- Function to create a CRM lead from a client referral
CREATE OR REPLACE FUNCTION public.create_crm_lead_from_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_first_stage_id UUID;
  v_origin_id UUID;
  v_company_name TEXT;
  v_notes TEXT;
BEGIN
  -- Get the first stage of the "Indicação" pipeline (sort_order ASC)
  SELECT id INTO v_first_stage_id
  FROM crm_stages
  WHERE pipeline_id = 'f1b9d320-30b1-432d-b6cf-bcd8aa55ceb2'
  ORDER BY sort_order ASC
  LIMIT 1;

  -- Get the "Indicação" origin
  SELECT id INTO v_origin_id
  FROM crm_origins
  WHERE name = 'Indicação' AND is_active = true
  LIMIT 1;

  -- Get the referrer company name
  IF NEW.referrer_company_id IS NOT NULL THEN
    SELECT name INTO v_company_name
    FROM onboarding_companies
    WHERE id = NEW.referrer_company_id;
  END IF;

  -- Build notes with referrer info
  v_notes := 'Indicação feita por: ' || COALESCE(NEW.referrer_name, 'Não informado');
  IF v_company_name IS NOT NULL THEN
    v_notes := v_notes || ' (Empresa: ' || v_company_name || ')';
  END IF;

  -- Only create if we have the pipeline stage
  IF v_first_stage_id IS NOT NULL THEN
    INSERT INTO crm_leads (
      name,
      phone,
      pipeline_id,
      stage_id,
      origin_id,
      origin,
      notes,
      entered_pipeline_at
    ) VALUES (
      NEW.referred_name,
      NEW.referred_phone,
      'f1b9d320-30b1-432d-b6cf-bcd8aa55ceb2',
      v_first_stage_id,
      v_origin_id,
      'Indicação',
      v_notes,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on client_referrals
CREATE TRIGGER create_lead_on_referral
AFTER INSERT ON public.client_referrals
FOR EACH ROW
EXECUTE FUNCTION public.create_crm_lead_from_referral();
