

## Plano: Seleção em Cascata para Estrutura Organizacional

### Objetivo
Implementar uma hierarquia em cascata onde:
- **Equipes** pertencem a uma **Unidade**
- **Setores** pertencem a uma **Equipe** (e herdam a Unidade)
- **Vendedores** pertencem a uma **Equipe** (e herdam a Unidade via cascata)

---

### Resumo das Mudanças

1. **Adicionar campo `team_id` na tabela de Setores** - Atualmente setores só têm `unit_id`, precisamos adicionar `team_id` para a cascata
2. **Adicionar campo `sector_id` na tabela de Vendedores** - Para vincular vendedores a setores específicos
3. **Atualizar formulário de Equipes** - Manter seleção de Unidade (já existe)
4. **Atualizar formulário de Setores** - Adicionar seleção de Unidade → Equipe em cascata
5. **Atualizar formulário de Vendedores** - Adicionar seleção completa: Unidade → Setor → Equipe

---

### Detalhes Técnicos

#### 1. Alterações no Banco de Dados

```sql
-- Adicionar team_id à tabela de setores
ALTER TABLE company_sectors ADD COLUMN team_id UUID REFERENCES company_teams(id);

-- Adicionar sector_id à tabela de vendedores
ALTER TABLE company_salespeople ADD COLUMN sector_id UUID REFERENCES company_sectors(id);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_sectors_team ON company_sectors(team_id);
CREATE INDEX IF NOT EXISTS idx_salespeople_sector ON company_salespeople(sector_id);
```

#### 2. Atualizar `TeamsTab.tsx`
- Já possui seleção de Unidade - manter como está
- A equipe é o segundo nível da hierarquia

#### 3. Atualizar `SectorsTab.tsx`
- Adicionar dropdown de **Unidade** (primeiro nível)
- Adicionar dropdown de **Equipe** (filtrado pela Unidade selecionada)
- Quando selecionar Unidade, resetar Equipe
- Herdar `unit_id` da equipe selecionada automaticamente

#### 4. Atualizar `SalespeopleTab.tsx`
- Adicionar seleção em cascata no formulário:
  1. **Unidade** (primeiro nível)
  2. **Setor** (filtrado pela Unidade)
  3. **Equipe** (filtrado pelo Setor ou Unidade)
- Quando mudar Unidade → resetar Setor e Equipe
- Quando mudar Setor → resetar Equipe (mostrar apenas equipes do setor)
- Exibir coluna de Setor na tabela de listagem

#### 5. Lógica de Cascata

```
Unidade
  └── Equipe (pertence à Unidade)
        └── Setor (pertence à Equipe, herda Unidade)
              └── Vendedor (pertence ao Setor/Equipe, herda tudo)
```

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/` | Nova migração para `team_id` em setores e `sector_id` em vendedores |
| `SectorsTab.tsx` | Formulário com cascata Unidade → Equipe |
| `SalespeopleTab.tsx` | Formulário com cascata Unidade → Setor → Equipe + nova coluna na tabela |
| `TeamsTab.tsx` | Nenhuma alteração necessária (já tem seleção de Unidade) |

---

### Comportamento Esperado

**No formulário de Setor:**
1. Selecionar Unidade (opcional, filtra equipes)
2. Selecionar Equipe (mostra apenas equipes da Unidade selecionada)
3. Se selecionar Equipe, o `unit_id` é preenchido automaticamente baseado na equipe

**No formulário de Vendedor:**
1. Selecionar Unidade (filtra setores e equipes disponíveis)
2. Selecionar Setor (opcional, filtra equipes do setor)
3. Selecionar Equipe (mostra equipes do setor ou unidade)
4. Todos os IDs são salvos para rastreabilidade completa

