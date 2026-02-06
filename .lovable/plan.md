
# Plano: Sistema de Template de Etapas para UNV Social

## Resumo

Criar um sistema de **templates de estrutura** para o UNV Social que:
1. Use o projeto Maria Edna (`c90efc9f-5e18-4d44-8454-c22f153c8155`) como modelo padrão
2. Replique a estrutura (etapas e checklists) para todos os projetos UNV Social existentes
3. Garanta que novos projetos UNV Social usem automaticamente esse template

---

## Estrutura do Template Maria Edna (Modelo)

| Etapa | Cor | Checklists |
|-------|-----|------------|
| Entrada do cliente | #9CA3AF | Criar grupo no WhatsApp, Enviar formulário de Briefing, Fazer reunião de onboarding |
| Ideias | #60A5FA | - |
| Desenvolvimento & Ajustes | #A78BFA | - |
| Revisão Interna | #FBBF24 | - |
| Aprovação do Cliente | #F97316 | - |
| Ajustes Solicitados | #EF4444 | - |
| Aprovado | #10B981 | - |
| Programado | #3B82F6 | - |
| Publicado | #059669 | - |

---

## Implementação

### Parte 1: Atualizar a função de criação de etapas padrão

Modificar a função `create_social_default_stages` no banco de dados para usar a estrutura do template Maria Edna:

```text
┌─────────────────────────────────────────────────────────────┐
│ ANTES (Estrutura Atual)                                     │
│ - Integração (com 6 checklists)                             │
│ - Informações da empresa (com 4 checklists)                 │
│ - Pesquisas e inspirações                                   │
│ - Em desenvolvimento                                         │
│ - ...                                                        │
├─────────────────────────────────────────────────────────────┤
│ DEPOIS (Template Maria Edna)                                │
│ - Entrada do cliente (com 3 checklists)                     │
│ - Ideias                                                     │
│ - Desenvolvimento & Ajustes                                  │
│ - Revisão Interna                                            │
│ - ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

### Parte 2: Script de migração para projetos existentes

Criar um script SQL para replicar a estrutura nos 6 projetos UNV Social existentes que **ainda não têm board** ou têm estrutura diferente:

| Projeto ID | Status Atual |
|------------|--------------|
| `58b0cbd2...` | Tem board com estrutura antiga |
| `05a92e85...` | Tem board vazio |
| `c90efc9f...` | **MODELO** - não alterar |
| `fd8ce8e1...` | Sem board |
| `529feac3...` | Sem board |
| `5e081f94...` | Sem board |
| `1a827a50...` | Sem board |

**Lógica:**
1. Para projetos sem board: criar board e usar o template
2. Para projetos com board existente: substituir etapas (mantendo cards existentes se houver)

### Parte 3: Garantir que novos projetos usem o template

O código em `SocialLayout.tsx` já chama `create_social_default_stages` quando um novo board é criado. Após atualizar a função, todos os novos projetos usarão automaticamente o template Maria Edna.

---

## Riscos e Considerações

**Dados existentes:**
- Projetos que já têm cards nas etapas antigas podem perder a associação
- Recomendo manter os cards e re-associar às novas etapas correspondentes

**Ação recomendada:**
- Verificar se há cards nos boards existentes antes de migrar
- Criar mapeamento de etapas antigas → novas

---

## Detalhes Técnicos

### Migração SQL

```sql
-- 1. Atualizar função create_social_default_stages
CREATE OR REPLACE FUNCTION public.create_social_default_stages(p_board_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stage_id uuid;
BEGIN
  -- 1. Entrada do cliente
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'idea', 'Entrada do cliente', '#9CA3AF', 1)
  RETURNING id INTO v_stage_id;
  
  INSERT INTO social_stage_checklists (stage_id, title, sort_order) VALUES
    (v_stage_id, 'Criar grupo no WhatsApp', 0),
    (v_stage_id, 'Enviar o formulário de Briefing', 1),
    (v_stage_id, 'Fazer reunião de onboarding', 2);

  -- 2. Ideias
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'script', 'Ideias', '#60A5FA', 2);

  -- 3. Desenvolvimento & Ajustes
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'design', 'Desenvolvimento & Ajustes', '#A78BFA', 3);

  -- 4. Revisão Interna
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'internal_review', 'Revisão Interna', '#FBBF24', 4);

  -- 5. Aprovação do Cliente
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'client_approval', 'Aprovação do Cliente', '#F97316', 5);

  -- 6. Ajustes Solicitados
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'adjustments', 'Ajustes Solicitados', '#EF4444', 6);

  -- 7. Aprovado
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'approved', 'Aprovado', '#10B981', 7);

  -- 8. Programado
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'scheduled', 'Programado', '#3B82F6', 8);

  -- 9. Publicado
  INSERT INTO social_content_stages (board_id, stage_type, name, color, sort_order)
  VALUES (p_board_id, 'published', 'Publicado', '#059669', 9);
END;
$$;

-- 2. Criar boards para projetos sem board e aplicar template
-- 3. Limpar e recriar estrutura para projetos com board antigo
```

### Arquivos a Modificar

1. **Nova migração SQL** - Atualizar `create_social_default_stages` e migrar projetos existentes
2. **Nenhuma mudança no frontend** - O código já usa a função corretamente

---

## Resultado Esperado

Após a implementação:
- Todos os 7 projetos UNV Social terão a mesma estrutura de etapas
- Novos projetos UNV Social receberão automaticamente o template Maria Edna
- A estrutura será consistente em toda a plataforma
