
-- Update the "Staff can manage form responses" policy to include master role
DROP POLICY IF EXISTS "Staff can manage form responses" ON public.culture_form_responses;
CREATE POLICY "Staff can manage form responses" ON public.culture_form_responses
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff os
    WHERE os.user_id = auth.uid()
    AND os.is_active = true
    AND os.role IN ('admin', 'master', 'consultant', 'cs')
  )
);

-- Update the "Staff can view form responses" policy to be explicit about admin and master
DROP POLICY IF EXISTS "Staff can view form responses" ON public.culture_form_responses;
CREATE POLICY "Staff can view form responses" ON public.culture_form_responses
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff os
    WHERE os.user_id = auth.uid()
    AND os.is_active = true
  )
);
