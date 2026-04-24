
CREATE OR REPLACE FUNCTION public.find_linked_crm_leads(
  _phone_last8 text DEFAULT NULL,
  _email text DEFAULT NULL,
  _document text DEFAULT NULL,
  _lead_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  company text,
  phone text,
  email text,
  document text,
  opportunity_value numeric,
  pipeline_id uuid,
  pipeline_name text,
  stage_id uuid,
  stage_name text,
  stage_color text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.name,
    l.company,
    l.phone,
    l.email,
    l.document,
    l.opportunity_value,
    p.id AS pipeline_id,
    p.name AS pipeline_name,
    s.id AS stage_id,
    s.name AS stage_name,
    s.color AS stage_color,
    l.created_at
  FROM public.crm_leads l
  LEFT JOIN public.crm_pipelines p ON p.id = l.pipeline_id
  LEFT JOIN public.crm_stages s ON s.id = l.stage_id
  WHERE
    public.has_crm_access()
    AND public.tenant_matches(l.tenant_id)
    AND (
      (_lead_id IS NOT NULL AND l.id = _lead_id)
      OR (_phone_last8 IS NOT NULL AND length(_phone_last8) >= 6 AND regexp_replace(coalesce(l.phone,''), '\D', '', 'g') ILIKE '%' || _phone_last8)
      OR (_email IS NOT NULL AND lower(coalesce(l.email,'')) = lower(_email))
      OR (_document IS NOT NULL AND regexp_replace(coalesce(l.document,''), '\D', '', 'g') = _document)
    )
  ORDER BY l.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.find_linked_crm_leads(text, text, text, uuid) TO authenticated;
