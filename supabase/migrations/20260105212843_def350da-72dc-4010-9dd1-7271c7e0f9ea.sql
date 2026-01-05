-- Create table to track message reads (for both DMs and group chats)
CREATE TABLE public.virtual_office_message_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.virtual_office_messages(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, staff_id)
);

-- Enable RLS
ALTER TABLE public.virtual_office_message_reads ENABLE ROW LEVEL SECURITY;

-- Policy: staff can view reads for messages they have access to
CREATE POLICY "Staff can view message reads"
  ON public.virtual_office_message_reads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff os
      WHERE os.user_id = auth.uid() AND os.is_active = true
    )
  );

-- Policy: staff can insert their own reads
CREATE POLICY "Staff can mark messages as read"
  ON public.virtual_office_message_reads
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.onboarding_staff os
      WHERE os.user_id = auth.uid() AND os.is_active = true AND os.id = staff_id
    )
  );

-- Enable realtime for message reads
ALTER PUBLICATION supabase_realtime ADD TABLE public.virtual_office_message_reads;

-- Add index for faster queries
CREATE INDEX idx_message_reads_message_id ON public.virtual_office_message_reads(message_id);
CREATE INDEX idx_message_reads_staff_id ON public.virtual_office_message_reads(staff_id);