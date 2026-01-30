
# Plano: Migrar para Instância do Steve

## Objetivo
Alterar a configuração da Evolution API para utilizar o servidor do Steve ao invés do servidor atual offline.

## Informações Fornecidas
- **Nova URL**: `https://evo13.stevo.chat`
- **Nova API Key**: `F957367C-7DCB-4638-A8D7-860392B6B2BF`

## O que será alterado

### 1. Atualizar Secret: EVOLUTION_API_URL
- **Valor atual**: `http://104.236.13.238:8080` (offline)
- **Novo valor**: `https://evo13.stevo.chat`

### 2. Atualizar Secret: EVOLUTION_API_KEY
- **Valor atual**: (chave do servidor antigo)
- **Novo valor**: `F957367C-7DCB-4638-A8D7-860392B6B2BF`

## Impacto
- Todas as operações de WhatsApp passarão a usar o servidor do Steve
- A Edge Function `evolution-api` já está preparada para normalizar URLs (remove `/manager` se presente)
- Nenhuma alteração de código é necessária

## Observação Importante
As instâncias existentes no banco de dados (`crm_1769794810028`, etc.) não existirão no servidor do Steve. Será necessário:
1. Criar novas instâncias no novo servidor, ou
2. Recriar as instâncias através da interface de dispositivos

---

## Detalhes Técnicos

A Edge Function `evolution-api` lê as credenciais assim:
```typescript
const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
```

Após atualizar os secrets, a função automaticamente usará o novo servidor.
