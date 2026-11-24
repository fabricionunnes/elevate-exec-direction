-- Mastermind Alpha no site (24/11/2026): aplicação em unvholdings.com.br/masteralpha e checkout
-- com Pix Automático em /masteralpha/contratar (função alpha-contratar).
-- Regra do Fabrício: toda aplicação entra no funil Mastermind Alpha na etapa "Aplicação preenchida" (criada por ele no CRM);
-- quem fatura menos de R$ 100 mil por mês ganha a etiqueta "Faturamento baixo" (a pessoa não é avisada).

-- Etapa "Aplicação preenchida" (465386ef-3bc3-4687-aa07-701bc322e320) criada pelo Fabrício no CRM.

insert into public.crm_tags (id, name, color, is_active)
values ('a1fa0000-0000-4000-8000-0000000a1f52', 'Faturamento baixo', '#64748b', true)
on conflict (id) do nothing;

-- Respostas da aplicação (o lead guarda o resumo nas notas)
create table if not exists public.alpha_aplicacoes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads(id) on delete set null,
  nome text, telefone text, email text, empresa text, segmento text, cidade text,
  faturamento text, faturamento_min numeric, vendedores text, desafio text,
  qualificado boolean not null default false,
  utm jsonb, criado_em timestamptz not null default now()
);

-- Checkout: dados contratuais e Pix Automático (mesmo desenho de finance_contratacoes)
create table if not exists public.alpha_contratacoes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads(id) on delete set null,
  empresa text, razao_social text, nome text, telefone text, email text, documento text, cidade text, uf text,
  utm jsonb, status text not null default 'dados',
  pix_auth_id text, lead_payment_id uuid, pix_gerado_em timestamptz, primeiro_debito date, fim_contrato date,
  pago_em timestamptz, avisado_em timestamptz, criado_em timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['alpha_aplicacoes','alpha_contratacoes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
grant select on public.alpha_aplicacoes, public.alpha_contratacoes to authenticated;
drop policy if exists alpha_aplicacoes_staff on public.alpha_aplicacoes;
create policy alpha_aplicacoes_staff on public.alpha_aplicacoes for select to authenticated using (public.is_staff_admin_or_master());
drop policy if exists alpha_contratacoes_staff on public.alpha_contratacoes;
create policy alpha_contratacoes_staff on public.alpha_contratacoes for select to authenticated using (public.is_staff_admin_or_master());

-- Confere a cada 5 minutos os Pix gerados que ainda não apareceram como pagos
select cron.unschedule(jobid) from cron.job where jobname = 'alpha-contratar-conferir';
select cron.schedule('alpha-contratar-conferir', '*/5 * * * *', $c$
  select net.http_post(
    url := 'https://xrncvhzxjmddqluxoosu.supabase.co/functions/v1/alpha-contratar',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{"action":"conferir"}'::jsonb,
    timeout_milliseconds := 30000)
$c$);

notify pgrst, 'reload schema';
