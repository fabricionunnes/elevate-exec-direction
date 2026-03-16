
CREATE TABLE public.hr_whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  notify_on_stage_change BOOLEAN NOT NULL DEFAULT true,
  notify_phone TEXT,
  notify_group_jid TEXT,
  message_template TEXT DEFAULT 'O candidato {candidate_name} avançou para a etapa "{stage_name}" na vaga "{job_title}".',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

ALTER TABLE public.hr_whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage hr_whatsapp_config"
  ON public.hr_whatsapp_config
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
