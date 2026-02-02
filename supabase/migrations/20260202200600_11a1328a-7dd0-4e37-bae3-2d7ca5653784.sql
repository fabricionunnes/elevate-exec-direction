-- Update media_type to support audio and document
-- Since it's a text field, we just need to document the new allowed values
-- No schema change needed, but let's add a comment for clarity

COMMENT ON COLUMN public.whatsapp_campaigns.media_type IS 'Type of media: image, video, audio, or document';