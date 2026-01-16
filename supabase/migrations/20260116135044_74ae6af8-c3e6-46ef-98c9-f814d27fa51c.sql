-- Add group_session_id to link multiple candidates in a group interview
ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS group_session_id UUID;

-- Create index for efficient lookup of group interviews
CREATE INDEX IF NOT EXISTS idx_interviews_group_session ON public.interviews(group_session_id) WHERE group_session_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.interviews.group_session_id IS 'Groups multiple interview records into a single group interview session';