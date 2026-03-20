
ALTER TABLE public.crm_goal_values
  ADD COLUMN IF NOT EXISTS super_meta_bonus_text text,
  ADD COLUMN IF NOT EXISTS super_meta_bonus_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS super_meta_bonus_image_url text,
  ADD COLUMN IF NOT EXISTS hiper_meta_bonus_text text,
  ADD COLUMN IF NOT EXISTS hiper_meta_bonus_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hiper_meta_bonus_image_url text;
