
CREATE TABLE public.crm_goal_commission_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_value_id uuid REFERENCES public.crm_goal_values(id) ON DELETE CASCADE NOT NULL,
  min_percent numeric NOT NULL DEFAULT 0,
  max_percent numeric NOT NULL DEFAULT 100,
  commission_value numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.crm_goal_commission_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CRM admins can manage commission tiers"
ON public.crm_goal_commission_tiers
FOR ALL
TO authenticated
USING (public.is_crm_admin())
WITH CHECK (public.is_crm_admin());

CREATE POLICY "CRM staff can view commission tiers"
ON public.crm_goal_commission_tiers
FOR SELECT
TO authenticated
USING (public.has_crm_access());
