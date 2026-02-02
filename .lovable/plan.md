
# Plano de Implementação: Ligações VoIP com Twilio

## Resumo
Implementar um sistema de ligações telefônicas integrado ao CRM usando Twilio Voice SDK. Os usuários poderão fazer ligações diretamente do navegador ao abrir um lead, com as chamadas sendo gravadas automaticamente e transcritas via AssemblyAI (já integrado ao projeto).

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                            │
├─────────────────────────────────────────────────────────────────────┤
│  LeadActivitiesTab.tsx                                              │
│    └── CallDialer (novo componente)                                 │
│         ├── Discador com keypad DTMF                                │
│         ├── Controles: Ligar / Desligar / Mudo                      │
│         └── Status da chamada em tempo real                         │
├─────────────────────────────────────────────────────────────────────┤
│  Twilio Voice SDK (@twilio/voice-sdk)                               │
│    └── Device.connect() → WebRTC para áudio                         │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       EDGE FUNCTIONS (Deno)                         │
├─────────────────────────────────────────────────────────────────────┤
│  1. twilio-token                                                    │
│     └── Gera Access Token para o Device                             │
│                                                                     │
│  2. twilio-voice                                                    │
│     └── TwiML para iniciar chamada (atende webhook)                 │
│                                                                     │
│  3. twilio-webhook                                                  │
│     └── Recebe status updates (call completed, recording ready)     │
│     └── Salva gravação e dispara transcrição                        │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DATABASE                                    │
├─────────────────────────────────────────────────────────────────────┤
│  crm_calls (nova tabela)                                            │
│    ├── id, lead_id, staff_id                                        │
│    ├── twilio_call_sid, from_number, to_number                      │
│    ├── status, duration, direction                                  │
│    ├── recording_url, recording_sid                                 │
│    ├── transcription (text)                                         │
│    ├── started_at, ended_at                                         │
│    └── created_at, updated_at                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Pré-requisitos (Secrets Twilio)

Você precisará configurar 4 secrets no projeto:

| Secret | Descrição |
|--------|-----------|
| `TWILIO_ACCOUNT_SID` | Account SID da sua conta Twilio |
| `TWILIO_AUTH_TOKEN` | Auth Token da sua conta Twilio |
| `TWILIO_PHONE_NUMBER` | Número Twilio para fazer/receber chamadas (ex: +15551234567) |
| `TWILIO_TWIML_APP_SID` | SID do TwiML App (configura webhooks) |

> **Configuração no Console Twilio:**
> 1. Crie um TwiML App em Console → Voice → TwiML Apps
> 2. Configure o Voice Request URL para: `https://czmyjgdixwhpfasfugkm.supabase.co/functions/v1/twilio-voice`

---

## Etapas de Implementação

### 1. Configurar Secrets Twilio
- Solicitar ao usuário os 4 secrets necessários via ferramenta `add_secret`
- Validar que todos estão configurados antes de prosseguir

### 2. Criar Tabela `crm_calls`
```sql
CREATE TABLE crm_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES onboarding_staff(id),
  
  -- Twilio identifiers
  twilio_call_sid TEXT UNIQUE,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  
  -- Call details
  direction TEXT DEFAULT 'outbound', -- outbound, inbound
  status TEXT DEFAULT 'initiated', -- initiated, ringing, in-progress, completed, busy, no-answer, failed
  duration INTEGER, -- seconds
  
  -- Recording
  recording_url TEXT,
  recording_sid TEXT,
  transcription TEXT,
  transcription_status TEXT, -- pending, processing, completed, failed
  
  -- Timestamps
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE crm_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view own calls" ON crm_calls
  FOR SELECT USING (
    staff_id = public.get_current_staff_id() 
    OR public.is_crm_admin()
  );

CREATE POLICY "Staff can insert own calls" ON crm_calls
  FOR INSERT WITH CHECK (staff_id = public.get_current_staff_id());

CREATE POLICY "Webhook can update calls" ON crm_calls
  FOR UPDATE USING (true);

-- Realtime para updates de status
ALTER PUBLICATION supabase_realtime ADD TABLE crm_calls;
```

### 3. Criar Edge Function `twilio-token`
Gera o Access Token JWT para o Twilio Voice SDK no frontend:

```typescript
// Principais funcionalidades:
- Validar usuário autenticado
- Criar Capability Token com:
  - OutgoingClientScope (para fazer chamadas)
  - IncomingClientScope (opcional, para receber)
- Retornar token + identity
```

