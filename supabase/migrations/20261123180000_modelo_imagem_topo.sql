-- Modelo de disparo com imagem no topo (23/11/2026): o link da imagem vai em cada envio.
alter table public.whatsapp_template_status add column if not exists header_image_url text;
comment on column public.whatsapp_template_status.header_image_url is 'Link público da imagem do topo do modelo; o official-campaign-dispatch manda em cada envio';
