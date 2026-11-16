-- UNV Finance: contratação direta pelo QR Code da Mansão (16/11/2026).
-- Uma linha por passagem pela página /finance/contratar. O id é o que a página guarda pra
-- chamar agendar/pix/status (só a função finance-contratar, com service_role, lê e grava).
create table if not exists public.finance_contratacoes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads(id) on delete set null,
  empresa text,
  razao_social text,
  nome text,
  telefone text,
  email text,
  documento text,
  cidade text,
  uf text,
  utm jsonb,
  status text not null default 'dados' check (status in ('dados', 'agendado', 'pix_gerado', 'pago', 'cancelado')),
  reuniao_em timestamptz,
  pix_auth_id text,
  lead_payment_id uuid,
  pix_gerado_em timestamptz,
  fim_contrato date,
  pago_em timestamptz,
  avisado_em timestamptz,
  criado_em timestamptz not null default now()
);

create index if not exists finance_contratacoes_status_idx on public.finance_contratacoes (status, pix_gerado_em);
create index if not exists finance_contratacoes_documento_idx on public.finance_contratacoes (documento, criado_em desc);

alter table public.finance_contratacoes enable row level security;
-- sem policy: só service_role. Tabela nova do Nexus precisa de GRANT explícito.
grant all on public.finance_contratacoes to service_role;

-- Confere a cada 5 min os Pix gerados que ainda não apareceram como pagos (pessoa fechou a página
-- antes de o Pix cair): pago → lead em Fechado e aviso no WhatsApp do Fabrício.
select cron.schedule('finance-contratar-conferir', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/finance-contratar',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{"action":"conferir"}'::jsonb,
    timeout_milliseconds := 30000)
$$);
