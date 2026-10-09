-- Meta de faturamento do mês (painel "gestão à vista" da Yasmim).
alter table yasfood.settings add column if not exists monthly_goal numeric(10,2) not null default 0;
