-- Create table for chat advisor leads
CREATE TABLE public.chat_advisor_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_services JSONB,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_advisor_leads ENABLE ROW LEVEL SECURITY;

-- Anyone can create a lead (public chat)
CREATE POLICY "Anyone can create chat lead"
ON public.chat_advisor_leads
FOR INSERT
WITH CHECK (true);

-- Anyone can update their own lead (by id, for continuing conversation)
CREATE POLICY "Anyone can update chat lead"
ON public.chat_advisor_leads
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Admins can view all leads
CREATE POLICY "Admins can view chat leads"
ON public.chat_advisor_leads
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete leads
CREATE POLICY "Admins can delete chat leads"
ON public.chat_advisor_leads
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_chat_advisor_leads_updated_at
BEFORE UPDATE ON public.chat_advisor_leads
FOR EACH ROW
EXECUTE FUNCTION portal_update_updated_at();