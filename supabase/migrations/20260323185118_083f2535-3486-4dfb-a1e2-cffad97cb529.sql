-- Custom questions per pipeline form
CREATE TABLE public.crm_pipeline_form_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.crm_pipeline_forms(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'open' CHECK (question_type IN ('open', 'closed')),
  options JSONB DEFAULT '[]',
  is_required BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.crm_pipeline_form_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage form questions"
ON public.crm_pipeline_form_questions FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can view active form questions"
ON public.crm_pipeline_form_questions FOR SELECT TO anon
USING (is_active = true);

-- Answers stored per lead
CREATE TABLE public.crm_lead_form_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.crm_pipeline_form_questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.crm_lead_form_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view form answers"
ON public.crm_lead_form_answers FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Anon can insert form answers"
ON public.crm_lead_form_answers FOR INSERT TO anon
WITH CHECK (true);