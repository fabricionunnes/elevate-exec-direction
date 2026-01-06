-- Create announcements table
CREATE TABLE public.onboarding_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_role TEXT NOT NULL CHECK (target_role IN ('cs', 'consultant', 'all')),
  created_by UUID NOT NULL REFERENCES public.onboarding_staff(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL
);

-- Create acknowledgments table
CREATE TABLE public.onboarding_announcement_acks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.onboarding_announcements(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.onboarding_staff(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(announcement_id, staff_id)
);

-- Enable RLS
ALTER TABLE public.onboarding_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_announcement_acks ENABLE ROW LEVEL SECURITY;

-- RLS policies for announcements
CREATE POLICY "Staff can view active announcements for their role"
ON public.onboarding_announcements
FOR SELECT
TO authenticated
USING (
  is_active = true AND
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
    AND (target_role = 'all' OR target_role = os.role OR os.role = 'admin')
  )
);

CREATE POLICY "Admins can insert announcements"
ON public.onboarding_announcements
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.role = 'admin' AND os.is_active = true
  )
);

CREATE POLICY "Admins can update their announcements"
ON public.onboarding_announcements
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.role = 'admin' AND os.is_active = true
  )
);

-- RLS policies for acknowledgments
CREATE POLICY "Staff can view acknowledgments"
ON public.onboarding_announcement_acks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.is_active = true
  )
);

CREATE POLICY "Staff can acknowledge announcements"
ON public.onboarding_announcement_acks
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.onboarding_staff os
    WHERE os.user_id = auth.uid() AND os.id = staff_id AND os.is_active = true
  )
);

-- Enable realtime for immediate delivery
ALTER PUBLICATION supabase_realtime ADD TABLE public.onboarding_announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.onboarding_announcement_acks;

-- Create notification trigger for acknowledgments
CREATE OR REPLACE FUNCTION public.notify_announcement_acknowledged()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_announcement RECORD;
  v_staff_name TEXT;
BEGIN
  -- Get announcement info
  SELECT a.*, s.name as creator_name
  INTO v_announcement
  FROM public.onboarding_announcements a
  JOIN public.onboarding_staff s ON s.id = a.created_by
  WHERE a.id = NEW.announcement_id;

  -- Get acknowledger name
  SELECT name INTO v_staff_name
  FROM public.onboarding_staff
  WHERE id = NEW.staff_id;

  -- Notify the creator
  INSERT INTO public.onboarding_notifications (
    staff_id,
    type,
    title,
    message,
    reference_id,
    reference_type
  ) VALUES (
    v_announcement.created_by,
    'announcement_ack',
    '✅ Comunicado lido',
    v_staff_name || ' marcou como ciente o comunicado: ' || v_announcement.title,
    NEW.announcement_id,
    'announcement'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_announcement_acknowledged
AFTER INSERT ON public.onboarding_announcement_acks
FOR EACH ROW
EXECUTE FUNCTION public.notify_announcement_acknowledged();