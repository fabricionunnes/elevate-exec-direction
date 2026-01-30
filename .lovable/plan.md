
# Reset da Integração WhatsApp

## Objetivo
Limpar todos os dados relacionados ao WhatsApp no sistema para recomeçar do zero a integração com o STEVO (Evolution API).

## O que será feito

### 1. Limpeza do Banco de Dados

Vamos executar uma migração SQL para limpar as tabelas na ordem correta (respeitando foreign keys):

```text
+---------------------------+     +---------------------------+
|  crm_whatsapp_messages    | --> |  crm_whatsapp_conversations|
+---------------------------+     +---------------------------+
              |                               |
              v                               v
+---------------------------+     +---------------------------+
|  crm_whatsapp_contacts    |     |   whatsapp_instances      |
+---------------------------+     +---------------------------+
              |
              v
+---------------------------+
| crm_service_staff_devices |
+---------------------------+
```

**Tabelas que serão limpas:**
- `crm_whatsapp_messages` (0 registros)
- `crm_whatsapp_conversations` (0 registros) 
- `crm_whatsapp_contacts` (0 registros)
- `crm_service_staff_devices` (0 registros)
- `whatsapp_instances` (1 registro: comercial-nexus)
- `whatsapp_message_log` (logs de mensagens enviadas)

### 2. Resultado Final

Depois do reset:
- Todas as tabelas de WhatsApp estarão vazias
- A tela de Dispositivos mostrará "Nenhum dispositivo configurado"
- Você poderá criar uma nova instância do zero usando o botão "Novo dispositivo"
- A nova instância será criada tanto no sistema quanto no STEVO automaticamente

### 3. Próximos Passos (Após Aprovação)

1. Executar a migração para limpar as tabelas
2. Atualizar a página do CRM Inbox
3. Ir em Configurações > WhatsApp > Dispositivos
4. Clicar em "Novo dispositivo"
5. Informar nome e número com DDI (ex: 5531989840003)
6. Escanear o QR Code para conectar

## Detalhes Técnicos

### Migração SQL
```sql
-- Limpar na ordem correta (respeitando FKs)
DELETE FROM public.crm_whatsapp_messages;
DELETE FROM public.crm_whatsapp_conversations;
DELETE FROM public.crm_whatsapp_contacts;
DELETE FROM public.crm_service_staff_devices;
DELETE FROM public.whatsapp_message_log;
DELETE FROM public.whatsapp_instances;
```

### Arquivos Envolvidos
Os arquivos de código não precisam de alteração - apenas os dados serão limpos:
- `src/components/crm/service-config/DevicesSection.tsx` - já funciona para criar novas instâncias
- `src/components/onboarding-tasks/WhatsAppQRCodeModal.tsx` - já funciona para gerar QR
- `supabase/functions/evolution-api/index.ts` - edge function já configurada com a API Key correta

### Sobre a instância no STEVO
A instância `comercial-nexus` que existe no STEVO **não será apagada automaticamente**. Se você quiser também removê-la do servidor, pode:
1. Usar o Evolution Manager em `http://evo13.stevo.chat:8080/manager`
2. Ou informar que quer que eu apague via API

Recomendo manter a instância no STEVO e apenas criar uma nova no sistema com o mesmo nome, para reaproveitar a conexão.
