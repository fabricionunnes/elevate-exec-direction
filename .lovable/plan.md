
# Plano: Refazer Integração WhatsApp no CRM Comercial

## Análise do Problema Atual

A integração existente com a Evolution API apresenta falhas porque:

1. **QR Code não é gerado consistentemente** - A API v2.2.3 nem sempre retorna o QR via JSON
2. **Falta de webhook para receber mensagens** - Não há fluxo para receber mensagens em tempo real
3. **Interface usa dados mockados** - A página de Inbox (`CRMInboxPage.tsx`) usa dados estáticos
4. **Sem tabelas de conversas** - Faltam tabelas dedicadas para armazenar conversas e mensagens do WhatsApp

---

## Solução Proposta

Refazer a integração do zero com uma arquitetura mais robusta:

```text
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ WhatsApp User   │◄──►│ Evolution API    │◄──►│ Webhook         │
│ (celular)       │    │ (VPS externo)    │    │ (Edge Function) │
└─────────────────┘    └──────────────────┘    └────────┬────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ CRM Atendimento │◄──►│ Supabase DB      │◄───│ Realtime        │
│ (React)         │    │ (conversas/msgs) │    │ (push updates)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

---

## Etapas de Implementação

### 1. Novas Tabelas no Banco de Dados

Criar tabelas específicas para o módulo de atendimento:

| Tabela | Descrição |
|--------|-----------|
| `crm_whatsapp_contacts` | Contatos do WhatsApp (nome, telefone, foto) |
| `crm_whatsapp_conversations` | Conversas ativas com status e atribuições |
| `crm_whatsapp_messages` | Histórico de mensagens enviadas/recebidas |

**Estrutura `crm_whatsapp_conversations`:**
- `id`, `instance_id`, `contact_phone`, `contact_name`
- `status` (open, pending, closed)
- `assigned_to` (staff_id)
- `last_message_at`, `unread_count`
- `lead_id` (vínculo opcional com CRM)

**Estrutura `crm_whatsapp_messages`:**
- `id`, `conversation_id`, `content`, `type` (text, image, audio, document)
- `direction` (inbound, outbound)
- `status` (sent, delivered, read)
- `media_url`, `created_at`

### 2. Nova Edge Function: Webhook para Evolution API

Criar `evolution-webhook` para receber eventos em tempo real:

- **Mensagens recebidas** → Salvar no banco e atualizar conversa
- **Status de mensagem** → Atualizar status (entregue, lido)
- **Conexão/Desconexão** → Atualizar status da instância

### 3. Refatorar Página de Atendimento

Atualizar `CRMInboxPage.tsx` para:

- Buscar conversas reais do banco de dados
- Implementar Supabase Realtime para atualizações instantâneas
- Enviar mensagens via edge function
- Vincular conversas a leads do CRM

### 4. Novo Fluxo de Conexão WhatsApp

Simplificar o fluxo de conexão:

1. Criar dispositivo no banco
2. Chamar Evolution API para criar instância E já registrar webhook
3. Abrir modal com QR Code
4. Webhook notifica quando conectado → atualiza status automaticamente

### 5. Configurar Webhook na Evolution API

Ao criar instância, registrar webhook apontando para:
```
https://czmyjgdixwhpfasfugkm.supabase.co/functions/v1/evolution-webhook
```

---

## Detalhes Técnicos

### Migração SQL

```sql
-- Contatos WhatsApp
CREATE TABLE crm_whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  profile_picture_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Conversas
CREATE TABLE crm_whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES crm_whatsapp_contacts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'pending', 'closed')),
  assigned_to UUID REFERENCES onboarding_staff(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES crm_leads(id) ON DELETE SET NULL,
  sector_id UUID REFERENCES crm_service_sectors(id) ON DELETE SET NULL,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Mensagens
CREATE TABLE crm_whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES crm_whatsapp_conversations(id) ON DELETE CASCADE,
  remote_id TEXT, -- ID da Evolution API
  content TEXT,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'audio', 'video', 'document', 'sticker')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  media_url TEXT,
  media_mimetype TEXT,
  quoted_message_id UUID REFERENCES crm_whatsapp_messages(id),
  sent_by UUID REFERENCES onboarding_staff(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE crm_whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE crm_whatsapp_messages;

-- Índices
CREATE INDEX idx_conversations_instance ON crm_whatsapp_conversations(instance_id);
CREATE INDEX idx_conversations_assigned ON crm_whatsapp_conversations(assigned_to);
CREATE INDEX idx_messages_conversation ON crm_whatsapp_messages(conversation_id);
CREATE INDEX idx_messages_created ON crm_whatsapp_messages(created_at DESC);
```

### Edge Function: evolution-webhook

```typescript
// Recebe eventos da Evolution API
serve(async (req) => {
  const body = await req.json();
  const event = body.event;
  
  switch (event) {
    case 'messages.upsert':
      // Nova mensagem recebida
      await handleIncomingMessage(body.data);
      break;
    case 'messages.update':
      // Status atualizado (entregue/lido)
      await handleMessageStatusUpdate(body.data);
      break;
    case 'connection.update':
      // Status de conexão alterado
      await handleConnectionUpdate(body.data);
      break;
  }
});
```

### Componentes React a Atualizar

| Arquivo | Alteração |
|---------|-----------|
| `CRMInboxPage.tsx` | Remover mocks, conectar ao banco real, adicionar Realtime |
| `DevicesSection.tsx` | Registrar webhook ao criar instância |
| Novo: `useWhatsAppConversations.ts` | Hook para gerenciar conversas |
| Novo: `useWhatsAppMessages.ts` | Hook para mensagens com Realtime |

---

## Benefícios

1. **Mensagens em tempo real** via Supabase Realtime
2. **Histórico persistente** de todas as conversas
3. **Atribuição de atendentes** por conversa
4. **Vínculo com leads** do CRM Comercial
5. **Múltiplos dispositivos** funcionando simultaneamente
6. **Status de conexão** atualizado automaticamente via webhook
