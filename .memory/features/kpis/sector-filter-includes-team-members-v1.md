# Memory: features/kpis/sector-filter-includes-team-members-v1
Updated: 2026-01-28

O filtro por Setor no dashboard de KPIs agora inclui vendedores que pertencem a equipes vinculadas ao setor selecionado, não apenas aqueles com `sector_id` diretamente definido. O sistema utiliza a tabela de junção `company_sector_teams` para determinar quais equipes pertencem a cada setor, e filtra vendedores considerando:
1. Match direto: vendedor possui `sector_id` igual ao setor selecionado
2. Match via equipe: vendedor pertence a uma equipe (`team_id`) que está associada ao setor na tabela `company_sector_teams`

Esta lógica foi implementada em:
- `KPIDashboardTab.tsx`: função `salespersonBelongsToSector()` e mapa `teamIdsBySectorId`
- `SalespeopleComparisonTable.tsx`: mesma lógica replicada para filtrar vendedores na tabela comparativa
