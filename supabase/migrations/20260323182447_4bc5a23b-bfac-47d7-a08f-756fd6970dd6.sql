
-- Add UTM tracking columns to crm_leads
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS utm_campaign text;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS utm_content text;

-- Create pipeline forms table
CREATE TABLE public.crm_pipeline_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  form_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex') UNIQUE,
  title text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  custom_fields jsonb DEFAULT '[]'::jsonb,
  origin_name text DEFAULT 'Formulário Público',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pipeline_id)
);

ALTER TABLE public.crm_pipeline_forms ENABLE ROW LEVEL SECURITY;

-- Staff can manage forms
CREATE POLICY "Staff can manage pipeline forms" ON public.crm_pipeline_forms
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
