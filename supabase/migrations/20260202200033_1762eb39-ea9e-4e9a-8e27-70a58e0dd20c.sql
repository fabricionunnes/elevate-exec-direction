-- Add media fields to whatsapp_campaigns table
ALTER TABLE public.whatsapp_campaigns 
ADD COLUMN IF NOT EXISTS media_type text,
ADD COLUMN IF NOT EXISTS media_url text,
ADD COLUMN IF NOT EXISTS media_caption text;

-- Add comment for clarity
COMMENT ON COLUMN public.whatsapp_campaigns.media_type IS 'Type of media: image, video, or null for text-only';
COMMENT ON COLUMN public.whatsapp_campaigns.media_url IS 'URL of the uploaded media file in storage';
COMMENT ON COLUMN public.whatsapp_campaigns.media_caption IS 'Caption for the media (optional)';