-- Add common project variables to onboarding_projects
ALTER TABLE public.onboarding_projects 
ADD COLUMN IF NOT EXISTS churn_risk TEXT CHECK (churn_risk IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS project_complexity TEXT CHECK (project_complexity IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS client_dependency TEXT CHECK (client_dependency IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS current_blockers TEXT,
ADD COLUMN IF NOT EXISTS last_executive_checkpoint DATE,
ADD COLUMN IF NOT EXISTS communication_channel TEXT CHECK (communication_channel IN ('slack', 'whatsapp', 'email')),
ADD COLUMN IF NOT EXISTS current_nps INTEGER CHECK (current_nps >= 0 AND current_nps <= 10),
ADD COLUMN IF NOT EXISTS client_feedback TEXT,
ADD COLUMN IF NOT EXISTS product_variables JSONB DEFAULT '{}'::jsonb;

-- Add comment explaining product_variables structure
COMMENT ON COLUMN public.onboarding_projects.product_variables IS 'Stores product-specific variables as JSON. Structure varies by product_id.';