-- 15/10/2026: o card "Resultados dos clientes" do Painel de Controle dava "statement timeout".
-- Sem este índice o "último lançamento" (max(entry_date) por KPI) varria a tabela inteira pra cada
-- cliente sem lançamento: 25 s, contra o limite de 8 s do usuário logado. Com ele, 0,17 s.
-- Já aplicado em produção pela Management API.
create index if not exists idx_kpi_entries_kpi_date on public.kpi_entries (kpi_id, entry_date);
