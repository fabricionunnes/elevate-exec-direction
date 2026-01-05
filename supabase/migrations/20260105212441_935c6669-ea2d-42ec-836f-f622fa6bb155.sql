-- Add recipient_staff_id for direct messages (null = group/room message, filled = DM)
ALTER TABLE public.virtual_office_messages 
ADD COLUMN IF NOT EXISTS recipient_staff_id UUID REFERENCES public.onboarding_staff(id) ON DELETE SET NULL;

-- Add index for faster DM queries
CREATE INDEX IF NOT EXISTS idx_virtual_office_messages_recipient 
ON public.virtual_office_messages(recipient_staff_id) 
WHERE recipient_staff_id IS NOT NULL;

-- Add composite index for conversation lookup
CREATE INDEX IF NOT EXISTS idx_virtual_office_messages_dm_conversation 
ON public.virtual_office_messages(staff_id, recipient_staff_id, created_at DESC) 
WHERE recipient_staff_id IS NOT NULL;

-- Create table to track unread message counts per user
CREATE TABLE IF NOT EXISTS public.virtual_office_unread (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  from_staff_id UUID REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.virtual_office_rooms(id) ON DELETE CASCADE,
  unread_count INT NOT NULL DEFAULT 0,
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(staff_id, from_staff_id),
  UNIQUE(staff_id, room_id)
);

-- Enable RLS on unread table
ALTER TABLE public.virtual_office_unread ENABLE ROW LEVEL SECURITY;

-- Staff can manage their own unread counts
CREATE POLICY "Staff can manage own unread counts"
ON public.virtual_office_unread
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.id = staff_id AND os.user_id = auth.uid() AND os.is_active = true
  )
);

-- Staff can view unread counts for DMs they're involved in
CREATE POLICY "Staff can view related unread counts"
ON public.virtual_office_unread
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
    AND (os.id = staff_id OR os.id = from_staff_id)
  )
);

-- Update RLS policy for messages to allow DMs
DROP POLICY IF EXISTS "Staff can view messages" ON public.virtual_office_messages;

CREATE POLICY "Staff can view room and DM messages"
ON public.virtual_office_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
    AND (
      -- Room messages
      recipient_staff_id IS NULL
      -- DMs where user is sender or recipient
      OR os.id = staff_id 
      OR os.id = recipient_staff_id
    )
  )
);

-- Enable realtime for unread table
ALTER PUBLICATION supabase_realtime ADD TABLE public.virtual_office_unread;