-- Add DELETE policy for hotseat_responses (admin only)
CREATE POLICY "Admin can delete hotseat responses" 
ON public.hotseat_responses 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff 
    WHERE onboarding_staff.user_id = auth.uid() 
    AND onboarding_staff.is_active = true 
    AND onboarding_staff.role = 'admin'
  )
);

-- Add DELETE policy for hotseat_notes (admin only)
CREATE POLICY "Admin can delete hotseat notes" 
ON public.hotseat_notes 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff 
    WHERE onboarding_staff.user_id = auth.uid() 
    AND onboarding_staff.is_active = true 
    AND onboarding_staff.role = 'admin'
  )
);