-- Add parent_subtask_id column to support nested subtasks
ALTER TABLE public.social_card_subtasks 
ADD COLUMN parent_subtask_id UUID REFERENCES public.social_card_subtasks(id) ON DELETE CASCADE;

-- Add index for better performance on hierarchical queries
CREATE INDEX idx_social_card_subtasks_parent ON public.social_card_subtasks(parent_subtask_id);
