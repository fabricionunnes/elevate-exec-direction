-- Create table for weekly executive reports
CREATE TABLE public.ceo_weekly_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  report_data JSONB NOT NULL DEFAULT '{}',
  classification TEXT CHECK (classification IN ('good', 'neutral', 'critical')),
  classification_reason TEXT,
  ceo_notes TEXT,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(week_start)
);

-- Enable RLS
ALTER TABLE public.ceo_weekly_reports ENABLE ROW LEVEL SECURITY;

-- Create policies for CEO access only
CREATE POLICY "CEO can view weekly reports" 
ON public.ceo_weekly_reports 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND email = 'fabricio@universidadevendas.com.br'
  )
);

CREATE POLICY "CEO can insert weekly reports" 
ON public.ceo_weekly_reports 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND email = 'fabricio@universidadevendas.com.br'
  )
);

CREATE POLICY "CEO can update weekly reports" 
ON public.ceo_weekly_reports 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND email = 'fabricio@universidadevendas.com.br'
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_ceo_weekly_reports_updated_at
BEFORE UPDATE ON public.ceo_weekly_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();