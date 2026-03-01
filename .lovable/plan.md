
## Corrigir baixa parcial em Contas a Pagar

### Problema
Quando uma conta a pagar recebe um pagamento parcial, o sistema apresenta dois problemas:
1. O status "partial" nao e reconhecido visualmente -- o badge nao exibe "Pago Parcial" corretamente
2. Apos um pagamento parcial, a opcao "Marcar como Pago" desaparece, impedindo o usuario de dar baixa no valor restante
3. O dialogo de pagamento sempre pre-preenche com o valor total, em vez do valor restante

### Solucao

**1. Adicionar status "partial" no badge de status (PayablesPanel.tsx)**
- Incluir um case `"partial"` no `getStatusBadge` exibindo "Pago Parcial" com cor amarela/amber
- Garantir que contas com status "partial" aparecem no filtro (adicionar opcao "Pago Parcial" no Select de filtro)

**2. Permitir nova baixa em contas parcialmente pagas (PayablesPanel.tsx)**
- Alterar a condicao da linha 808 de `payable.status !== "paid"` para `payable.status !== "paid" && payable.status !== "cancelled"` -- na verdade, a condicao atual ja permite "partial" pois `"partial" !== "paid"` e true. O problema real e se o status foi salvo como "paid" incorretamente. Vamos adicionar uma condicao explicita: mostrar o botao quando status for "partial"

**3. Pre-preencher valor restante no dialogo (PayableActionDialogs.tsx)**
- No `useEffect` do `PayablePaymentDialog`, ao abrir para uma conta com status "partial", calcular o restante: `payable.amount - (payable.paid_amount || 0)` e pre-preencher com esse valor
- Exibir informacao do valor ja pago no cabecalho do dialogo

**4. Acumular pagamentos parciais (PayableActionDialogs.tsx)**
- No `handleSave`, ao registrar um novo pagamento em conta ja parcialmente paga, somar o `paid_amount` existente ao novo valor pago
- Se o total acumulado atingir ou ultrapassar o valor original, marcar como "paid"; caso contrario, manter como "partial"
- Debitar do banco apenas o novo valor pago (nao o acumulado)

### Arquivos modificados
- `src/components/financial/PayablesPanel.tsx` -- badge "Pago Parcial", filtro, condicao do botao de acao
- `src/components/financial/PayableActionDialogs.tsx` -- logica de valor restante e acumulacao de pagamentos
