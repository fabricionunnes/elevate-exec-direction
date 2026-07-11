-- Instagram Login (API nova) não tem página do Facebook — page_id passa a ser opcional.
-- (Era NOT NULL do desenho antigo via Facebook Login e derrubava o salvamento da conta.)
ALTER TABLE public.instagram_instances ALTER COLUMN page_id DROP NOT NULL;
