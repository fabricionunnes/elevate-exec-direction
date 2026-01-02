-- Allow AI chat entries by either onboarding user or assigned staff

-- 1) Helper function: is the authenticated staff member assigned to this project?
CREATE OR REPLACE FUNCTION public.is_onboarding_assigned_staff(check_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.onboarding_projects op
    JOIN public.onboarding_companies oc ON oc.id = op.onboarding_company_id
    JOIN public.onboarding_staff os ON os.user_id = auth.uid()
    WHERE op.id = check_project_id
      AND os.is_active = true
      AND (oc.cs_id = os.id OR oc.consultant_id = os.id)
  );
$$;

-- 2) Table changes
ALTER TABLE public.onboarding_ai_chat
  ADD COLUMN IF NOT EXISTS staff_id uuid;

-- Make user_id nullable (so staff messages can exist)
ALTER TABLE public.onboarding_ai_chat
  ALTER COLUMN user_id DROP NOT NULL;

-- Add FK to onboarding_staff
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'onboarding_ai_chat_staff_id_fkey'
  ) THEN
    ALTER TABLE public.onboarding_ai_chat
      ADD CONSTRAINT onboarding_ai_chat_staff_id_fkey
      FOREIGN KEY (staff_id) REFERENCES public.onboarding_staff(id);
  END IF;
END $$;

-- Ensure either user_id OR staff_id is set (never both null)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'onboarding_ai_chat_actor_check'
  ) THEN
    ALTER TABLE public.onboarding_ai_chat
      ADD CONSTRAINT onboarding_ai_chat_actor_check
      CHECK (
        (user_id IS NOT NULL) OR (staff_id IS NOT NULL)
      );
  END IF;
END $$;

-- 3) RLS policy update
ALTER TABLE public.onboarding_ai_chat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members can manage their AI chat" ON public.onboarding_ai_chat;

CREATE POLICY "Project members and assigned staff can manage AI chat"
ON public.onboarding_ai_chat
FOR ALL
USING (
  is_onboarding_project_member(project_id)
  OR is_onboarding_admin()
  OR is_onboarding_assigned_staff(project_id)
)
WITH CHECK (
  (
    is_onboarding_project_member(project_id)
    OR is_onboarding_admin()
    OR is_onboarding_assigned_staff(project_id)
  )
  AND (
    (user_id IS NULL OR user_id IN (
      SELECT ou.id FROM public.onboarding_users ou
      WHERE ou.user_id = auth.uid() AND ou.project_id = onboarding_ai_chat.project_id
    ))
    AND
    (staff_id IS NULL OR staff_id IN (
      SELECT os.id FROM public.onboarding_staff os
      WHERE os.user_id = auth.uid() AND os.is_active = true
    ))
  )
);
