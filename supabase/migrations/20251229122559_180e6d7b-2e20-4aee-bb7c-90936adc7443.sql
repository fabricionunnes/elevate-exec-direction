-- Allow admins to delete client diagnostics
CREATE POLICY "Admins can delete diagnostic responses"
ON public.client_diagnostics
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));