-- Add crm_lead_id column to public_service_purchases
ALTER TABLE public.public_service_purchases 
ADD COLUMN IF NOT EXISTS crm_lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_public_service_purchases_crm_lead_id 
ON public.public_service_purchases(crm_lead_id);

-- Insert the pipeline and stages via a DO block (idempotent)
DO $$
DECLARE
  v_pipeline_id uuid;
BEGIN
  -- Check if pipeline already exists
  SELECT id INTO v_pipeline_id 
  FROM public.crm_pipelines 
  WHERE name = 'Módulos Extras' 
  LIMIT 1;

  IF v_pipeline_id IS NULL THEN
    INSERT INTO public.crm_pipelines (name, description, is_default, is_active)
    VALUES ('Módulos Extras', 'Pipeline automático para leads das páginas de venda de módulos extras', false, true)
    RETURNING id INTO v_pipeline_id;

    -- Stage 1: Novos Leads
    INSERT INTO public.crm_stages (pipeline_id, name, sort_order, is_final, final_type, color)
    VALUES (v_pipeline_id, 'Novos Leads', 1, false, NULL, '#3B82F6');

    -- Stage 2: Ganho (won)
    INSERT INTO public.crm_stages (pipeline_id, name, sort_order, is_final, final_type, color)
    VALUES (v_pipeline_id, 'Ganho', 2, true, 'won', '#22C55E');

    -- Stage 3: Perdido (lost)
    INSERT INTO public.crm_stages (pipeline_id, name, sort_order, is_final, final_type, color)
    VALUES (v_pipeline_id, 'Perdido', 3, true, 'lost', '#EF4444');

    RAISE NOTICE 'Pipeline "Módulos Extras" created with id: %', v_pipeline_id;
  ELSE
    RAISE NOTICE 'Pipeline "Módulos Extras" already exists with id: %', v_pipeline_id;
  END IF;
END;
$$;