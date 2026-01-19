-- Add ownership_type column to client_diagnostics table
ALTER TABLE public.client_diagnostics 
ADD COLUMN ownership_type TEXT;