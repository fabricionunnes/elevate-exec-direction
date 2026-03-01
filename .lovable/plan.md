
# Card de Empresas Inadimplentes no Dashboard Principal

## Objetivo
Adicionar um card clicavel no dashboard principal (`DashboardMetrics`) mostrando a quantidade de empresas com faturas em atraso. Ao clicar, exibe a lista de empresas inadimplentes com regras de visibilidade por papel.

## Regras de Acesso
- **Consultores**: veem apenas suas proprias empresas inadimplentes, exibindo somente os **dias em atraso**
- **Administradores e Master**: veem **todas** as empresas inadimplentes, com **dias em atraso** e **valor**

## Implementacao

### 1. Buscar faturas vencidas no DashboardMetrics
- Adicionar fetch de `company_invoices` com `status = 'pending'` e `due_date < hoje` no `fetchData` do `DashboardMetrics.tsx`
- Agrupar por `company_id`, calculando: quantidade de faturas, maior atraso em dias, valor total em centavos
- Cruzar com a lista de `companies` para obter nome e `consultant_id`
- Para consultores (quando `staffRole` nao e `master` nem `admin`), filtrar apenas empresas onde `consultant_id` ou `cs_id` corresponde ao usuario logado

### 2. Adicionar card na grid de empresas
- Inserir um novo card na grid existente (linha 1069-1091 do DashboardMetrics.tsx) com cor vermelha/laranja
- Exibir o numero de empresas inadimplentes
- Label: "Inadimplentes"
- Ao clicar, toggle de um estado `showOverdueCompanies` (similar ao padrao de `showNotRenewedCompanies`)

### 3. Painel expandivel ao clicar
- Abaixo da grid de cards, renderizar um `Card` com a lista das empresas inadimplentes (similar ao bloco de "Nao Renovadas" ja existente)
- Cada item mostra: nome da empresa, dias em atraso (da fatura mais antiga)
- Para admin/master: tambem mostra o valor total em atraso formatado em reais
- Para consultores: mostra apenas dias em atraso

### Arquivos modificados
- `src/components/onboarding-tasks/DashboardMetrics.tsx` - Adicionar fetch, estado, card e painel expandivel

### Detalhes Tecnicos
- Novo estado: `overdueCompaniesData` (array com company_id, name, maxDaysLate, totalAmountCents)
- Novo estado: `showOverdueCompanies` (boolean toggle)
- Query: `supabase.from("company_invoices").select("company_id, due_date, amount_cents").eq("status", "pending").lt("due_date", todayStr)`
- Filtragem por papel usando a prop `staffRole` ja disponivel e `currentStaffUserId` cruzado com `consultant_id` das empresas
- Formatacao de valor: `(centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })`
