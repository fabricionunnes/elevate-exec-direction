insert into planejamento_anos (ano, titulo, observacao, caixa_inicial) values
  (2026, 'Retrato de 2026', 'Jan a abril não têm dado: o sistema só registra recebimento desde maio. De maio a outubro o planejado é a receita que de fato entrou com o custo que caberia para fechar com 15% de resultado, para mostrar o tamanho do excesso de cada mês. Novembro e dezembro são plano de verdade.', 0)
on conflict (ano) do update set titulo = excluded.titulo, observacao = excluded.observacao;
delete from planejamento_linhas where ano = 2026;
insert into planejamento_linhas (ano, grupo, linha, fonte, unidade, ordem, acumulacao, valores, observacao) values
  (2026,'receita','Consultoria comercial','receita_consultoria','brl',10,'soma',array[0.00,0.00,0.00,0.00,29352.47,90411.77,70288.83,60905.27,63883.81,46323.44,33160.80,34144.80]::numeric[],'sem dado de janeiro a abril; maio a outubro é o realizado com custo ajustado para 15% de resultado; novembro e dezembro é plano'),
  (2026,'receita','UNV Ads','receita_ads','brl',20,'soma',array[0.00,0.00,0.00,0.00,1500.00,2750.00,3035.00,1235.00,1235.00,285.00,3235.20,3331.20]::numeric[],'sem dado de janeiro a abril; maio a outubro é o realizado com custo ajustado para 15% de resultado; novembro e dezembro é plano'),
  (2026,'receita','UNV Social','receita_social','brl',30,'soma',array[0.00,0.00,0.00,0.00,2000.00,10031.00,6100.00,2949.01,0.00,950.00,2426.40,2498.40]::numeric[],'sem dado de janeiro a abril; maio a outubro é o realizado com custo ajustado para 15% de resultado; novembro e dezembro é plano'),
  (2026,'receita','Eventos e palestras','receita_eventos','brl',40,'soma',array[0.00,0.00,0.00,0.00,0.00,1764.68,3640.91,5685.46,6066.71,3050.09,9000.00,7000.00]::numeric[],'sem dado de janeiro a abril; maio a outubro é o realizado com custo ajustado para 15% de resultado; novembro e dezembro é plano'),
  (2026,'receita','CRM','receita_crm','brl',50,'soma',array[0.00,0.00,0.00,0.00,0.00,0.00,2500.00,350.00,598.78,884.81,1617.60,1665.60]::numeric[],'sem dado de janeiro a abril; maio a outubro é o realizado com custo ajustado para 15% de resultado; novembro e dezembro é plano'),
  (2026,'receita','Treinamentos','receita_treinamento','brl',60,'soma',array[0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,2185.00,2185.00,0.00,0.00]::numeric[],'sem dado de janeiro a abril; maio a outubro é o realizado com custo ajustado para 15% de resultado; novembro e dezembro é plano'),
  (2026,'receita','Recuperação de inadimplência',null,'brl',70,'soma',array[0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,8000.00,6000.00]::numeric[],'Dos R$ 25.851 vencidos, meta de recuperar R$ 8.000 em novembro e R$ 6.000 em dezembro. Não é venda nova: é caixa que já era da empresa.'),
  (2026,'custo','Folha','custo_pessoal','brl',10,'soma',array[0.00,0.00,0.00,0.00,7294.09,62765.06,50708.32,42748.74,46110.28,22116.00,43574.00,43574.00]::numeric[],'sem dado de janeiro a abril; maio a outubro é o realizado com custo ajustado para 15% de resultado; novembro e dezembro é plano'),
  (2026,'custo','Administrativas','custo_admin','brl',20,'soma',array[0.00,0.00,0.00,0.00,1810.19,14576.68,10564.03,8230.00,6701.31,4791.30,7000.00,7000.00]::numeric[],'sem dado de janeiro a abril; maio a outubro é o realizado com custo ajustado para 15% de resultado; novembro e dezembro é plano'),
  (2026,'custo','Tráfego','custo_trafego','brl',30,'soma',array[0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,4000.00,4000.00]::numeric[],'sem dado de janeiro a abril; maio a outubro é o realizado com custo ajustado para 15% de resultado; novembro e dezembro é plano'),
  (2026,'custo','Comerciais','custo_comercial','brl',40,'soma',array[0.00,0.00,0.00,0.00,300.00,3585.34,6466.16,3189.14,4897.13,7483.07,2000.00,2000.00]::numeric[],'sem dado de janeiro a abril; maio a outubro é o realizado com custo ajustado para 15% de resultado; novembro e dezembro é plano'),
  (2026,'custo','Imposto','custo_imposto','brl',50,'soma',array[0.00,0.00,0.00,0.00,0.00,166.76,0.00,0.00,0.00,0.00,1913.00,1555.00]::numeric[],'sem dado de janeiro a abril; maio a outubro é o realizado com custo ajustado para 15% de resultado; novembro e dezembro é plano'),
  (2026,'custo','Financeiras','custo_financeiro','brl',60,'soma',array[0.00,0.00,0.00,0.00,1054.99,7688.38,4817.74,4899.41,4.98,0.00,0.00,0.00]::numeric[],'sem dado de janeiro a abril; maio a outubro é o realizado com custo ajustado para 15% de resultado; novembro e dezembro é plano'),
  (2026,'custo','Sem categoria','custo_outros','brl',70,'soma',array[0.00,0.00,0.00,0.00,0.00,0.00,0.00,1005.44,153.68,89.51,0.00,0.00]::numeric[],'sem dado de janeiro a abril; maio a outubro é o realizado com custo ajustado para 15% de resultado; novembro e dezembro é plano'),
  (2026,'custo','Investimentos','custo_investimento','brl',80,'soma',array[0.00,0.00,0.00,0.00,0.00,431.61,173.78,383.30,499.86,0.00,0.00,0.00]::numeric[],'sem dado de janeiro a abril; maio a outubro é o realizado com custo ajustado para 15% de resultado; novembro e dezembro é plano');
-- Ano que não tem dado desde janeiro: 2026 só registra recebimento a partir de
-- maio, e mostrar zero nos quatro primeiros meses seria dado falso.
alter table planejamento_anos
  add column if not exists mes_inicial integer not null default 1
  check (mes_inicial between 1 and 12);

update planejamento_anos set mes_inicial = 5,
  observacao = 'O sistema só registra recebimento a partir de maio de 2026, então o ano começa em maio. De maio a outubro o planejado é a receita que de fato entrou com o custo que caberia para fechar com 15% de resultado: a diferença mostra o excesso de cada mês. Novembro e dezembro são plano de verdade, a partir do que já está lançado.'
 where ano = 2026;
