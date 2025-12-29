-- Allow admins to delete closer diagnostics
CREATE POLICY "Admins can delete closer diagnostics"
ON public.closer_diagnostics
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));