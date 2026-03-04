-- Allow onboarding_users (client admins) to manage campaigns in their project
CREATE POLICY "Users can manage their project campaigns"
ON public.endomarketing_campaigns
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM onboarding_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.project_id = endomarketing_campaigns.project_id
      AND ou.role IN ('admin', 'gerente')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM onboarding_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.project_id = endomarketing_campaigns.project_id
      AND ou.role IN ('admin', 'gerente')
  )
);

-- Allow onboarding_users to manage participants in their project campaigns
CREATE POLICY "Users can manage campaign participants"
ON public.endomarketing_participants
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM endomarketing_campaigns c
    JOIN onboarding_users ou ON ou.project_id = c.project_id
    WHERE c.id = endomarketing_participants.campaign_id
      AND ou.user_id = auth.uid()
      AND ou.role IN ('admin', 'gerente')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM endomarketing_campaigns c
    JOIN onboarding_users ou ON ou.project_id = c.project_id
    WHERE c.id = endomarketing_participants.campaign_id
      AND ou.user_id = auth.uid()
      AND ou.role IN ('admin', 'gerente')
  )
);

-- Allow onboarding_users to manage prizes in their project campaigns
CREATE POLICY "Users can manage campaign prizes"
ON public.endomarketing_prizes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM endomarketing_campaigns c
    JOIN onboarding_users ou ON ou.project_id = c.project_id
    WHERE c.id = endomarketing_prizes.campaign_id
      AND ou.user_id = auth.uid()
      AND ou.role IN ('admin', 'gerente')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM endomarketing_campaigns c
    JOIN onboarding_users ou ON ou.project_id = c.project_id
    WHERE c.id = endomarketing_prizes.campaign_id
      AND ou.user_id = auth.uid()
      AND ou.role IN ('admin', 'gerente')
  )
);