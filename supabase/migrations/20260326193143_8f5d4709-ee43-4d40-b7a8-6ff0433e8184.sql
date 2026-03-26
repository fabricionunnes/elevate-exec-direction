
CREATE TABLE public.crm_lead_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  summary_type TEXT NOT NULL, -- 'overview', 'guide', 'followup', 'analysis'
  summary_data JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lead_id, summary_type)
);

ALTER TABLE public.crm_lead_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read lead summaries"
  ON public.crm_lead_summaries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert lead summaries"
  ON public.crm_lead_summaries FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update lead summaries"
  ON public.crm_lead_summaries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_crm_lead_summaries_lead_type ON public.crm_lead_summaries(lead_id, summary_type);
