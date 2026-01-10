-- Drop existing incorrect policies
DROP POLICY IF EXISTS "Users can view strategies from their company plans" ON public.portal_strategies;
DROP POLICY IF EXISTS "Users can insert strategies to their company plans" ON public.portal_strategies;
DROP POLICY IF EXISTS "Users can update strategies from their company plans" ON public.portal_strategies;
DROP POLICY IF EXISTS "Users can delete strategies from their company plans" ON public.portal_strategies;

-- Recreate policies with correct user_id check
CREATE POLICY "Users can view strategies from their company plans" 
ON public.portal_strategies 
FOR SELECT 
USING (
  plan_id IN (
    SELECT pp.id FROM portal_plans pp
    JOIN portal_users pu ON pu.company_id = pp.company_id
    WHERE pu.user_id = auth.uid()
  )
  OR public.is_portal_admin_unv(auth.uid())
);

CREATE POLICY "Users can insert strategies to their company plans" 
ON public.portal_strategies 
FOR INSERT 
WITH CHECK (
  plan_id IN (
    SELECT pp.id FROM portal_plans pp
    JOIN portal_users pu ON pu.company_id = pp.company_id
    WHERE pu.user_id = auth.uid()
  )
  OR public.is_portal_admin_unv(auth.uid())
);

CREATE POLICY "Users can update strategies from their company plans" 
ON public.portal_strategies 
FOR UPDATE 
USING (
  plan_id IN (
    SELECT pp.id FROM portal_plans pp
    JOIN portal_users pu ON pu.company_id = pp.company_id
    WHERE pu.user_id = auth.uid()
  )
  OR public.is_portal_admin_unv(auth.uid())
);

CREATE POLICY "Users can delete strategies from their company plans" 
ON public.portal_strategies 
FOR DELETE 
USING (
  plan_id IN (
    SELECT pp.id FROM portal_plans pp
    JOIN portal_users pu ON pu.company_id = pp.company_id
    WHERE pu.user_id = auth.uid()
  )
  OR public.is_portal_admin_unv(auth.uid())
);