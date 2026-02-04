-- Add 'custom' value to social_stage_type enum for custom stages
ALTER TYPE public.social_stage_type ADD VALUE IF NOT EXISTS 'custom';