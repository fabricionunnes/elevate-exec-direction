insert into planejamento_anos (ano, titulo, observacao) values
  (2027, 'Planejamento Estrategico 2027', 'Receita de R$ 2.265.168 e lucro de R$ 557.051, com R$ 519.051 distribuiveis. Aprovado em 31/10/2026.')
on conflict (ano) do update set titulo = excluded.titulo, observacao = excluded.observacao;
delete from planejamento_linhas where ano = 2027;
insert into planejamento_linhas (ano, grupo, linha, fonte, unidade, ordem, valores, observacao) values
  (2027, 'receita', 'Consultoria comercial', 'receita_consultoria', 'brl', 10, array[82216.00,86589.89,93361.58,101571.15,110956.79,121394.57,132817.19,145186.59,158481.80,172692.76,187816.70,203856.00]::numeric[], 'Sales Acceleration e Partners; ticket de R$ 1.912 para R$ 2.192'),
  (2027, 'receita', 'Mastermind Alpha', 'receita_mastermind', 'brl', 20, array[0.00,15000.00,22500.00,30000.00,30000.00,30000.00,30000.00,30000.00,30000.00,30000.00,30000.00,30000.00]::numeric[], '20 vagas a R$ 1.500, turma fecha em fevereiro'),
  (2027, 'receita', 'UNV Ads', 'receita_ads', 'brl', 30, array[7098.00,7794.79,8859.50,10128.34,11551.07,13100.41,14758.72,16513.53,18355.39,20276.92,22272.12,24336.00]::numeric[], 'de 7 para 24 clientes; teto do Weslley e 25'),
  (2027, 'receita', 'UNV Social', 'receita_social', 'brl', 40, array[1984.00,2384.99,2997.69,3727.88,4546.62,5438.22,6392.54,7402.38,8462.32,9568.11,10716.29,11904.00]::numeric[], 'de 2 para 12 clientes; nao consome vaga de consultor'),
  (2027, 'receita', 'Eventos e palestras', 'receita_eventos', 'brl', 50, array[3000.00,3000.00,8000.00,3000.00,8000.00,3000.00,12000.00,3000.00,8000.00,3000.00,8000.00,2000.00]::numeric[], '4 Mansoes, 1 Imersao, 4 Mesas e palestras pagas'),
  (2027, 'receita', 'CRM', 'receita_crm', 'brl', 60, array[396.00,716.14,1205.32,1788.29,2441.96,3153.81,3915.72,4721.96,5568.21,6451.06,7367.75,8316.00]::numeric[], 'embutido na proposta nova'),
  (2027, 'custo', 'Pessoal', 'custo_pessoal', 'brl', 10, array[38500.00,38500.00,38500.00,38500.00,38500.00,38500.00,38500.00,38500.00,38500.00,38500.00,38500.00,38500.00]::numeric[], 'pro-labore e encargos'),
  (2027, 'custo', 'Administrativas', 'custo_admin', 'brl', 20, array[16500.00,16500.00,16500.00,16500.00,16500.00,16500.00,16500.00,16500.00,16500.00,16500.00,16500.00,16500.00]::numeric[], 'aluguel, software, contabilidade'),
  (2027, 'custo', 'Imposto corrente', 'custo_imposto', 'brl', 30, array[19185.00,23397.42,27740.82,30433.69,33934.78,35675.23,40496.53,41902.64,46368.60,49026.94,53926.62,56811.47]::numeric[], 'Simples Anexo V, 20,26% efetivo; provisionar no dia do recebimento'),
  (2027, 'custo', 'Comissao dos consultores', 'custo_comissao', 'brl', 40, array[11796.86,12505.76,13600.57,14923.64,16430.90,18100.81,19921.15,21884.50,23986.31,26223.83,28595.54,31100.80]::numeric[], 'piso R$ 2.000 + 7,4% entrega + 7,4% venda por 12 meses'),
  (2027, 'custo', 'Trafego', 'custo_trafego', 'brl', 50, array[4000.00,4000.00,4000.00,8000.00,8000.00,8000.00,14000.00,14000.00,14000.00,20000.00,20000.00,20000.00]::numeric[], 'so sobe por gatilho: R$ 4k, 8k, 14k, 20k'),
  (2027, 'custo', 'Custo do Mastermind', null, 'brl', 60, array[0.00,7100.00,7100.00,7100.00,12080.00,7100.00,7100.00,7100.00,7100.00,12080.00,7100.00,7100.00]::numeric[], 'encontro mensal na casa; kart em maio e outubro'),
  (2027, 'custo', 'Repasse da socia na UNV Social', null, 'brl', 70, array[992.00,1192.49,1498.85,1863.94,2273.31,2719.11,3196.27,3701.19,4231.16,4784.06,5358.15,5952.00]::numeric[], '50% da receita de Social para a Carol'),
  (2027, 'custo', 'Parcelamento do passivo', null, 'brl', 80, array[3222.08,3222.08,3222.08,3222.08,3222.08,3222.08,3222.08,3222.08,3222.08,3222.08,3222.08,3222.08]::numeric[], 'R$ 152.600,45 em 60x; trocar pelo valor real quando a contadora confirmar'),
  (2027, 'custo', 'Filantropia', null, 'brl', 90, array[946.94,1154.86,1369.24,1502.16,1674.96,1760.87,1998.84,2068.24,2288.68,2419.89,2661.73,2804.12]::numeric[], '1% da receita do mes; destinacao a definir ate 31/jan'),
  (2027, 'custo', 'Custo dos eventos', null, 'brl', 100, array[0.00,500.00,2000.00,0.00,2500.00,0.00,5000.00,500.00,2000.00,0.00,2500.00,0.00]::numeric[], 'Mansao R$ 2.000, Imersao R$ 5.000, Mesa R$ 500'),
  (2027, 'custo', 'Comissao de indicacao', null, 'brl', 110, array[500.00,500.00,500.00,1000.00,1000.00,1000.00,1000.00,1000.00,1000.00,1000.00,1000.00,500.00]::numeric[], 'R$ 500 por indicacao fechada; meta de 20 no ano'),
  (2027, 'reserva', 'Reserva de emergencia', null, 'brl', 10, array[1500.00,1500.00,1500.00,1500.00,3000.00,3000.00,3000.00,3000.00,5000.00,5000.00,5000.00,5000.00]::numeric[], 'conta separada, sem cartao; so para quebra de receita acima de 20%'),
  (2027, 'indicador', 'Clientes de consultoria', 'qtd_clientes_ativos', 'qtd', 10, array[43.00,45.00,48.00,52.00,56.00,60.00,65.00,70.00,76.00,81.00,87.00,93.00]::numeric[], 'de 43 para 93; o realizado conta as empresas ativas hoje que ja existiam no mes, entao nao enxerga quem entrou e saiu dentro do ano'),
  (2027, 'indicador', 'Contratos novos no mes', null, 'qtd', 20, array[5.50,5.50,6.00,7.00,8.00,9.00,10.00,11.00,12.00,13.00,14.00,14.00]::numeric[], 'de 5,5 para 14');
-- receita 2,265,053 | custos 1,708,108


update planejamento_linhas set acumulacao = 'ultimo' where ano = 2027 and fonte = 'qtd_clientes_ativos';

update planejamento_linhas set formula = 'pct_receita', formula_pct = 20.26
 where ano = 2027 and fonte = 'custo_imposto';
update planejamento_linhas set formula = 'pct_receita', formula_pct = 1
 where ano = 2027 and linha = 'Filantropia';
