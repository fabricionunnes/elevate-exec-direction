

## Nova aba "Instancia" no Modulo Financeiro

### O que sera feito
Adicionar uma nova aba chamada "Instancia" no menu do modulo financeiro, onde voce podera selecionar qual instancia de WhatsApp sera usada como padrao para envio de mensagens. Ao trocar, a alteracao sera aplicada imediatamente em todo o sistema (Contas a Receber, Regua de Cobrancas, etc.).

### Implementacao

**1. Criar componente `WhatsAppInstancePanel`**
- Novo arquivo: `src/components/financial/WhatsAppInstancePanel.tsx`
- Lista todas as instancias cadastradas na tabela `whatsapp_instances` em um dropdown
- Mostra o status de cada instancia (conectada, desconectada) com indicador visual colorido
- A instancia atualmente configurada fica pre-selecionada
- Ao trocar, salva automaticamente no banco (`whatsapp_default_config`) e invalida o cache local
- Exibe confirmacao visual apos a troca

**2. Adicionar aba no FinancialModulePage**
- Arquivo: `src/pages/onboarding-tasks/FinancialModulePage.tsx`
- Nova entrada na lista de tabs com icone `MessageSquare` e label "Instancia"
- Renderiza o `WhatsAppInstancePanel` no conteudo da aba

### Como funciona a propagacao
O sistema ja usa a funcao `getDefaultWhatsAppInstance()` com cache de 1 minuto em todos os pontos de envio. Ao trocar a instancia no painel, o cache e invalidado imediatamente via `invalidateDefaultInstanceCache()`, garantindo que a proxima mensagem enviada (em Contas a Receber ou qualquer outro local) ja use a nova instancia.

### Arquivos
- `src/components/financial/WhatsAppInstancePanel.tsx` (novo)
- `src/pages/onboarding-tasks/FinancialModulePage.tsx` (adicionar aba)

