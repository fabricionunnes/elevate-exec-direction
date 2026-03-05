-- Allow client users with admin/gerente roles to manage balloon campaigns
CREATE POLICY "Client admins can insert balloon campaigns"
ON public.endomarketing_balloon_campaigns FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM onboarding_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.project_id = endomarketing_balloon_campaigns.project_id
      AND ou.role IN ('admin'::onboarding_role, 'gerente'::onboarding_role)
  )
);

CREATE POLICY "Client admins can update balloon campaigns"
ON public.endomarketing_balloon_campaigns FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM onboarding_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.project_id = endomarketing_balloon_campaigns.project_id
      AND ou.role IN ('admin'::onboarding_role, 'gerente'::onboarding_role)
  )
);

CREATE POLICY "Client admins can delete balloon campaigns"
ON public.endomarketing_balloon_campaigns FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM onboarding_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.project_id = endomarketing_balloon_campaigns.project_id
      AND ou.role IN ('admin'::onboarding_role, 'gerente'::onboarding_role)
  )
);

-- Allow client users to manage balloon prizes
CREATE POLICY "Client admins can manage balloon prizes"
ON public.endomarketing_balloon_prizes FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM endomarketing_balloon_campaigns bc
    JOIN onboarding_users ou ON ou.project_id = bc.project_id
    WHERE bc.id = endomarketing_balloon_prizes.campaign_id
      AND ou.user_id = auth.uid()
      AND ou.role IN ('admin'::onboarding_role, 'gerente'::onboarding_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM endomarketing_balloon_campaigns bc
    JOIN onboarding_users ou ON ou.project_id = bc.project_id
    WHERE bc.id = endomarketing_balloon_prizes.campaign_id
      AND ou.user_id = auth.uid()
      AND ou.role IN ('admin'::onboarding_role, 'gerente'::onboarding_role)
  )
);

-- Allow client users to manage balloon participants
CREATE POLICY "Client admins can manage balloon participants"
ON public.endomarketing_balloon_participants FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM endomarketing_balloon_campaigns bc
    JOIN onboarding_users ou ON ou.project_id = bc.project_id
    WHERE bc.id = endomarketing_balloon_participants.campaign_id
      AND ou.user_id = auth.uid()
      AND ou.role IN ('admin'::onboarding_role, 'gerente'::onboarding_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM endomarketing_balloon_campaigns bc
    JOIN onboarding_users ou ON ou.project_id = bc.project_id
    WHERE bc.id = endomarketing_balloon_participants.campaign_id
      AND ou.user_id = auth.uid()
      AND ou.role IN ('admin'::onboarding_role, 'gerente'::onboarding_role)
  )
);