-- Add column to track if session was created by client (true) or staff (false)
ALTER TABLE public.client_board_sessions 
ADD COLUMN created_by_client BOOLEAN NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.client_board_sessions.created_by_client IS 'true = created by client user, false = created by staff (admin/cs/consultant)';