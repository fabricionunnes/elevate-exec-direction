
-- Allow project members to view generated images (has project_id)
CREATE POLICY "Project members can view generated images"
  ON public.social_generated_images FOR SELECT
  TO authenticated
  USING (public.is_onboarding_project_member(project_id));

-- Allow project members to view content history (has card_id column)
CREATE POLICY "Project members can view content history"
  ON public.social_content_history FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.social_content_cards c
    JOIN public.social_content_stages s ON s.id = c.stage_id
    JOIN public.social_content_boards b ON b.id = s.board_id
    WHERE c.id = social_content_history.card_id AND public.is_onboarding_project_member(b.project_id)
  ));

-- Allow project members to manage card attachments (has card_id column)
CREATE POLICY "Project members can manage card attachments"
  ON public.social_card_attachments FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.social_content_cards c
    JOIN public.social_content_stages s ON s.id = c.stage_id
    JOIN public.social_content_boards b ON b.id = s.board_id
    WHERE c.id = social_card_attachments.card_id AND public.is_onboarding_project_member(b.project_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.social_content_cards c
    JOIN public.social_content_stages s ON s.id = c.stage_id
    JOIN public.social_content_boards b ON b.id = s.board_id
    WHERE c.id = social_card_attachments.card_id AND public.is_onboarding_project_member(b.project_id)
  ));
