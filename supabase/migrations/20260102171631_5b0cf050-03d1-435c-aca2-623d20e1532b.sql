-- Drop the existing foreign key constraint on user_id to make it optional
ALTER TABLE public.onboarding_task_history
DROP CONSTRAINT IF EXISTS onboarding_task_history_user_id_fkey;

-- Add staff_id column for staff members who make changes
ALTER TABLE public.onboarding_task_history
ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES public.onboarding_staff(id);

-- Add check constraint to ensure at least one of user_id or staff_id is set
ALTER TABLE public.onboarding_task_history
ADD CONSTRAINT history_user_or_staff CHECK (user_id IS NOT NULL OR staff_id IS NOT NULL);

-- Update RLS policy for inserting history - allow staff and project members
DROP POLICY IF EXISTS "Staff can insert task history" ON public.onboarding_task_history;

CREATE POLICY "Project members and staff can insert task history"
ON public.onboarding_task_history
FOR INSERT
WITH CHECK (
  task_id IN (
    SELECT t.id FROM onboarding_tasks t
    WHERE is_onboarding_project_member(t.project_id)
  )
  OR is_onboarding_admin()
);