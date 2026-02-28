

# Adicionar Botao de WhatsApp nas Faturas da Empresa

## Objetivo
Adicionar um botao de envio de mensagem WhatsApp (lembrete/cobranca) em cada fatura na tela de faturas da empresa (`CompanyInvoicesList`), permitindo enviar mensagens diretamente para o cliente com informacoes da fatura.

## O que sera feito

### 1. Buscar dados da empresa (telefone e nome)
- O componente ja recebe `companyId`. Sera adicionada uma query para buscar o telefone e nome da empresa na tabela `onboarding_companies` para usar no envio.

### 2. Adicionar botao WhatsApp em cada fatura
- Nas faturas pendentes/vencidas (onde ja aparecem Link, Dar Baixa, Pagar), adicionar um botao com icone de WhatsApp para enviar lembrete.
- O botao abrira o `WhatsAppMessageDialog` ja existente no sistema.
- A mensagem padrao sera gerada automaticamente com os dados da fatura: descricao, valor, vencimento e link de pagamento (se houver).

### 3. Template da mensagem automatica
A mensagem padrao incluira:
- Nome da empresa
- Descricao da fatura
- Valor (com juros/multa se vencida)
- Data de vencimento
- Link de pagamento (quando disponivel)

## Detalhes Tecnicos

### Arquivo modificado: `src/components/company-financial/CompanyInvoicesList.tsx`

1. Importar `WhatsAppSendButton` de `@/components/onboarding-tasks/WhatsAppSendButton`
2. Adicionar estado e `useEffect` para buscar telefone da empresa via `onboarding_companies`
3. Na area de botoes de cada fatura (pendente/vencida), adicionar o `WhatsAppSendButton` com:
   - `phone`: telefone da empresa
   - `recipientName`: nome da empresa
   - `companyId`: ID da empresa
   - `defaultMessage`: mensagem gerada com dados da fatura
   - `variant="ghost"` para manter consistencia visual

O botao aparecera ao lado dos botoes existentes (Link, Dar Baixa, Pagar) apenas para faturas nao pagas e nao canceladas.
