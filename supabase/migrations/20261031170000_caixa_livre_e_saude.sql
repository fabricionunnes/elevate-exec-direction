-- Nem toda conta ativa é caixa da UNV. Fabrício (31/10/2026): "o saldo do UNV
-- Social não é pra somar no caixa da empresa, nem da ademicon que é consórcio",
-- e depois "considere somente o banco asaas".
alter table financial_banks
  add column if not exists fora_do_caixa boolean not null default false;

comment on column financial_banks.fora_do_caixa is
  'Conta que não entra no caixa operacional da UNV: sociedade de terceiro, investimento travado, antecipação de recebível ou conta de passagem.';

update financial_banks set fora_do_caixa = (name <> 'Asaas')
 where is_active and tenant_id is null;

create or replace function caixa_livre_unv()
returns numeric language sql stable security definer set search_path to 'public' as $$
  select coalesce(sum(current_balance_cents), 0) / 100.0
    from financial_banks
   where is_active and tenant_id is null and not fora_do_caixa
$$;
grant execute on function caixa_livre_unv() to authenticated;

-- ponto de partida do acúmulo de caixa do ano
alter table planejamento_anos
  add column if not exists caixa_inicial numeric not null default 0;

update planejamento_anos set caixa_inicial = caixa_livre_unv() where ano = 2027;
