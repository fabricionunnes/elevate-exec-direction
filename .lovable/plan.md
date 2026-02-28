

# Corrigir mapeamento de status na importacao de Contas a Pagar

## Problema
Ao importar a planilha de contas a pagar, registros com situacao "Quitado" estao sendo salvos com status "pendente" (open). Isso indica que a coluna "Situacao" nao esta sendo mapeada corretamente para o campo `status_raw`, fazendo com que `mapStatus(undefined)` retorne "open".

## Causa raiz
O matching de colunas usa `includes()` bidirecional, que pode causar falhas em headers com acentos ou caracteres especiais do formato `.xls`. Alem disso, nao ha fallback caso o mapeamento falhe.

## Solucao

### 1. Melhorar o matching de headers (ClientFinancialImportDialog.tsx)
- Adicionar uma segunda passada de matching que tenta variantes mais agressivas (remover parenteses, caracteres especiais, etc.)
- Adicionar log de debug para headers nao mapeados
- Separar a logica de `includes` para evitar falsos positivos: exigir que o match via `includes` seja significativo (comprimento minimo)

### 2. Adicionar deteccao de status baseada em conteudo
- Se `status_raw` nao foi mapeado via header, escanear as colunas de dados buscando valores tipicos de status ("Quitado", "Pendente", "Vencido", etc.)
- Usar a primeira coluna encontrada com esses valores como coluna de status

### 3. Adicionar inferencia de status como fallback final
- Se apos todas as tentativas `status_raw` ainda estiver vazio, inferir o status a partir dos dados:
  - Se `paid_amount > 0` E `paid_at` tem data valida -> status = "paid"
  - Se `due_date < hoje` e nao ha pagamento -> status = "overdue"
  - Caso contrario -> status = "open"

## Detalhes tecnicos

### Arquivo: `src/components/client-financial/ClientFinancialImportDialog.tsx`

1. **Novo helper `findColumnMapping`**: Substituir a logica inline de matching por uma funcao dedicada com 3 niveis:
   - Nivel 1: Match exato (apos normalizacao)
   - Nivel 2: `startsWith` (header comeca com a chave ou vice-versa)
   - Nivel 3: `includes` (apenas se a substring tem 6+ caracteres, para evitar falsos positivos)

2. **Deteccao por conteudo para status**: Apos o parse dos headers, se `status_raw` nao foi mapeado, iterar pelas colunas nao mapeadas e verificar se alguma contem valores como "quitado", "pendente", "vencido".

3. **Inferencia no `handleImport`**: Antes de inserir, se `status` resultou "open" mas ha evidencia de pagamento (`paid_amount > 0` ou `paid_at` preenchido), forcar `status = "paid"`.

