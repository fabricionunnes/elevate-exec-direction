
CREATE POLICY "Project members can manage their content boards"
  ON public.social_content_boards FOR ALL
  TO authenticated
  USING (public.is_onboarding_project_member(project_id))
  WITH CHECK (public.is_onboarding_project_member(project_id));
