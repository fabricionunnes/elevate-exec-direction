-- Create churn_predictions table
CREATE TABLE public.churn_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  prediction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  churn_probability NUMERIC(5,2) NOT NULL CHECK (churn_probability >= 0 AND churn_probability <= 100),
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  risk_factors JSONB DEFAULT '[]'::jsonb,
  recommended_actions TEXT[] DEFAULT '{}',
  estimated_risk_window TEXT CHECK (estimated_risk_window IN ('30_days', '60_days', '90_days')),
  ai_analysis TEXT,
  health_score_at_prediction NUMERIC(5,2),
  nps_at_prediction NUMERIC(4,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, prediction_date)
);

-- Enable RLS
ALTER TABLE public.churn_predictions ENABLE ROW LEVEL SECURITY;

-- Create policies for staff access
CREATE POLICY "Staff can view all churn predictions"
ON public.churn_predictions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Staff can insert churn predictions"
ON public.churn_predictions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Staff can update churn predictions"
ON public.churn_predictions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff
    WHERE user_id = auth.uid()
  )
);

-- Create index for faster queries
CREATE INDEX idx_churn_predictions_project_id ON public.churn_predictions(project_id);
CREATE INDEX idx_churn_predictions_prediction_date ON public.churn_predictions(prediction_date DESC);
CREATE INDEX idx_churn_predictions_risk_level ON public.churn_predictions(risk_level);

-- Create trigger for updated_at
CREATE TRIGGER update_churn_predictions_updated_at
BEFORE UPDATE ON public.churn_predictions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for churn_predictions
ALTER PUBLICATION supabase_realtime ADD TABLE public.churn_predictions;