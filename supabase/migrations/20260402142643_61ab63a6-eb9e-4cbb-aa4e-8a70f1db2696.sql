CREATE POLICY "Managers can delete salaries"
ON public.staff_salaries
FOR DELETE
TO authenticated
USING (has_nf_manage_permission());