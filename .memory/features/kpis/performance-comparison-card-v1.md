# Memory: features/kpis/performance-comparison-card-v1
Updated: 2026-01-28

O card de "Desempenho por" no dashboard de KPIs permite comparar o percentual de atingimento de meta entre diferentes níveis organizacionais:
- **Unidades**: Compara o desempenho de todas as unidades da empresa
- **Setores**: Compara setores, respeitando filtros de unidade ativos
- **Equipes**: Compara equipes, respeitando filtros de unidade e setor
- **Vendedores**: Compara vendedores individuais, respeitando todos os filtros hierárquicos

O componente `PerformanceComparisonCard.tsx` utiliza:
- Dropdown para seleção do tipo de comparação (Unidades, Setores, Equipes, Vendedores)
- Cálculo sempre baseado em **percentual da meta** (não valores absolutos)
- Barras de progresso coloridas por faixa (verde ≥100%, âmbar ≥70%, vermelho <70%)
- Ranking ordenado por percentual de atingimento
- Resumo com média geral e contagem de itens acima da meta

O card usa as tabelas de junção `company_sector_teams` e `company_team_units` para resolver a hierarquia organizacional.
