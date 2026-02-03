
-- Add policy to allow staff with CRM access to view all CRM permissions
-- This is needed so SDRs can see other staff with CRM access for calendar scheduling

CREATE POLICY "Staff with CRM access can view CRM permissions" 
ON public.staff_menu_permissions 
FOR SELECT 
USING (
  menu_key = 'crm' 
  AND public.has_crm_access()
);
