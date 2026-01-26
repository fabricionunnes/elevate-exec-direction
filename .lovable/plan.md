
# Plano: Adicionar Card de Projetos Ativos

## Objetivo
Adicionar um novo card ao dashboard que exiba a quantidade de **projetos ativos**, separado do card de **empresas ativas** já existente.

## Contexto Atual
- **Card "Ativas"**: Mostra `companyMetrics.activeCompanies` (empresas com status = "active")
- **Métrica de projetos**: `projectMetrics.activeProjects` já é calculado no código mas não é exibido em um card dedicado
- **Grid atual**: 7 colunas em telas grandes (lg:grid-cols-7)

## Implementação

### 1. Ajustar o Grid de Cards
Alterar o grid para acomodar 8 cards em telas grandes:
- `lg:grid-cols-7` → `lg:grid-cols-8`

### 2. Adicionar Novo Card "Projetos"
Inserir um novo card logo após o card "Ativas" com:
- **Valor**: `projectMetrics.activeProjects`
- **Label**: "Projetos"
- **Ícone**: `Package` (ícone já importado no arquivo)
- **Cor**: Índigo/roxo para diferenciar visualmente das empresas

### 3. Arquivo a Modificar
`src/components/onboarding-tasks/DashboardMetrics.tsx`

---

## Detalhes Técnicos

### Mudança no Grid (linha 839)
```text
Antes:  grid-cols-3 sm:grid-cols-4 lg:grid-cols-7
Depois: grid-cols-3 sm:grid-cols-4 lg:grid-cols-8
```

### Novo Card (após linha 852)
```tsx
<Card className="cursor-pointer transition-all hover:shadow-md">
  <CardContent className="p-2 sm:p-3">
    <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
      <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
        <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-500" />
      </div>
      <div className="text-center sm:text-left min-w-0">
        <p className="text-base sm:text-lg font-bold leading-none text-indigo-500">
          {projectMetrics.activeProjects}
        </p>
        <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">
          Projetos
        </p>
      </div>
    </div>
  </CardContent>
</Card>
```

## Resultado Visual
| Ativas | Projetos | Solicitou Canc. | Hoje | Atrasadas | NPS | Health | Churn |
|--------|----------|-----------------|------|-----------|-----|--------|-------|
| 45     | 52       | 2               | 8    | 3         | 9.2 | 75     | 2%    |

O card "Projetos" ficará imediatamente ao lado do card "Ativas", facilitando a comparação entre empresas ativas e projetos ativos.
