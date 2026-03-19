

# Central de Automações / Workflows Visuais

## Visão Geral

Um módulo novo onde o staff pode criar regras de automação do tipo **"Quando X acontecer → Faça Y"** conectando eventos de diferentes módulos do sistema (CRM, Onboarding, Financeiro, WhatsApp, etc). Interface visual com cards de regras, sem necessidade de canvas drag-and-drop complexo na V1.

---

## Arquitetura

```text
┌─────────────────────────────────────────────┐
│           CENTRAL DE AUTOMAÇÕES             │
│  ┌───────────┐  ┌───────────┐  ┌─────────┐ │
│  │  Regras   │  │  Histórico│  │ Modelos │ │
│  │ (CRUD)    │  │ de Exec.  │  │ Prontos │ │
│  └───────────┘  └───────────┘  └─────────┘ │
└──────────────────────┬──────────────────────┘
                       │
          ┌────────────▼────────────┐
          │   Edge Function         │
          │  automation-engine      │
          │  (processa triggers)    │
          └────────────┬────────────┘
                       │
    ┌──────────┬───────┼───────┬──────────┐
    ▼          ▼       ▼       ▼          ▼
  CRM    Onboarding  Finanças  WhatsApp  Notif.
```

---

## O que será construído

### 1. Tabelas no banco de dados

- **`automation_rules`** — Regras configuradas (trigger, condições, ações, status ativo/inativo)
- **`automation_executions`** — Log de cada execução (sucesso/erro, timestamp, dados)
- **`automation_templates`** — Modelos prontos pré-configurados

### 2. Triggers disponíveis (eventos "Quando")

| Módulo | Evento |
|--------|--------|
| CRM | Lead mudou de etapa |
| CRM | Lead criado |
| CRM | Lead ganho/perdido |
| Onboarding | Health Score caiu abaixo de X |
| Onboarding | Tarefa atrasada há X dias |
| Onboarding | NPS recebido (nota ≤ X) |
| Financeiro | Pagamento atrasado há X dias |
| Financeiro | Pagamento confirmado |

### 3. Ações disponíveis (o "Faça")

| Ação | Descrição |
|------|-----------|
| Enviar notificação | Para staff específico ou responsável |
| Enviar WhatsApp | Template pré-definido via instância configurada |
| Criar tarefa | No projeto do cliente |
| Mover lead de etapa | No CRM |
| Alterar status do projeto | Ex: marcar como "em risco" |
| Criar atividade CRM | Agendar follow-up automático |

### 4. Interface (3 abas)

- **Regras**: Lista de automações com toggle ativo/inativo, botão criar nova, cards visuais mostrando "Quando X → Faça Y"
- **Histórico**: Log de execuções com filtro por regra, status e data
- **Modelos**: Templates prontos que o usuário pode ativar com 1 clique (ex: "Alertar CS quando NPS ≤ 6")

### 5. Edge Function `automation-engine`

- Recebe webhooks/chamadas dos módulos quando eventos ocorrem
- Avalia condições das regras ativas
- Executa as ações configuradas
- Registra execução no log

### 6. Integração com módulos existentes

- Adicionar chamadas ao `automation-engine` nos pontos-chave: mudança de etapa CRM, recebimento NPS, confirmação de pagamento, etc.
- Reutilizar o padrão já existente em `useStageActions.ts` e `whatsapp-campaign-scheduler`

---

## Fluxo de criação de regra

1. Usuário clica "Nova Automação"
2. Seleciona o **trigger** (evento) em um dropdown categorizado por módulo
3. Configura **condições** opcionais (ex: "só se NPS ≤ 6", "só se lead do pipeline X")
4. Seleciona a **ação** a executar
5. Configura detalhes da ação (destinatário, template, etc)
6. Salva e ativa

---

## Acesso

- Menu lateral do staff, com permissão controlada via `staff_menu_permissions` (menu_key: `automations`)
- Somente roles `admin` e `master` por padrão

---

## Arquivos a criar/modificar

- `src/pages/onboarding-tasks/AutomationsPage.tsx` — Página principal
- `src/components/automations/AutomationRulesList.tsx` — Lista de regras
- `src/components/automations/AutomationRuleDialog.tsx` — Criar/editar regra
- `src/components/automations/AutomationExecutionLog.tsx` — Histórico
- `src/components/automations/AutomationTemplates.tsx` — Modelos prontos
- `src/components/automations/triggerConfig.ts` — Definição dos triggers/ações disponíveis
- `supabase/functions/automation-engine/index.ts` — Motor de execução
- Migrações: 3 tabelas + RLS policies
- Modificações pontuais em hooks existentes para disparar eventos

---

## Fora do escopo (V1)

- Canvas visual drag-and-drop com nós e conexões (futuro V2)
- Condições compostas (AND/OR complexo)
- Delays/timers entre ações encadeadas

