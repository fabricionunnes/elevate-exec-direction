-- Banner pode ser vídeo (toca mudo em loop no topo do cardápio)
alter table yasfood.banners add column if not exists media_kind text not null default 'image' check (media_kind in ('image','video'));
