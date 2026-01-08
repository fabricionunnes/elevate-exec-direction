
-- CSAT Configuration per project
CREATE TABLE public.csat_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  send_type TEXT DEFAULT 'automatic' CHECK (send_type IN ('automatic', 'manual')),
  send_timing TEXT DEFAULT 'immediate' CHECK (send_timing IN ('immediate', '1_hour', '1_day')),
  main_question TEXT DEFAULT 'De 1 a 5, o quanto você ficou satisfeito com a reunião de hoje?',
  scale_min INTEGER DEFAULT 1,
  scale_max INTEGER DEFAULT 5,
  open_question TEXT DEFAULT 'O que podemos melhorar?',
  link_reusable BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id)
);

-- CSAT Surveys generated per meeting
CREATE TABLE public.csat_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES public.onboarding_meeting_notes(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.onboarding_tasks(id) ON DELETE SET NULL,
  access_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'waiting', 'responded', 'expired')),
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(meeting_id)
);

-- CSAT Responses from clients
CREATE TABLE public.csat_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id UUID NOT NULL REFERENCES public.csat_surveys(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES public.onboarding_meeting_notes(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  feedback TEXT,
  respondent_name TEXT,
  responded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(survey_id)
);

-- Enable RLS
ALTER TABLE public.csat_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csat_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for csat_configs
CREATE POLICY "Staff can view CSAT configs" ON public.csat_configs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Admin/CS can manage CSAT configs" ON public.csat_configs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'cs'))
  );

-- RLS Policies for csat_surveys
CREATE POLICY "Staff can view CSAT surveys" ON public.csat_surveys
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Staff can manage CSAT surveys" ON public.csat_surveys
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

-- RLS Policies for csat_responses
CREATE POLICY "Staff can view CSAT responses" ON public.csat_responses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.onboarding_staff WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Anyone can insert CSAT responses via token" ON public.csat_responses
  FOR INSERT WITH CHECK (true);

-- Trigger to update updated_at
CREATE TRIGGER update_csat_configs_updated_at
  BEFORE UPDATE ON public.csat_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_csat_surveys_updated_at
  BEFORE UPDATE ON public.csat_surveys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle meeting finalization and create CSAT task
CREATE OR REPLACE FUNCTION public.handle_meeting_finalized()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config RECORD;
  v_project RECORD;
  v_company RECORD;
  v_survey_id UUID;
  v_task_id UUID;
  v_due_date DATE;
BEGIN
  -- Only trigger when meeting is marked as finalized
  IF NEW.is_finalized = true AND (OLD.is_finalized IS NULL OR OLD.is_finalized = false) THEN
    
    -- Check if CSAT config exists and is active
    SELECT * INTO v_config
    FROM public.csat_configs
    WHERE project_id = NEW.project_id AND is_active = true;
    
    IF v_config.id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Check if survey already exists for this meeting
    IF EXISTS (SELECT 1 FROM public.csat_surveys WHERE meeting_id = NEW.id) THEN
      RETURN NEW;
    END IF;
    
    -- Get project and company info
    SELECT p.*, c.name as company_name, c.cs_id, c.consultant_id
    INTO v_project
    FROM public.onboarding_projects p
    LEFT JOIN public.onboarding_companies c ON c.id = p.onboarding_company_id
    WHERE p.id = NEW.project_id;
    
    -- Calculate due date based on timing
    CASE v_config.send_timing
      WHEN 'immediate' THEN v_due_date := CURRENT_DATE;
      WHEN '1_hour' THEN v_due_date := CURRENT_DATE;
      WHEN '1_day' THEN v_due_date := CURRENT_DATE + 1;
      ELSE v_due_date := CURRENT_DATE;
    END CASE;
    
    -- Create CSAT survey
    INSERT INTO public.csat_surveys (project_id, meeting_id)
    VALUES (NEW.project_id, NEW.id)
    RETURNING id INTO v_survey_id;
    
    -- Create task for CS if automatic
    IF v_config.send_type = 'automatic' THEN
      INSERT INTO public.onboarding_tasks (
        project_id,
        title,
        description,
        priority,
        status,
        due_date,
        responsible_staff_id,
        tags,
        sort_order
      ) VALUES (
        NEW.project_id,
        '[CSAT] Enviar pesquisa – ' || COALESCE(v_project.company_name, v_project.product_name),
        'Enviar pesquisa de satisfação CSAT para o cliente após a reunião: ' || COALESCE(NEW.title, 'Reunião') || ' realizada em ' || to_char(COALESCE(NEW.meeting_date, CURRENT_DATE), 'DD/MM/YYYY'),
        'high',
        'pending',
        v_due_date,
        COALESCE(v_project.cs_id, v_project.consultant_id),
        ARRAY['csat'],
        0
      ) RETURNING id INTO v_task_id;
      
      -- Update survey with task reference
      UPDATE public.csat_surveys SET task_id = v_task_id WHERE id = v_survey_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for meeting finalization
CREATE TRIGGER on_meeting_finalized
  AFTER UPDATE ON public.onboarding_meeting_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_meeting_finalized();

-- Function to update survey and task status when response is received
CREATE OR REPLACE FUNCTION public.handle_csat_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update survey status
  UPDATE public.csat_surveys
  SET status = 'responded', updated_at = now()
  WHERE id = NEW.survey_id;
  
  -- Update related task to completed
  UPDATE public.onboarding_tasks
  SET status = 'completed', updated_at = now()
  WHERE id = (SELECT task_id FROM public.csat_surveys WHERE id = NEW.survey_id);
  
  RETURN NEW;
END;
$$;

-- Create trigger for CSAT response
CREATE TRIGGER on_csat_response
  AFTER INSERT ON public.csat_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_csat_response();

-- Enable realtime for CSAT tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.csat_responses;
