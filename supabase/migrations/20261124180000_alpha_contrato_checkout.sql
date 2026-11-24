-- Checkout do Mastermind Alpha: dados → contrato assinado → Pix (24/11/2026)
alter table public.alpha_contratacoes
  add column if not exists envelope_id uuid,
  add column if not exists contrato_assinado_em timestamptz;
