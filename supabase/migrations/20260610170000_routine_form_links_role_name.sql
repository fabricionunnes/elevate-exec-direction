-- Formulário de rotina por cargo: cada link público pode ser vinculado a um cargo
ALTER TABLE public.routine_form_links
  ADD COLUMN IF NOT EXISTS role_name text;
