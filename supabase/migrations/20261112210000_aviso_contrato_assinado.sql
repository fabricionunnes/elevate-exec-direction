-- Aviso "Cliente assinou o contrato" (Fabrício, 12/11/2026): sai na hora pela Central de Avisos,
-- com o link pra assinatura da UNV. Disparado pela edge submit-signature.
insert into public.avisos_config (tipo, titulo, origem, nivel, descricao)
values ('contrato_assinado_cliente', 'Cliente assinou o contrato', 'nexus', 'hora',
        'Quando o cliente assina o contrato. Vai com o link pra assinatura da UNV, se ela ainda faltar.')
on conflict (tipo) do nothing;

-- O texto desse aviso leva o link de assinatura da UNV: na fila, só o master lê essas linhas.
drop policy if exists "staff le avisos_fila" on public.avisos_fila;
create policy "staff le avisos_fila" on public.avisos_fila for select to authenticated
  using (get_current_staff_id() is not null and (tipo <> 'contrato_assinado_cliente' or is_master()));
