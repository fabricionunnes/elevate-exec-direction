ALTER TABLE public.public_service_purchases 
ADD COLUMN IF NOT EXISTS user_provisioned boolean DEFAULT false;