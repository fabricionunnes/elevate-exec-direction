-- Adiciona meta de faturamento mensal às metas da Facunicamps
ALTER TABLE facunicamps_metas
  ADD COLUMN IF NOT EXISTS meta_faturamento numeric(12,2) NOT NULL DEFAULT 0;
