-- Add due_date column to social_card_subtasks for delivery date sorting
ALTER TABLE public.social_card_subtasks 
ADD COLUMN IF NOT EXISTS due_date timestamp with time zone DEFAULT NULL;

-- Add index for efficient sorting
CREATE INDEX IF NOT EXISTS idx_social_card_subtasks_due_date 
ON public.social_card_subtasks(due_date);