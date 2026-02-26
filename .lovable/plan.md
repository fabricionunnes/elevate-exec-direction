
# Adicionar campo para codigo embed no Trafego Pago

## Problema
Atualmente so aceita URL do Looker Studio. O usuario quer poder colar diretamente o codigo embed (iframe) gerado pelo Looker Studio, que ja vem pronto para incorporar.

## Solucao
Modificar o `ClientPaidTrafficPanel` e o dialog de configuracao para aceitar **duas opcoes**: URL ou codigo embed. Tambem adicionar uma nova coluna no banco para armazenar o codigo embed.

## Mudancas

### 1. Banco de dados (migracao)
- Adicionar coluna `looker_embed_code` (TEXT) na tabela `onboarding_projects`

### 2. `ClientPaidTrafficPanel.tsx`
- Adicionar estado `embedCode` para armazenar o codigo embed do banco
- No dialog de configuracao, adicionar um **Textarea** para colar o codigo embed, alem do campo de URL existente
- Adicionar tabs ou separador "URL" vs "Codigo Embed" no dialog para o usuario escolher qual metodo usar
- Na renderizacao do dashboard:
  - Se tiver `embedCode`, usar `dangerouslySetInnerHTML` para renderizar o iframe direto (extraindo apenas a tag iframe por seguranca)
  - Se tiver apenas `lookerUrl`, manter o comportamento atual com iframe gerado pelo sistema
- Atualizar `fetchLookerUrl` para tambem buscar `looker_embed_code`
- Atualizar `saveLookerUrl` para salvar o campo correto baseado na opcao escolhida

### 3. Detalhes tecnicos
- Para seguranca, ao receber o codigo embed, extrair apenas o `src` da tag `<iframe>` usando regex, e renderizar um iframe controlado pelo React (evitando `dangerouslySetInnerHTML`)
- O dialog tera duas abas: "Link" e "Codigo Embed" usando componentes de Tabs do Radix
- Prioridade de exibicao: embed code > URL
