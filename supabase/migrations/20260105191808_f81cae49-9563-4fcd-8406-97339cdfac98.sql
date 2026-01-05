-- Create table for room access permissions
CREATE TABLE public.virtual_office_room_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.virtual_office_rooms(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(room_id, staff_id)
);

-- Add a column to rooms to indicate if it's restricted (NULL or empty = public to all staff)
ALTER TABLE public.virtual_office_rooms 
ADD COLUMN is_restricted BOOLEAN DEFAULT false;

-- Enable RLS
ALTER TABLE public.virtual_office_room_access ENABLE ROW LEVEL SECURITY;

-- Create policies for room access table
CREATE POLICY "Staff can view their own room access"
ON public.virtual_office_room_access
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage room access"
ON public.virtual_office_room_access
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_room_access_room_id ON public.virtual_office_room_access(room_id);
CREATE INDEX idx_room_access_staff_id ON public.virtual_office_room_access(staff_id);