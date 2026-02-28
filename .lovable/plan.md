

# Integracao Bidirecional com Conta Azul: Criacao, Edicao e Baixa Automatica

## Resumo

Ao criar, editar ou dar baixa em contas a pagar/receber no sistema, os registros serao automaticamente criados, atualizados ou liquidados no Conta Azul via API. Erros na sincronizacao nao bloqueiam a operacao local (apenas exibem aviso).

---

## Funcionalidades

### 1. Criar lancamento no Conta Azul ao criar no sistema
- Quando um novo lancamento (pagar ou receber) for salvo, o sistema verifica se ha integracao ativa com o Conta Azul
- Se ativa, envia os dados para a API do Conta Azul e salva o `conta_azul_id` retornado no registro local

### 2. Atualizar lancamento no Conta Azul ao editar no sistema
- Quando um lancamento existente com `conta_azul_id` for editado, o sistema atualiza o registro correspondente no Conta Azul

### 3. Dar baixa no Conta Azul ao marcar como pago no sistema
- Quando um lancamento for marcado como pago (individual ou em massa), se tiver `conta_azul_id`, o sistema chama a API do Conta Azul para registrar a liquidacao

---

## Detalhes Tecnicos

### 1. Edge Function `conta-azul-oauth/index.ts` -- Novas actions

Adicionar 2 novas actions:

**`create-entry`** -- Cria ou atualiza um lancamento no Conta Azul
- Recebe: `type` ("receivable" ou "payable"), `data` (descricao, valor, vencimento, etc.), `conta_azul_id` (opcional, para update)
- Endpoints:
  - Receber: `POST /v1/financeiro/eventos-financeiros/contas-a-receber`
  - Pagar: `POST /v1/financeiro/eventos-financeiros/contas-a-pagar`
  - Update: `PUT` no mesmo endpoint com o ID
- Retorna o `id` do registro criado/atualizado no Conta Azul

**`confirm-payment`** -- Registra baixa de pagamento no Conta Azul
- Recebe: `conta_azul_id`, `type`, `paid_at`, `paid_amount`
- Endpoints:
  - Receber: `POST .../contas-a-receber/{id}/receber`
  - Pagar: `POST .../contas-a-pagar/{id}/pagar`

Ambas as actions incluem refresh automatico de token se expirado.

### 2. Helper utilitario `syncToContaAzul`

Criar `src/utils/contaAzulSync.ts` com funcoes reutilizaveis:
- `syncEntryToContaAzul(type, data, contaAzulId?)` -- cria ou atualiza
- `syncPaymentToContaAzul(contaAzulId, type, paidAt, paidAmount)` -- registra baixa
- `isContaAzulConnected()` -- verifica se ha integracao ativa

Cada funcao verifica se a integracao esta ativa antes de fazer a chamada, e retorna silenciosamente se nao estiver.

### 3. Integracao nos pontos de criacao/edicao/baixa

**`AllRecurringChargesPage.tsx`**:
- `handleSaveReceivable`: apos insert em `company_invoices`, chamar `syncEntryToContaAzul("receivable", ...)` e salvar o `conta_azul_id` retornado
- `handleSavePayable`: apos insert em `financial_payables`, chamar `syncEntryToContaAzul("payable", ...)` e salvar o `conta_azul_id`
- `handleBulkConfirmPayables`: apos update de status, chamar `syncPaymentToContaAzul` para cada item com `conta_azul_id`

**`ClientReceivablesPanel.tsx`**:
- `handleAdd`: sincronizar apos criar
- `handleEdit`: sincronizar apos editar (se tiver `conta_azul_id`)
- `handleMarkAsPaid`: registrar baixa no Conta Azul

**`ClientPayablesPanel.tsx`**:
- `handleAdd`: sincronizar apos criar
- `handleEdit`: sincronizar apos editar
- `handleMarkAsPaid`: registrar baixa no Conta Azul

### 4. Arquivos modificados/criados

| Arquivo | Acao |
|---|---|
| `supabase/functions/conta-azul-oauth/index.ts` | Adicionar actions `create-entry` e `confirm-payment` |
| `src/utils/contaAzulSync.ts` | Novo -- funcoes helper reutilizaveis |
| `src/pages/onboarding-tasks/AllRecurringChargesPage.tsx` | Integrar sync nos handlers de salvar e baixa |
| `src/components/client-financial/ClientReceivablesPanel.tsx` | Integrar sync nos handlers de criar, editar e baixa |
| `src/components/client-financial/ClientPayablesPanel.tsx` | Integrar sync nos handlers de criar, editar e baixa |

