

## Problema

A aba "Faturas" no portal do cliente nao aparece porque:

1. O projeto tem registros na tabela `project_menu_permissions` (menus habilitados/desabilitados)
2. Como `minhas_faturas` e uma chave recem-criada, ela nao foi inserida nessa tabela
3. A logica de `hasPermission` interpreta "nao esta na tabela" como "desabilitado" quando ha qualquer configuracao de menu existente

## Solucao

### 1. Migracao SQL
Inserir automaticamente `minhas_faturas` como habilitado para todos os projetos que ja possuem configuracoes de menu, garantindo que a aba apareca para projetos existentes.

```sql
INSERT INTO project_menu_permissions (project_id, menu_key, is_enabled)
SELECT DISTINCT project_id, 'minhas_faturas', true
FROM project_menu_permissions
WHERE NOT EXISTS (
  SELECT 1 FROM project_menu_permissions p2
  WHERE p2.project_id = project_menu_permissions.project_id
  AND p2.menu_key = 'minhas_faturas'
);
```

### 2. Ajuste no ClientBillingPanel
Atualmente o componente recebe `companyId`, mas precisa garantir que funcione mesmo quando o `companyId` estiver vazio (exibir estado vazio em vez de erro).

---

### Detalhes tecnicos

**Arquivo afetado:**
- Nova migracao SQL (inserir `minhas_faturas` em `project_menu_permissions`)

**Nenhuma mudanca de codigo** e necessaria -- a logica de permissao ja esta correta, so falta o registro no banco.

