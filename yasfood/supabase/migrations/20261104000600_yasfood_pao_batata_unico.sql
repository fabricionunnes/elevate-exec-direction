-- Um pão de batata só (presunto e queijo); quem quiser sem presunto avisa no pedido.
-- O "Pão de batata Recheado Mussarela" duplicado sai do site (fica inativo, não é apagado).
-- Uma vez só (seeds_aplicadas): se a Yasmim religar depois, o deploy não mexe.
do $$
begin
  if exists (select 1 from yasfood.seeds_aplicadas where key = 'pao_batata_unico_v1') then return; end if;

  update yasfood.products set active = false
  where name ilike 'pão de batata%' and name ilike '%mussarela%' and name not ilike '%presunto%';

  update yasfood.products
  set description = trim(description || ' Prefere sem presunto? É só avisar nas observações do pedido.')
  where name ilike 'pão de batata%presunto%' and description not ilike '%sem presunto%';

  insert into yasfood.seeds_aplicadas (key) values ('pao_batata_unico_v1');
end $$;
