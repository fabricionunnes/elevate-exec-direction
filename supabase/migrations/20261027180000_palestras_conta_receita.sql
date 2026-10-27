-- Venda em funil "Palestras" conta como venda comercial (Fabrício, 27/10/2026: "teve uma venda hoje,
-- de 6 mil, da Rosiane, e não foi somada no dashboard"). A regra por nome excluía
-- 'evento|mansão|palestra'; o funil Palestras é comercial (lead que veio de palestra e fecha serviço,
-- counts_for_goals = true). Eventos e Mansão continuam fora.
do $$
declare f record; def text;
begin
  for f in select p.oid, p.proname from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('crm_visao_geral','crm_visao_geral_uf','crm_visao_geral_janela','painel_ao_vivo_interno','crm_cliente_match')
  loop
    def := pg_get_functiondef(f.oid);
    if position('''evento|mans[ãa]o|palestra''' in def) > 0 then
      execute replace(def, '''evento|mans[ãa]o|palestra''', '''evento|mans[ãa]o''');
      raise notice 'ajustada: %', f.proname;
    end if;
  end loop;
end $$;
