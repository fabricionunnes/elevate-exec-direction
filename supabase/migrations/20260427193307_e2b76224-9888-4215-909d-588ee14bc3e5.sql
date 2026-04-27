DROP POLICY IF EXISTS "CRM users can view lead history" ON public.crm_lead_history;

CREATE POLICY "CRM users can view lead history"
ON public.crm_lead_history
FOR SELECT
USING (public.has_crm_access());