### 4. Criar Edge Function `twilio-voice`
Webhook que gera o TwiML para iniciar a chamada:

```typescript
// Quando Twilio chama este endpoint:
- Extrair o número de destino (To)
- Gerar TwiML com <Dial> e <Number>
- Habilitar gravação com record="true"
- Configurar statusCallback para receber eventos
```

### 5. Criar Edge Function `twilio-webhook`
Recebe callbacks de status e gravações:

```typescript
// Eventos tratados:
- call-status: Atualiza status da chamada (ringing, in-progress, completed)
- recording-completed: Salva URL da gravação, dispara transcrição
- Usar transcribe-assemblyai existente para transcrever
```

### 6. Instalar Dependência `@twilio/voice-sdk`
Adicionar ao projeto para permitir chamadas via WebRTC no navegador.

### 7. Criar Componente `TwilioCallDialer`
Novo componente React com:

- **Estado do Device:** Conectando, Pronto, Em chamada, Desconectado
- **Botão "Ligar":** Inicia a chamada via `device.connect()`
- **Keypad DTMF:** Para navegar em URAs
- **Controles:** Mudo, Encerrar chamada
- **Timer:** Mostra duração da chamada em tempo real
- **Indicador de status:** Chamando, Em progresso, Finalizada

### 8. Integrar Discador na Página do Lead
Modificar `LeadActivitiesTab.tsx`:

- Quando checklist item for tipo `call`, exibir o discador completo
- Botão de telefone no header do lead também abre discador
- Após encerrar a chamada, marcar item do checklist como concluído

### 9. Criar Aba "Ligações" no Lead
Ou integrar na aba Histórico:

- Lista de todas as ligações feitas para o lead
- Player de áudio para ouvir gravação
- Transcrição expansível
- Status e duração de cada chamada

---

## Fluxo de uma Ligação

1. **Usuário clica em "Ligar"** no lead
2. **Frontend solicita token** via `twilio-token`
3. **Device.connect()** inicia chamada WebRTC
4. **Twilio chama** `twilio-voice` para obter TwiML
5. **Chamada é conectada** ao número do lead
6. **Durante a chamada:** status updates via websocket
7. **Ao encerrar:** `twilio-webhook` recebe callback
8. **Gravação processada:** URL salva no banco
9. **Transcrição automática:** Usa `transcribe-assemblyai` existente
10. **UI atualizada** em tempo real via Supabase Realtime

---

## Arquivos a Serem Criados/Modificados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/twilio-token/index.ts` | Criar |
| `supabase/functions/twilio-voice/index.ts` | Criar |
| `supabase/functions/twilio-webhook/index.ts` | Criar |
| `supabase/config.toml` | Adicionar funções |
| `src/components/crm/lead-detail/TwilioCallDialer.tsx` | Criar |
| `src/components/crm/lead-detail/CallHistoryList.tsx` | Criar |
| `src/components/crm/lead-detail/LeadActivitiesTab.tsx` | Modificar |
| `src/hooks/useTwilioDevice.ts` | Criar (gerencia Device SDK) |
| `package.json` | Adicionar @twilio/voice-sdk |
| Migration SQL | Criar tabela crm_calls |

---

## Seção Técnica

### Twilio Voice SDK - Inicialização
```typescript
import { Device } from '@twilio/voice-sdk';

const device = new Device(token, {
  edge: 'ashburn', // ou 'sao-paulo' se disponível
  codecPreferences: ['opus', 'pcmu'],
});

device.on('ready', () => console.log('Device ready'));
device.on('connect', (call) => console.log('Connected'));
device.on('disconnect', () => console.log('Call ended'));

// Para fazer chamada
const call = await device.connect({
  params: { To: '+5511999998888', LeadId: 'uuid...' }
});
```

### TwiML Response para Chamada
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="+15551234567" record="record-from-answer-dual">
    <Number statusCallbackEvent="initiated ringing answered completed" 
            statusCallback="https://xxx.supabase.co/functions/v1/twilio-webhook">
      +5511999998888
    </Number>
  </Dial>
</Response>
```

### Segurança
- Todas as edge functions validam JWT do usuário
- Webhook do Twilio valida signature para evitar spoofing
- RLS garante que usuários só veem suas próprias chamadas
- Gravações são privadas e acessíveis apenas via URL assinada

---

## Estimativa de Complexidade
- **Alta:** Envolve SDK externo, WebRTC, webhooks e integração de áudio
- **Tempo estimado:** 2-3 sessões de implementação
- **Dependência externa:** Conta Twilio configurada com número ativo
