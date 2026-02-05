
# Plano de Reestruturação do UNV Social

## Resumo das Mudanças Solicitadas

Este plano abrange uma reestruturação significativa do módulo UNV Social, incluindo:
- Nova estrutura de colunas e tarefas padrão
- Sistema de etiquetas expandido
- Novos tipos de card
- Personalização visual de cards
- Aprovação via grupos de WhatsApp

---

## Parte 1: Reestruturação das Colunas (Stages)

### Nova Estrutura de Colunas

| # | Coluna Atual | Nova Coluna |
|---|-------------|-------------|
| 1 | Entrada do cliente | **Entrada do Cliente** (mantém) |
| 2 | Informações da empresa | **Ideias** |
| 3 | Pesquisas e inspirações | **Desenvolvimento & Ajustes de Conteúdo** |
| 4 | Em desenvolvimento | (removida/unificada) |
| 5-9 | Aprovação, Ajustes, Aprovado, Programado, Publicado | (mantém) |

### Tarefas Padrão por Etapa

**Entrada do Cliente:**
- Formulário de briefing
- Grupo no WhatsApp  
- Drive para envio dos materiais
- Reunião de Onboarding
- Pesquisa e Análise
- Análise de persona
- Análise SWOT da marca + Visão estratégica
- Analisar posicionamento da marca e concorrência
- Tarefas Extras
- Organização do perfil
- Criação de direcionamento de stories

**Desenvolvimento & Ajustes de Conteúdo (tarefa fixa recorrente mensal):**
- Temas do mês
- Envio para aprovação
- Copy
- Roteiros e instruções de gravação
- Criação das artes
- Edição de vídeos
- Envio para última aprovação
- Programar as postagens no calendário aprovado

---

## Parte 2: Novo Sistema de Etiquetas (Tags)

### Banco de Dados
Criar nova tabela `social_card_tags`:

```text
┌─────────────────────────────────────┐
│         social_card_tags            │
├─────────────────────────────────────┤
│ id: uuid (PK)                       │
│ card_id: uuid (FK social_content_cards) │
│ tag_type: enum (status, format)     │
│ tag_value: text                     │
│ created_at: timestamptz             │
└─────────────────────────────────────┘
```

### Tags de Status (novas)
- `copy` - Copy pendente/em progresso
- `arte` - Arte pendente
- `captacao_video` - Captação de vídeo pendente
- `edicao_video` - Edição de vídeo pendente

### Tags de Formato (content_type expandido)
Alterar o enum `social_content_type` para incluir:
- `estatico` (novo)
- `carrossel` (novo)
- `reels` (mantém)
- `stories` (mantém)
- `outro` (novo)

---

## Parte 3: Três Tipos de Cards

### Novo campo no banco
Adicionar `card_type` na tabela `social_content_cards`:

```text
Valores do enum social_card_type:
- 'content'     → Card de Conteúdo (atual, completo)
- 'task'        → Card de Tarefa (título, subtarefas, anexos, data, descrição)
- 'info'        → Card de Informação (título, descrição, anexos)
```

### Estrutura por Tipo

| Campo | Content | Task | Info |
|-------|---------|------|------|
| Título (theme) | ✓ | ✓ | ✓ |
| Descrição (copy_text) | ✓ | ✓ | ✓ |
| Tipo de conteúdo | ✓ | - | - |
| Objetivo | ✓ | - | - |
| Mídia/Criativo | ✓ | - | - |
| Subtarefas (checklist) | ✓ | ✓ | - |
| Anexos | - | ✓ | ✓ |
| Data de finalização | ✓ | ✓ | - |
| Hashtags/CTA | ✓ | - | - |

### Nova Tabela de Anexos
Criar `social_card_attachments`:

```text
┌─────────────────────────────────────┐
│      social_card_attachments        │
├─────────────────────────────────────┤
│ id: uuid (PK)                       │
│ card_id: uuid (FK)                  │
│ file_name: text                     │
│ file_url: text                      │
│ file_type: text                     │
│ file_size: integer                  │
│ uploaded_by: uuid (FK staff)        │
│ created_at: timestamptz             │
└─────────────────────────────────────┘
```

---

## Parte 4: Ocultar Área de Mídia Vazia

### Alteração no Kanban
No componente `SocialKanbanBoard.tsx`, modificar a renderização do card para:
- Exibir o preview de mídia **apenas quando houver `creative_url`**
- Remover completamente o placeholder "Sem mídia"
- Aplicar apenas para cards do tipo `content`

---

## Parte 5: Cores Personalizadas dos Cards

### Banco de Dados
Adicionar campo `card_color` na tabela `social_content_cards`:

```text
card_color: text (nullable)
Exemplos: "#FF5722", "#4CAF50", "#2196F3"
```

### Interface
- Adicionar seletor de cores no diálogo de criação/edição
- Aplicar a cor como borda lateral ou fundo suave no card
- Paleta sugerida: 8-10 cores pré-definidas + personalizada

---

## Parte 6: Aprovação via Grupos de WhatsApp

### Banco de Dados
Expandir tabela `social_whatsapp_settings`:

```text
Novos campos:
- group_jid: text (ID do grupo WhatsApp)
- send_to_group: boolean (default false)
- group_name: text (nome para exibição)
```

