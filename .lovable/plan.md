

# Plano: Filtrar Empresas ao Clicar no Card "Projetos"

## Objetivo
Adicionar funcionalidade de clique ao card "Projetos" para filtrar e exibir apenas as empresas que possuem pelo menos um **projeto ativo**.

## Contexto Atual
- O card "Ativas" utiliza `handleCardClick("status", "active")` para filtrar empresas
- A função `isCardActive()` destaca visualmente o card selecionado
- O filtro é processado na página principal através de `activeMetricFilter`

## Implementação

### 1. Adicionar onClick e Estilo Ativo ao Card "Projetos"
**Arquivo:** `src/components/onboarding-tasks/DashboardMetrics.tsx` (linhas 854-868)

Alterar o card para:
- Usar `handleCardClick("projects_active", "active")` no clique
- Adicionar destaque visual com `isCardActive("projects_active", "active")`

```tsx
// De:
<Card className="cursor-pointer transition-all hover:shadow-md">

// Para:
<Card 
  className={cn(
    "cursor-pointer transition-all hover:shadow-md", 
    isCardActive("projects_active", "active") && "ring-2 ring-indigo-500"
  )} 
  onClick={() => handleCardClick("projects_active", "active")}
>
```

### 2. Adicionar Lógica de Filtro na Página Principal
**Arquivo:** `src/pages/onboarding-tasks/OnboardingTasksPage.tsx` (após linha 1239)

Adicionar nova condição no `filteredCompanies`:

```tsx
} else if (activeMetricFilter.type === "projects_active") {
  // Filtrar empresas que têm pelo menos um projeto ativo
  matchesMetricFilter = company.projects?.some(p => p.status === "active") ?? false;
}
```

## Comportamento Esperado
1. **Clique no card "Projetos":** Filtra a lista para mostrar apenas empresas com projetos ativos
2. **Clique novamente:** Remove o filtro (toggle)
3. **Visual:** Card fica com borda índigo quando ativo

## Arquivos a Modificar
| Arquivo | Alteração |
|---------|-----------|
| `DashboardMetrics.tsx` | Adicionar onClick e estilo ativo ao card |
| `OnboardingTasksPage.tsx` | Adicionar lógica de filtro `projects_active` |

