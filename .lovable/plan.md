

## Plano: Importação Histórica das Planilhas no Financeiro

### Contexto

As planilhas são do sistema antigo (Conta Azul) e precisam ser importadas nas tabelas corretas:
- **Contas a Receber** → tabela `company_invoices` (~99 registros, todos do financeiro principal da empresa)
- **Contas a Pagar** → tabela `financial_payables` (~2.571 registros)

Estas são as tabelas usadas na página de Recorrências (`/onboarding-tasks/financeiro/recorrencias`), e **não** as tabelas `client_financial_*` que são per-project.

### Regras de importação

1. **Saldos bancários não serão alterados** — inserção direta, sem trigger de saldo
2. **Deduplicação para Recebíveis**: `client_name + due_date + amount + description` — se já existir, pula
3. **Contas a pagar em atraso**: mantidas como `pending` (o sistema já trata como vencido pela data)
4. **Status mapping**:
   - "Quitado" → `paid`
   - "Atrasado" → `pending` (com due_date no passado = overdue automaticamente)
   - "Quitado parcial" → `partial`

### Implementação

Criarei uma **edge function** temporária `import-historical-data` que:

1. **Recebe** os dados já processados (hardcoded no código da function, parseados das planilhas)
2. **Para cada recebível** (`company_invoices`):
   - Busca `company_id` na tabela `onboarding_companies` pelo nome do cliente
   - Se não achar, usa `custom_receiver_name`
   - Checa duplicata antes de inserir
   - Mapeia: `amount_cents` (valor * 100), `paid_amount_cents`, `due_date`, `status`, `description`, `notes`, `payment_method`, `bank_id`
3. **Para cada conta a pagar** (`financial_payables`):
   - Mapeia: `supplier_name`, `amount`, `due_date`, `status`, `paid_amount`, `paid_date`, `description`, `notes`, `payment_method`, `category_id`, `cost_center_id`
4. **Bancos** que não existem (Itaú, Greenn, Santander) serão criados na `financial_banks`
5. **Retorna** relatório: inseridos, duplicados ignorados, erros

### Mapeamento de campos

**Contas a Receber (company_invoices)**:
```text
Planilha                    → DB
Nome do cliente             → company_id (busca) ou custom_receiver_name
Descrição                   → description
Valor original (R$)         → amount_cents (x100)
Valor recebido (R$)         → paid_amount_cents (x100)
Data de vencimento          → due_date
Data último pagamento       → paid_at
Situação                    → status (paid/pending/partial)
Forma de recebimento        → payment_method
Conta bancária              → bank_id
Observações                 → notes
Categoria 1                 → category_id (match por nome)
Centro de Custo 1           → cost_center_id (match por nome)
```

**Contas a Pagar (financial_payables)**:
```text
Planilha                    → DB
Nome do fornecedor          → supplier_name
Descrição                   → description
Valor original (R$)         → amount
Valor pago (R$)             → paid_amount
Data de vencimento          → due_date
Data último pagamento       → paid_date
Situação                    → status
Forma de pagamento          → payment_method
Conta bancária              → bank_id
Observações                 → notes
Categoria 1                 → category_id
Centro de Custo 1           → cost_center_id
```

### Etapas

1. Criar bancos faltantes: "Itaú - Conta Corrente", "Greenn", "Santander" na `financial_banks`
2. Criar edge function com os dados parseados das planilhas
3. Executar a function uma única vez
4. Verificar os totais e validar
5. Remover a edge function após uso

### Considerações de segurança

- A function só insere dados, não atualiza nem deleta
- Nenhum saldo bancário é alterado
- A deduplicação protege contra execuções duplicadas

