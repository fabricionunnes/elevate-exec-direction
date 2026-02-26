
Objetivo imediato: corrigir de forma definitiva o problema de link em **Faturas** para que ele seja o mesmo padrão funcional do menu **Links**, inclusive em navegação pública/privada.

Diagnóstico (com base no código e dados atuais)
1) Existem dois fluxos de link diferentes:
- Menu “Links”: usa registros reais da tabela `payment_links` (funciona).
- Faturas: hoje monta URL com `link_id` = `company_invoices.id` dentro de `generate-invoices` (não é o mesmo identificador de `payment_links`).

2) O checkout sempre tenta resolver `link_id` buscando em `payment_links`.
- Quando o `link_id` vem de fatura (ID da invoice), essa busca falha e entra fallback.
- Isso cria comportamento inconsistente e explica “um link funciona e outro não”.

3) Há dados legados no banco com formato antigo `/checkout?...` (sem `/#/checkout`), que também causam erro em alguns cenários públicos.

4) Além disso, atualização de status de fatura no backend está acoplada a `payment_link_id` como se fosse `company_invoices.id`, o que conflita com o modelo de links reais.

Plano de implementação (execução em sequência)
1. Unificar a fonte de verdade do link de cobrança
- Regra nova: toda fatura deve apontar para um registro real em `payment_links`.
- `company_invoices.payment_link_id` passa a guardar o `payment_links.id` correspondente.
- `company_invoices.payment_link_url` passa a ser sempre o mesmo `url` salvo no `payment_links`.

2. Corrigir geração automática de parcelas no backend (`generate-invoices`)
- Nos fluxos `action=generate` e `action=auto_renew`:
  - criar faturas;
  - para cada fatura criada, criar também um `payment_links` correspondente;
  - gerar URL pública padrão `.../#/checkout?...`;
  - atualizar tanto `payment_links.url` quanto `company_invoices.payment_link_id/payment_link_url`.
- Isso garante que o link mostrado em Faturas exista no mesmo sistema de links do menu “Links”.

3. Corrigir criação de fatura manual
- Após inserir fatura manual no `CompanyInvoicesList`, criar o `payment_links` correspondente e preencher `payment_link_id/payment_link_url`.
- Resultado: fatura manual também abre checkout público sem divergência.

4. Corrigir processamento de pagamento (checkout + webhook)
- Em `pagarme-checkout` e `pagarme-webhook`, ao marcar fatura como paga:
  - trocar filtro de atualização de `company_invoices` de `id = payment_link_id` para `payment_link_id = payment_link_id`.
- Mantém conciliação automática e evita quebra de baixa automática.

5. Blindagem no frontend de checkout (`CheckoutPage`)
- Manter fallback por query params (amount/product etc.), mas:
  - quando `link_id` não existir em `payment_links`, não tratar esse `link_id` inválido como referência interna de pagamento.
- Evita enviar referência errada para o backend.

6. Backfill imediato dos dados já existentes (sem esperar novas faturas)
- Executar rotina de correção para faturas antigas:
  - criar `payment_links` para invoices que ainda não têm `payment_link_id`;
  - regravar `payment_link_url` no formato canônico `/#/checkout?...`;
  - normalizar casos antigos `/checkout?...`.
- Assim o problema é resolvido também para links já emitidos.

Validação (obrigatória, ponta a ponta)
1) Gerar uma recorrência nova e abrir:
- link em “Cobranças Recorrentes”,
- link em “Faturas”,
- link público da fatura (`/#/fatura?token=...` -> botão pagar).
Todos devem abrir checkout público corretamente.

2) Testar em janela privada/incógnita:
- abrir link de Fatura e link do menu Links;
- confirmar que ambos funcionam sem login.

3) Testar pagamento real (preferencialmente PIX de teste):
- confirmar criação de pedido sem erro,
- confirmar atualização da fatura para paga,
- confirmar que aparece corretamente no painel de recebimentos.

4) Regressão:
- conferir que links antigos corrigidos também abrem.

Impacto esperado
- Fim da divergência entre “Faturas” e “Links”.
- Links públicos estáveis em qualquer navegador.
- Conciliação de pagamento consistente (pedido ↔ fatura).

Risco e mitigação
- Risco: duplicidade de links durante backfill.
- Mitigação: checar `company_invoices.payment_link_id` antes de criar novo link e rodar backfill idempotente (seguro para reexecução).
