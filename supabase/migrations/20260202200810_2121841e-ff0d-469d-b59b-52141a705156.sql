-- Drop existing policies that allow broad access
DROP POLICY IF EXISTS "Admins and masters can manage campaigns" ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS "Clients access own campaigns" ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS "Staff can view campaigns" ON public.whatsapp_campaigns;
DROP POLICY IF EXISTS "Staff manage all campaigns" ON public.whatsapp_campaigns;

-- Create new policies that isolate campaigns by creator

-- Users can only SELECT their own campaigns
CREATE POLICY "Users can view their own campaigns" 
ON public.whatsapp_campaigns
FOR SELECT
USING (created_by = auth.uid());

-- Users can only INSERT campaigns for themselves
CREATE POLICY "Users can create their own campaigns" 
ON public.whatsapp_campaigns
FOR INSERT
WITH CHECK (created_by = auth.uid());

-- Users can only UPDATE their own campaigns
CREATE POLICY "Users can update their own campaigns" 
ON public.whatsapp_campaigns
FOR UPDATE
USING (created_by = auth.uid());

-- Users can only DELETE their own campaigns
CREATE POLICY "Users can delete their own campaigns" 
ON public.whatsapp_campaigns
FOR DELETE
USING (created_by = auth.uid());

-- Also update whatsapp_campaign_recipients to follow the same isolation
DROP POLICY IF EXISTS "Admins and masters can manage recipients" ON public.whatsapp_campaign_recipients;
DROP POLICY IF EXISTS "Clients access own recipients" ON public.whatsapp_campaign_recipients;
DROP POLICY IF EXISTS "Staff can view recipients" ON public.whatsapp_campaign_recipients;
DROP POLICY IF EXISTS "Staff manage all recipients" ON public.whatsapp_campaign_recipients;

-- Recipients follow campaign ownership
CREATE POLICY "Users can view recipients of their own campaigns"
ON public.whatsapp_campaign_recipients
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.whatsapp_campaigns wc
    WHERE wc.id = whatsapp_campaign_recipients.campaign_id
    AND wc.created_by = auth.uid()
  )
);

CREATE POLICY "Users can insert recipients to their own campaigns"
ON public.whatsapp_campaign_recipients
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.whatsapp_campaigns wc
    WHERE wc.id = whatsapp_campaign_recipients.campaign_id
    AND wc.created_by = auth.uid()
  )
);

CREATE POLICY "Users can update recipients of their own campaigns"
ON public.whatsapp_campaign_recipients
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.whatsapp_campaigns wc
    WHERE wc.id = whatsapp_campaign_recipients.campaign_id
    AND wc.created_by = auth.uid()
  )
);

CREATE POLICY "Users can delete recipients of their own campaigns"
ON public.whatsapp_campaign_recipients
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.whatsapp_campaigns wc
    WHERE wc.id = whatsapp_campaign_recipients.campaign_id
    AND wc.created_by = auth.uid()
  )
);