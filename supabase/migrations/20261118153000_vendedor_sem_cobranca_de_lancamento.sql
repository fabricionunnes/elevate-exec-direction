-- Vendedor que aparece no ranking mas não é cobrado no "faltou lançar".
-- Caso Agile Save (18/11/2026): a Vivian Borges não lança números no dia a dia, mas as vendas dela
-- entram sozinhas pelo CRM. Com exclude_from_ranking = true ela sumia do ranking mesmo sendo quem
-- mais vendeu no mês. exclude_from_ranking segue valendo pras linhas técnicas (Site, Shopee...).
alter table public.company_salespeople
  add column if not exists exclude_from_launch_check boolean not null default false;

comment on column public.company_salespeople.exclude_from_launch_check is
  'true = fica fora do "lançaram/faltou lançar" do resumo diário da gestão, mas continua no ranking';
