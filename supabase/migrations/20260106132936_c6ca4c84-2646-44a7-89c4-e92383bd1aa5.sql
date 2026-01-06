-- Create a table to store chat notifications that persist for offline users
CREATE TABLE IF NOT EXISTS public.virtual_office_chat_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  sender_staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.virtual_office_messages(id) ON DELETE CASCADE,
  room_id UUID REFERENCES public.virtual_office_rooms(id) ON DELETE SET NULL,
  is_dm BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_chat_notifications_recipient ON public.virtual_office_chat_notifications(recipient_staff_id, is_read);
CREATE INDEX idx_chat_notifications_created ON public.virtual_office_chat_notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.virtual_office_chat_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can only see their own notifications
CREATE POLICY "Users can view their own chat notifications"
ON public.virtual_office_chat_notifications
FOR SELECT
USING (
  recipient_staff_id IN (
    SELECT id FROM public.onboarding_staff WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own chat notifications"
ON public.virtual_office_chat_notifications
FOR UPDATE
USING (
  recipient_staff_id IN (
    SELECT id FROM public.onboarding_staff WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Staff can insert chat notifications"
ON public.virtual_office_chat_notifications
FOR INSERT
WITH CHECK (
  sender_staff_id IN (
    SELECT id FROM public.onboarding_staff WHERE user_id = auth.uid()
  )
);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.virtual_office_chat_notifications;