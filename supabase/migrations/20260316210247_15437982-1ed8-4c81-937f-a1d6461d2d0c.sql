
-- Allow project members (clients) to read stages via board's project
CREATE POLICY "Project members can read content stages"
ON public.social_content_stages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.social_content_boards b
    WHERE b.id = social_content_stages.board_id
    AND public.is_onboarding_project_member(b.project_id)
  )
);

-- Allow project members (clients) to read content cards via board's project
CREATE POLICY "Project members can read content cards"
ON public.social_content_cards
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.social_content_boards b
    WHERE b.id = social_content_cards.board_id
    AND public.is_onboarding_project_member(b.project_id)
  )
);
