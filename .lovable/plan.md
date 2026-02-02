
# Plano: Personalizar Tarefas Padrão por Etapa do Funil

## Resumo

Expandir o sistema de "Ações de Etapa" (`crm_stage_actions`) para suportar **três tipos de tarefas** com comportamentos especiais:

1. **Tarefas normais** - Atividades do dia a dia (como já funciona)
2. **Enviar WhatsApp** - Com mensagem pré-configurada e botão de envio rápido
3. **Agendar reunião** - Com integração ao Google Calendar do usuário escolhido

---

## O que vai mudar

### Na tela de configuração (Ações de Etapa)
- Novo campo para selecionar o **tipo especial** da ação
- Para tipo "WhatsApp": campo para **mensagem padrão** (com variáveis como `{nome}`)
- Para tipo "Agendar": opção de escolher em qual agenda será agendado

### Na aba de Atividades do lead
- Atividades do tipo "WhatsApp" terão botão para **enviar imediatamente**
- Atividades do tipo "Agendar" abrirão o **modal de agendamento** pré-configurado

---

## Mudanças no Banco de Dados

```sql
-- Adicionar campos para configuração de WhatsApp e agendamento
ALTER TABLE crm_stage_actions ADD COLUMN IF NOT EXISTS
  action_mode TEXT DEFAULT 'task', -- 'task', 'whatsapp_send', 'schedule_meeting'
  whatsapp_template TEXT,           -- Mensagem padrão do WhatsApp
  meeting_staff_id UUID REFERENCES onboarding_staff(id), -- Staff para agenda (opcional)
  meeting_duration_minutes INTEGER DEFAULT 60;

-- Adicionar campo na atividade para saber se é automação
ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS
  is_automation BOOLEAN DEFAULT false,
  automation_config JSONB; -- Guarda dados da automação (template, staff_id, etc)
```

---

## Componentes a Criar/Modificar

### 1. Modificar `StageActionsDialog.tsx`
- Adicionar campo de seleção do "Modo de Ação" (task, whatsapp_send, schedule_meeting)
- Para "WhatsApp": mostrar campo de template com variáveis disponíveis
- Para "Agendar": mostrar seletor de staff (opcional) e duração

### 2. Criar `WhatsAppQuickSendButton.tsx`
Botão que aparece nas atividades do tipo `whatsapp` que:
- Usa a instância vinculada ao staff logado (via `crm_service_staff_devices`)
- Substitui variáveis no template (`{nome}`, `{empresa}`, etc)
- Envia diretamente sem abrir modal

### 3. Criar `ScheduleMeetingQuickButton.tsx`
Botão que aparece nas atividades do tipo `meeting` que:
- Abre o `ScheduleLeadMeetingDialog` pré-configurado
- Se tiver `meeting_staff_id` configurado, já vem pré-selecionado

### 4. Modificar `LeadActivitiesTab.tsx`
- Renderizar botões especiais baseado no tipo e `is_automation`
- Mostrar preview do template de WhatsApp

### 5. Modificar `useStageActions.ts`
- Salvar `automation_config` na atividade criada
- Incluir dados do template/configuração

---

## Fluxo de Uso

### Configurando uma ação de WhatsApp

```text
1. Usuário acessa configuração da etapa
2. Clica em "Nova Ação"
3. Seleciona tipo "WhatsApp"
4. Define:
   - Título: "Enviar boas-vindas"
   - Mensagem: "Olá {nome}! Bem-vindo à etapa de qualificação..."
   - Prazo: 0 dias (mesmo dia)
5. Salva

Quando o lead entra na etapa:
- Atividade é criada com botão "Enviar WhatsApp"
- Ao clicar, mensagem é enviada usando a instância do usuário
- Atividade é marcada como concluída automaticamente
```

### Configurando uma ação de Agendamento

```text
1. Usuário acessa configuração da etapa
2. Clica em "Nova Ação"  
3. Seleciona tipo "Agendar Reunião"
4. Define:
   - Título: "Reunião de apresentação"
   - Duração: 45 minutos
   - Staff padrão: (opcional - deixa escolher na hora)
   - Prazo: 2 dias
5. Salva

Quando o lead entra na etapa:
- Atividade é criada com botão "Agendar"
- Ao clicar, abre modal pré-configurado
- Após agendar, atividade é concluída
```

---

## Variáveis disponíveis para templates

