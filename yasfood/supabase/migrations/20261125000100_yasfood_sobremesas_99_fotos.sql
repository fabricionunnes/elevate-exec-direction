-- Sobremesas de R$ 99: fotos novas (maracujá sem base de chocolate, limão só com raspas,
-- chocolate uniforme, danoninho só creme rosa com morangos por cima). Troca a capa e a foto
-- da galeria que ainda estiverem com a versão antiga; não mexe se a Yasmim já trocou no painel.
do $$
declare r record; v_base text := 'https://yasfood.unvholdings.workers.dev/produtos/';
begin
  for r in select * from (values ('mousse-maracuja'), ('mousse-limao'), ('mousse-chocolate'), ('danoninho-morango')) as t(foto) loop
    update yasfood.products set image_url = v_base || r.foto || '-v2.jpg' where image_url = v_base || r.foto || '.jpg';
    update yasfood.product_media set url = v_base || r.foto || '-v2.jpg' where url = v_base || r.foto || '.jpg';
  end loop;
end $$;
