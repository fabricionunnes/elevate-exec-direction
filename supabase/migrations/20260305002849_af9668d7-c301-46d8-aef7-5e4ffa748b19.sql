
CREATE OR REPLACE FUNCTION public.update_company_segment(p_company_id uuid, p_segment text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE onboarding_companies 
  SET segment = p_segment, updated_at = now() 
  WHERE id = p_company_id;
END;
$$;