| Variável | Descrição |
|----------|-----------|
| `{nome}` | Nome do lead |
| `{empresa}` | Empresa do lead |
| `{email}` | Email do lead |
| `{telefone}` | Telefone do lead |
| `{etapa}` | Nome da etapa atual |
| `{funil}` | Nome do funil |

---

## Detalhes Técnicos

### Estrutura do `automation_config` (JSONB)

```typescript
interface AutomationConfig {
  mode: 'task' | 'whatsapp_send' | 'schedule_meeting';
  // Para WhatsApp
  whatsapp_template?: string;
  // Para Reunião
  meeting_staff_id?: string;
  meeting_duration_minutes?: number;
}
```

### Buscar instância do staff logado

```typescript
// Encontrar instância WhatsApp do usuário
const { data: staffDevice } = await supabase
  .from('crm_service_staff_devices')
  .select('instance_id, whatsapp_instances!inner(id, instance_name, status)')
  .eq('staff_id', currentStaffId)
  .eq('whatsapp_instances.status', 'connected')
  .single();
```

### Substituir variáveis no template

```typescript
function replaceTemplateVariables(template: string, lead: Lead, stage: Stage): string {
  return template
    .replace(/{nome}/g, lead.name || '')
    .replace(/{empresa}/g, lead.company || '')
    .replace(/{email}/g, lead.email || '')
    .replace(/{telefone}/g, lead.phone || '')
    .replace(/{etapa}/g, stage.name || '')
    .replace(/{funil}/g, lead.pipeline?.name || '');
}
```

---

## Interface Visual (Wireframe)

### Configuração da Ação

```text
┌────────────────────────────────────────────────────────┐
│  Nova Ação da Etapa                                    │
├────────────────────────────────────────────────────────┤
│  Tipo de Atividade *        Modo da Ação *             │
│  ┌──────────────────┐       ┌──────────────────┐       │
│  │ WhatsApp    ▼    │       │ Enviar WhatsApp ▼│       │
│  └──────────────────┘       └──────────────────┘       │
│                                                        │
│  Título da Atividade *                                 │
│  ┌──────────────────────────────────────────────┐     │
│  │ Enviar boas-vindas                           │     │
│  └──────────────────────────────────────────────┘     │
│                                                        │
│  Mensagem do WhatsApp *                                │
│  ┌──────────────────────────────────────────────┐     │
│  │ Olá {nome}! 👋                               │     │
│  │ Bem-vindo à nossa equipe! Vi que você se    │     │
│  │ interessou pelos nossos serviços...         │     │
│  └──────────────────────────────────────────────┘     │
│  Variáveis: {nome} {empresa} {email} {telefone}        │
│                                                        │
│  Prazo (dias) *                                        │
│  ┌──────┐  □ Atividade obrigatória                    │
│  │  0   │                                              │
│  └──────┘                                              │
│                                                        │
│  ┌────────────────┐  ┌──────────┐                     │
│  │ Adicionar Ação │  │ Cancelar │                     │
│  └────────────────┘  └──────────┘                     │
└────────────────────────────────────────────────────────┘
```

### Atividade na lista do Lead

```text
┌──────────────────────────────────────────────────────────────┐
│ 📅 01/02  │ 💬 Enviar boas-vindas      │ [Enviar ▶] │  □   │
│           │    Preview: "Olá João! 👋..." │           │      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 📅 03/02  │ 📹 Reunião de apresentação │ [Agendar 📅]│  □   │
│           │    Duração: 45 min          │           │      │
└──────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/crm/StageActionsDialog.tsx` | Adicionar campos de modo, template WhatsApp e config de reunião |
| `src/components/crm/lead-detail/LeadActivitiesTab.tsx` | Renderizar botões especiais para automações |
| `src/hooks/useStageActions.ts` | Salvar automation_config nas atividades |
| `src/components/crm/WhatsAppQuickSendButton.tsx` | **Novo** - Botão de envio rápido de WhatsApp |
| `src/components/crm/ScheduleMeetingQuickButton.tsx` | **Novo** - Botão de agendamento rápido |

---

## Considerações

1. **Instância do usuário**: Se o usuário não tiver instância WhatsApp vinculada, o botão mostrará erro amigável
2. **Fallback**: Se não conseguir enviar automaticamente, abre o modal tradicional com a mensagem pré-preenchida
3. **Histórico**: Todas as mensagens enviadas são registradas em `whatsapp_message_log`
4. **Google Calendar**: Usa a integração existente em `ScheduleLeadMeetingDialog`
