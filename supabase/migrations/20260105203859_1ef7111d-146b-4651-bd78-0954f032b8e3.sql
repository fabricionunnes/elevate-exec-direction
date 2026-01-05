-- Add SELECT policy for staff members on onboarding_documents
CREATE POLICY "Staff can view documents" 
ON public.onboarding_documents
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os 
    WHERE os.user_id = auth.uid() 
    AND os.is_active = true
  )
);