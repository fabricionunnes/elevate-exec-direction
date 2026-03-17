

# Integração Bidirecional CRM Comercial ↔ Clint

## Contexto

A Clint possui uma API REST pública (`api.clint.digital/v1`) com endpoints para **contatos**, **negócios (deals)**, **origens**, **tags** e **grupos**. A autenticação é feita via `api-token` no header. Importante: a API da Clint **não suporta atividades** nem **atendimento/mensagens** — essas funcionalidades ficam de fora.

O sistema já possui uma integração parcial com a Clint via `sheets-webhook` (Google Sheets), mas não há integração direta via API.

## Escopo da Integração

### Direção 1: Clint → CRM Comercial (Webhook)
A Clint suporta webhooks. Quando algo muda na Clint, ela envia um POST para nosso sistema.

### Direção 2: CRM Comercial → Clint (API REST)
Quando algo muda no CRM Comercial, chamamos a API da Clint para sincronizar.

## Limitações da API Clint
- **Atividades/tarefas** não estão disponíveis na API pública
- **Mensagens** (WhatsApp, Instagram, email) não estão disponíveis
- Disponível apenas no plano **Elite** da Clint

## Dados Sincronizáveis

| Dado | Clint → CRM | CRM → Clint |
|------|:-----------:|:-----------:|
| Contatos (nome, telefone, email) | ✓ | ✓ |
| Negócios (deals/oportunidades) | ✓ | ✓ |
| Tags | ✓ | ✓ |
| Origens | ✓ | ✓ |
| Status de perda | ✓ | ✓ |
| Atividades | ✗ | ✗ |
| Mensagens | ✗ | ✗ |

## Plano Técnico

### 1. Tabela de configuração da integração
Criar tabela `crm_clint_config` para armazenar:
- `project_id` (qual projeto/pipeline usar)
- `api_token` (encrypted via secret)
- `webhook_secret` (para validar webhooks)
- `pipeline_mapping` (JSON mapeando pipelines CRM ↔ funis Clint)
- `sync_enabled`, `sync_direction` (bidirecional, apenas entrada, apenas saída)
- `last_sync_at`

Criar tabela `crm_clint_sync_log` para rastrear IDs sincronizados:
- `crm_lead_id` ↔ `clint_contact_id`
- `crm_lead_id` ↔ `clint_deal_id`
- `sync_status`, `last_synced_at`

### 2. Edge Function: `clint-webhook` (Clint → CRM)
- Recebe webhooks da Clint quando contatos/negócios são criados ou atualizados
- Mapeia campos da Clint para `crm_leads` (nome, telefone, email, empresa, valor da oportunidade)
- Usa `crm_clint_sync_log` para evitar duplicatas e loops de sincronização
- Cria atividades no histórico do lead

### 3. Edge Function: `clint-sync` (CRM → Clint)
- Chamada quando leads são criados/atualizados no CRM Comercial
- Envia dados para a API da Clint via `POST /v1/contacts` e `POST /v1/deals`
- Atualiza `crm_clint_sync_log` com os IDs da Clint
- Inclui flag `syncing` para evitar loop infinito (webhook recebido de volta)

### 4. Tela de configuração
- Adicionar aba "Integrações" nas configurações do CRM
- Campos: API Token da Clint, mapeamento de pipelines, toggle de sincronização
- Botão de teste de conexão
- Log de sincronização visível

### 5. Hooks no frontend
- Após criar/editar lead no CRM, chamar `clint-sync` em background
- Após mover lead de etapa, sincronizar status do deal na Clint

## Pré-requisitos
- Você precisa ter o **plano Elite** da Clint para acesso à API
- Precisaremos do seu **API Token** da Clint (disponível em Conta → API na plataforma Clint)
- Configurar o webhook na Clint apontando para nossa Edge Function

## Ordem de Implementação
1. Criar tabelas de configuração e sync log (migração)
2. Criar Edge Function `clint-webhook` (receber dados da Clint)
3. Criar Edge Function `clint-sync` (enviar dados para Clint)
4. Criar tela de configuração da integração no CRM
5. Adicionar hooks de sincronização automática no frontend
6. Implementar proteção anti-loop e tratamento de erros

