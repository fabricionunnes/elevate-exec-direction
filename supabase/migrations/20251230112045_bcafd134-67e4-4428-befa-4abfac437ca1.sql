-- Allow authenticated users to insert new companies (for signup flow)
CREATE POLICY "Authenticated users can create companies on signup"
ON public.portal_companies
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow company admin to update their own company
CREATE POLICY "Company admins can update their company"
ON public.portal_companies
FOR UPDATE
TO authenticated
USING (is_portal_company_admin(auth.uid(), id))
WITH CHECK (is_portal_company_admin(auth.uid(), id));