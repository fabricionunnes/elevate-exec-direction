-- Allow reading diagnostic responses (for admin page)
CREATE POLICY "Allow read diagnostic responses" 
ON public.client_diagnostics 
FOR SELECT 
USING (true);

-- Allow updating diagnostic responses (for status changes)
CREATE POLICY "Allow update diagnostic responses" 
ON public.client_diagnostics 
FOR UPDATE 
USING (true);