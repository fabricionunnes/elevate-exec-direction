-- Reposição por embalagem: quanto vem em cada pacote (g/ml/un) e como ela se chama.
alter table yasfood.ingredients
  add column if not exists pack_size numeric(12,3),           -- ex.: 1000 (g) por pacote de farinha
  add column if not exists pack_label text not null default 'pacote';

-- Compras ligadas ao financeiro
alter table yasfood.stock_movements
  add column if not exists total_cost numeric(10,2),
  add column if not exists transaction_id uuid references yasfood.transactions(id) on delete set null;

-- Chutes iniciais de embalagem pros insumos do seed (ajustáveis no painel)
update yasfood.ingredients set pack_size = 1000 where pack_size is null and name in ('Farinha de trigo','Açúcar','Cenoura');
update yasfood.ingredients set pack_size = 12, pack_label = 'dúzia' where pack_size is null and name = 'Ovos';
update yasfood.ingredients set pack_size = 900, pack_label = 'garrafa' where pack_size is null and name = 'Óleo';
update yasfood.ingredients set pack_size = 100, pack_label = 'lata' where pack_size is null and name = 'Fermento em pó';
update yasfood.ingredients set pack_size = 200 where pack_size is null and name = 'Chocolate em pó';
update yasfood.ingredients set pack_size = 395, pack_label = 'lata' where pack_size is null and name = 'Leite condensado';
update yasfood.ingredients set pack_size = 200, pack_label = 'tablete' where pack_size is null and name = 'Manteiga';
update yasfood.ingredients set pack_size = 1, pack_label = 'unidade' where pack_size is null and name = 'Embalagem com tampa';
