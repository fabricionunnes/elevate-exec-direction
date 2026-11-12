-- NFS-e avulsa (sem empresa do cadastro) era emitida no gov e não gravava: company_id era obrigatório
-- (Fabrício, 12/11/2026: "Emiti uma NF avulsa e ela não apareceu aqui"; nota 9013, Linked Store).
alter table public.nfse_records alter column company_id drop not null;
select 'ok' r;
