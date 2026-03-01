

## Melhorias no menu de acoes de Contas a Pagar

### O que sera feito

**1. Opcao "Voltar para Em Aberto" (Reabrir conta)**
- Adicionar no menu de acoes (dropdown) a opcao "Reabrir" para contas com status `paid`, `partial` ou `cancelled`
- Ao clicar, o status volta para `pending`, e os campos `paid_date` e `paid_amount` sao zerados
- Se a conta tinha um banco associado ao pagamento, o saldo do banco sera estornado (devolvido)

**2. Opcao "Excluir" com escolha de escopo**
- Adicionar no menu de acoes a opcao "Excluir"
- Ao clicar, abre um dialog perguntando:
  - **"Somente esta"**: exclui apenas o registro selecionado
  - **"Esta e todas as futuras nao pagas"**: exclui o registro atual e todos os que compartilham o mesmo fornecedor/recorrencia com `installment_number` maior ou igual ao atual e que NAO estejam com status `paid`
- A exclusao e restrita a usuarios com papel `master` (seguindo o padrao ja existente no sistema)

### Detalhes tecnicos

**Arquivos modificados:**
- `src/components/financial/PayablesPanel.tsx`
  - Adicionar funcao `handleReopenPayable(id)` que faz UPDATE do status para `pending` e zera `paid_date`/`paid_amount`, com estorno de saldo bancario se aplicavel
  - Adicionar funcao `handleDeletePayable(payable, scope)` que faz DELETE individual ou em lote (futuras nao pagas)
  - Adicionar `DropdownMenuItem` "Reabrir" (visivel quando status e `paid`, `partial` ou `cancelled`)
  - Adicionar `DropdownMenuItem` "Excluir" (sempre visivel)
  - Adicionar um `AlertDialog` de confirmacao para exclusao com radio de escopo (somente esta / esta e futuras)

