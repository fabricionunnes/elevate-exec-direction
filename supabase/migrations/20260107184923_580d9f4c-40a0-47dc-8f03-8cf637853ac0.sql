-- Fix foreign keys for company_kpis and company_salespeople deletion

-- 1. endomarketing_campaigns: change kpi_id from RESTRICT to SET NULL
ALTER TABLE public.endomarketing_campaigns 
DROP CONSTRAINT endomarketing_campaigns_kpi_id_fkey;

ALTER TABLE public.endomarketing_campaigns
ADD CONSTRAINT endomarketing_campaigns_kpi_id_fkey 
FOREIGN KEY (kpi_id) REFERENCES public.company_kpis(id) ON DELETE SET NULL;

-- Make kpi_id nullable if not already
ALTER TABLE public.endomarketing_campaigns 
ALTER COLUMN kpi_id DROP NOT NULL;

-- 2. gamification_scoring_rules: already SET NULL, ok

-- 3. gamification_badges: already SET NULL, ok  

-- 4. gamification_missions: already SET NULL, ok

-- 5. endomarketing_snapshots: change from SET NULL to CASCADE or keep SET NULL
-- Keeping as is since SET NULL is appropriate for historical data

-- Note: kpi_entries, gamification_participants, endomarketing_participants, gamification_team_members
-- all have CASCADE which is correct for dependent data