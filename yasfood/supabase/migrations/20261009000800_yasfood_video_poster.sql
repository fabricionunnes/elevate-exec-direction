-- Pôster (frame) do vídeo, gerado no envio, pra aparecer antes do play no celular
alter table yasfood.product_media add column if not exists poster_url text;
