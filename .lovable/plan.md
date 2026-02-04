
# Notificação de Vendas Ganhas no Grupo de WhatsApp

## Resumo

Implementar uma funcionalidade que envia automaticamente uma mensagem para um grupo de WhatsApp quando um lead é marcado como "Ganho" no CRM, contendo todas as informações solicitadas.

---

## Análise dos Campos Disponíveis

### Campos JÁ existentes no sistema:

| Campo Solicitado | Origem | Status |
|------------------|--------|--------|
| Data | `closed_at` do lead | ✅ Disponível |
| SDR | `sdr_staff_id` → `onboarding_staff.name` | ✅ Disponível |
| Closer | `closer_staff_id` → `onboarding_staff.name` | ✅ Disponível |
| Qual serviço? | `product_id` → `onboarding_services.name` | ✅ Disponível |
| Nome da empresa | `company` do lead | ✅ Disponível |
| CNPJ | `document` do lead | ✅ Disponível |
| Segmento | `segment` do lead | ✅ Disponível |
| Plano | `plan_id` → `crm_plans.name` | ✅ Disponível |
| Valor | `opportunity_value` do lead | ✅ Disponível |
| Nome (contato) | `name` do lead | ✅ Disponível |
| Telefone | `phone` do lead | ✅ Disponível |
| E-mail | `email` do lead | ✅ Disponível |
| Cidade | `city` do lead | ✅ Disponível |
| Estado | `state` do lead | ✅ Disponível |
| Briefing | `notes` do lead (pode ser usado) | ✅ Disponível |

### Campos que PRECISAM ser adicionados:

| Campo Solicitado | Solução |
|------------------|---------|
| Nome Fantasia | Novo campo `trade_name` na tabela `crm_leads` |
| CEP | Novo campo `zipcode` na tabela `crm_leads` |
| Quantidade de Parcelas | Novo campo `installments` na tabela `crm_leads` |
| Data de vencimento | Novo campo `due_day` na tabela `crm_leads` (dia do mês) |
| Forma de pagamento | Novo campo `payment_method` na tabela `crm_leads` |

---

## Etapas de Implementação

### 1. Alterações no Banco de Dados

Adicionar novos campos na tabela `crm_leads`:

```sql
ALTER TABLE crm_leads 
ADD COLUMN trade_name TEXT,                    -- Nome Fantasia
ADD COLUMN zipcode TEXT,                       -- CEP
ADD COLUMN installments TEXT,                  -- Ex: "1+3" (entrada + parcelas)
ADD COLUMN due_day INTEGER,                    -- Dia do vencimento (1-31)
ADD COLUMN payment_method TEXT;                -- PIX, Boleto, Cartão, etc.
```

Criar nova configuração na tabela `crm_settings` com as chaves:
- `won_notification_enabled` (boolean)
- `won_notification_instance_id` (UUID da instância WhatsApp)
- `won_notification_group_jid` (ID do grupo no formato `120363XXX@g.us`)

### 2. Interface de Edição do Lead

Modificar a aba "Negócio" ou criar uma seção "Dados do Fechamento" na página de detalhes do lead para incluir:

- Nome Fantasia (texto)
- CEP (texto com máscara)
- Parcelas (ex: "Entrada + 3x")
- Dia de Vencimento (select 1-31)
- Forma de Pagamento (select: PIX, Boleto, Cartão de Crédito, Cartão de Débito, Transferência)
- Campo de Briefing (textarea - usar o campo `notes` existente)

### 3. Interface de Configuração

Nova aba **"Notificações"** nas Configurações do CRM com:

- Toggle para ativar/desativar notificações de venda
- Seletor de instância WhatsApp (das instâncias conectadas)
- Botão para selecionar grupo (usando componente `GroupSelector` existente)
- Preview do grupo selecionado

### 4. Disparo Automático

Modificar a função `handleMarkWon` em `CRMLeadDetailPage.tsx` para:

1. Verificar se notificações estão ativas
2. Buscar todos os dados do lead + relacionamentos (SDR, Closer, Produto, Plano)
3. Formatar a mensagem no formato solicitado
4. Enviar via `evolution-api` usando action `sendGroupText`
5. Registrar log de sucesso/falha (sem bloquear a marcação como ganho)

---

## Formato da Mensagem

```text
🎉 *NOVA VENDA FECHADA!* 🎉

📅 *Data:* 04/02/2026
👥 *SDR:* João Silva
👔 *Closer:* Maria Santos

📋 *DADOS DO NEGÓCIO*
🏢 *Serviço:* UNV Core
🏪 *Empresa:* Empresa LTDA
📝 *Nome Fantasia:* Loja do João
📄 *CNPJ:* 12.345.678/0001-90
🏷️ *Segmento:* Varejo
📦 *Plano:* Anual

💰 *FINANCEIRO*
💵 *Valor:* R$ 15.000,00
🔢 *Parcelas:* Entrada + 3x
📆 *Vencimento:* Dia 10
💳 *Forma:* PIX

👤 *CONTATO*
📛 *Nome:* José da Silva
📱 *Telefone:* (11) 99999-9999
✉️ *E-mail:* jose@empresa.com

📍 *ENDEREÇO*
🏙️ *Cidade:* São Paulo
🗺️ *Estado:* SP
📮 *CEP:* 01234-567

📝 *BRIEFING*
Cliente interessado em automação comercial...

🚀 *Parabéns à equipe!*
```

---

## Arquivos a Modificar/Criar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/crm/CRMSettingsPage.tsx` | Nova aba "Notificações" com configuração do grupo |
| `src/pages/crm/CRMLeadDetailPage.tsx` | Adicionar envio de mensagem após marcar como ganho |
| `src/components/crm/lead-detail/LeadCustomFieldsTab.tsx` | Adicionar campos de fechamento (CEP, Parcelas, etc.) |
| Migração SQL | Novos campos na tabela `crm_leads` |

---

## Fluxo de Funcionamento

```text
Usuário marca lead como Ganho
           ↓
Sistema verifica crm_settings
(won_notification_enabled = true?)
           ↓
     Sim → Busca dados completos do lead
           + SDR, Closer, Produto, Plano
           ↓
     Formata mensagem com template fixo
           ↓
     Envia via evolution-api/sendGroupText
           ↓
     Toast de confirmação (sucesso/erro)
     (não bloqueia o fluxo principal)
```

---

## Considerações Importantes

1. **Instância Conectada**: O grupo precisa pertencer a uma instância do WhatsApp que esteja conectada
2. **Permissões**: O número conectado precisa estar no grupo e ter permissão para enviar mensagens
3. **Falhas Silenciosas**: Se o envio falhar, não deve bloquear a marcação do lead como ganho
4. **Campos Opcionais**: Se algum campo estiver vazio, a linha correspondente será omitida ou exibirá "Não informado"
5. **Formatação**: Valores monetários formatados com R$ e separadores de milhar

