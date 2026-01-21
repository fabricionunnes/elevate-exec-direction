-- Create table to store daily average health score (excluding simulators)
CREATE TABLE public.daily_average_health_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL UNIQUE,
  average_score NUMERIC(5,2) NOT NULL,
  total_active_companies INTEGER NOT NULL DEFAULT 0,
  healthy_count INTEGER NOT NULL DEFAULT 0,
  attention_count INTEGER NOT NULL DEFAULT 0,
  risk_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX idx_daily_avg_health_date ON public.daily_average_health_scores(snapshot_date DESC);

-- Enable RLS
ALTER TABLE public.daily_average_health_scores ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for dashboard display)
CREATE POLICY "Allow public read access to daily health averages"
ON public.daily_average_health_scores
FOR SELECT
USING (true);

-- Comment on table
COMMENT ON TABLE public.daily_average_health_scores IS 'Stores daily average health scores calculated at 5AM, excluding simulator companies';