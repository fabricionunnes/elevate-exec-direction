
-- Drop the previous policy that only checked onboarding_users
DROP POLICY IF EXISTS "Users can manage their project campaigns" ON public.endomarketing_campaigns;
DROP POLICY IF EXISTS "Users can manage campaign participants" ON public.endomarketing_participants;
DROP POLICY IF EXISTS "Users can manage campaign prizes" ON public.endomarketing_prizes;

-- Recreate policy allowing BOTH staff AND onboarding_users (admin/gerente)
CREATE POLICY "Staff and users can manage campaigns"
ON public.endomarketing_campaigns
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM onboarding_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.project_id = endomarketing_campaigns.project_id
      AND ou.role IN ('admin', 'gerente')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM onboarding_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.project_id = endomarketing_campaigns.project_id
      AND ou.role IN ('admin', 'gerente')
  )
);

CREATE POLICY "Staff and users can manage participants"
ON public.endomarketing_participants
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM endomarketing_campaigns c
    JOIN onboarding_users ou ON ou.project_id = c.project_id
    WHERE c.id = endomarketing_participants.campaign_id
      AND ou.user_id = auth.uid()
      AND ou.role IN ('admin', 'gerente')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM endomarketing_campaigns c
    JOIN onboarding_users ou ON ou.project_id = c.project_id
    WHERE c.id = endomarketing_participants.campaign_id
      AND ou.user_id = auth.uid()
      AND ou.role IN ('admin', 'gerente')
  )
);

CREATE POLICY "Staff and users can manage prizes"
ON public.endomarketing_prizes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM endomarketing_campaigns c
    JOIN onboarding_users ou ON ou.project_id = c.project_id
    WHERE c.id = endomarketing_prizes.campaign_id
      AND ou.user_id = auth.uid()
      AND ou.role IN ('admin', 'gerente')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
  OR
  EXISTS (
    SELECT 1 FROM endomarketing_campaigns c
    JOIN onboarding_users ou ON ou.project_id = c.project_id
    WHERE c.id = endomarketing_prizes.campaign_id
      AND ou.user_id = auth.uid()
      AND ou.role IN ('admin', 'gerente')
  )
);
