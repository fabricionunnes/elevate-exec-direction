-- Contrato assinado pelas duas partes vai em PDF pro grupo de integração (Fabrício, 12/11/2026).
-- Se o envio falhar, a edge finalize-envelope avisa na hora pela Central de Avisos.
insert into public.avisos_config (tipo, titulo, origem, nivel, descricao)
values ('contrato_grupo_falhou', 'Contrato não enviado ao grupo', 'nexus', 'hora',
        'Quando o contrato assinado pelas duas partes não consegue ser enviado em PDF no grupo de integração.')
on conflict (tipo) do nothing;