### Edge Function
Atualizar `social-send-approval`:
1. Verificar se `send_to_group` está ativo
2. Se sim, enviar para o grupo usando `group_jid`
3. Se não, enviar para `client_phone` (comportamento atual)

### Interface de Configuração
Adicionar na aba "Integrações" da Base Estratégica:
- Toggle "Enviar aprovações para grupo"
- Campo para inserir ID/JID do grupo
- Instruções de como obter o ID do grupo

---

## Parte 7: Tarefas Recorrentes

### Banco de Dados
Adicionar campos em `social_stage_checklists`:

```text
Novos campos:
- is_recurring: boolean (default false)
- recurrence_type: enum ('monthly', 'weekly')
- recurrence_day: integer (dia do mês ou dia da semana)
```

### Lógica
- A tarefa "Criação de conteúdo" será marcada como recorrente mensal
- Sistema pode gerar automaticamente no início de cada mês

---

## Fluxo de Implementação

### Etapa 1: Migrações de Banco (Prioridade Alta)
1. Criar enum `social_card_type`
2. Adicionar coluna `card_type` em `social_content_cards`
3. Adicionar coluna `card_color` em `social_content_cards`
4. Criar tabela `social_card_tags`
5. Criar tabela `social_card_attachments`
6. Expandir enum `social_content_type` 
7. Adicionar campos de grupo em `social_whatsapp_settings`
8. Adicionar campos de recorrência em `social_stage_checklists`

### Etapa 2: Componentes de UI
1. Atualizar `SocialCardDialog.tsx` para suportar 3 tipos de card
2. Criar `SocialTaskCardDialog.tsx` para cards de tarefa
3. Criar `SocialInfoCardDialog.tsx` para cards de informação
4. Atualizar `SocialKanbanBoard.tsx`:
   - Renderização condicional por tipo
   - Ocultar preview vazio
   - Aplicar cores personalizadas
5. Atualizar `SocialCardDetailSheet.tsx` para os 3 tipos

### Etapa 3: Sistema de Tags
1. Criar componente `CardTagSelector.tsx`
2. Adicionar visualização de tags nos cards do Kanban
3. Implementar filtro por tags

### Etapa 4: Anexos
1. Criar componente `CardAttachments.tsx`
2. Implementar upload para Storage
3. Listar anexos no detalhe do card

### Etapa 5: Aprovação via Grupo
1. Atualizar `SocialIntegrationsTab.tsx` com configuração de grupo
2. Atualizar edge function `social-send-approval`

### Etapa 6: Estrutura Padrão
1. Atualizar função de criação de boards para novas colunas
2. Popular checklists padrão automaticamente

---

## Detalhes Técnicos

### Enums a Criar/Modificar

```sql
-- Novo enum para tipo de card
CREATE TYPE social_card_type AS ENUM ('content', 'task', 'info');

-- Expandir content_type
ALTER TYPE social_content_type ADD VALUE 'estatico';
ALTER TYPE social_content_type ADD VALUE 'carrossel';
ALTER TYPE social_content_type ADD VALUE 'outro';
-- Nota: renomear 'feed' para 'estatico' via migração de dados
```

### Estimativa de Componentes Afetados

| Componente | Tipo de Alteração |
|------------|------------------|
| SocialKanbanBoard.tsx | Significativa |
| SocialCardDialog.tsx | Significativa |
| SocialCardDetailSheet.tsx | Significativa |
| SocialPipelinePage.tsx | Moderada |
| StageChecklistManager.tsx | Leve |
| SocialIntegrationsTab.tsx | Moderada |
| social-send-approval/index.ts | Moderada |

### Novos Componentes a Criar

1. `CardTagSelector.tsx` - Seletor de etiquetas
2. `CardColorPicker.tsx` - Seletor de cores
3. `CardAttachments.tsx` - Gestão de anexos
4. `TaskCardForm.tsx` - Formulário para card de tarefa
5. `InfoCardForm.tsx` - Formulário para card de informação
6. `CardTypeSelector.tsx` - Seletor do tipo de card

---

## Visualização dos Cards

### Card de Conteúdo (tipo atual)
```text
┌────────────────────────┐
│ [Cor]  ████████████████│
│ ┌────────────────────┐ │
│ │    Preview Mídia   │ │
│ │    (4:5 aspect)    │ │
│ └────────────────────┘ │
│ [Carrossel] [Engajamento] │
│ [Copy] [Arte] [Edição]  │ ← Tags de status
│ Título do conteúdo      │
│ □ 3/5 tarefas           │
│ 📅 15/02                │
└────────────────────────┘
```

### Card de Tarefa
```text
┌────────────────────────┐
│ [Cor]  ████████████████│
│ 📋 TAREFA               │
│ Título da tarefa        │
│ □ 2/4 subtarefas        │
│ 📎 3 anexos             │
│ 📅 20/02 (finalização)  │
└────────────────────────┘
```

### Card de Informação
```text
┌────────────────────────┐
│ [Cor]  ████████████████│
│ ℹ️ INFORMAÇÃO           │
│ Informações e Acessos   │
│ Descrição resumida...   │
│ 📎 5 anexos             │
└────────────────────────┘
```
