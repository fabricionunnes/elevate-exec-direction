-- Add INSERT policy for staff members on onboarding_documents
CREATE POLICY "Staff can insert documents" 
ON public.onboarding_documents 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

-- Also add UPDATE and DELETE policies for staff
CREATE POLICY "Staff can delete documents" 
ON public.onboarding_documents 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);