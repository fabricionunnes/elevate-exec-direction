

# Plano: Integração com Sigame (Siga-me) para Emissão e Consulta de NFS-e

## Resumo

Criar uma integração com a API da Sigame (sigame.digital) para emitir Notas Fiscais de Serviço (NFS-e) e consultar notas já emitidas, tudo direto do sistema financeiro.

## O que será construído

### 1. Configuração de Segredos
- Armazenar a API Key da Sigame como secret do projeto (`SIGAME_API_KEY`)
- Potencialmente armazenar o ID da empresa na Sigame (`SIGAME_COMPANY_ID`)

### 2. Edge Function `sigame-nfse`
Uma edge function centralizada com as seguintes ações:
- **`emit`** — Emitir NFS-e enviando dados do serviço (descrição, valor, tomador, CNPJ/CPF, etc.) para a API da Sigame
- **`list`** — Listar notas emitidas com filtros de data e status
- **`status`** — Consultar status de uma nota específica (autorizada, cancelada, em processamento)
- **`cancel`** — Cancelar uma NFS-e emitida
- **`download`** — Baixar o PDF/XML de uma nota

### 3. Tabela `nfse_records`
Registrar localmente as notas emitidas para rastreio:
- `id`, `user_id`, `company_id`, `invoice_id` (link opcional com `company_invoices`)
- `sigame_nfse_id`, `number`, `status`, `amount_cents`
- `service_description`, `tomador_name`, `tomador_document`
- `issued_at`, `cancelled_at`, `pdf_url`, `xml_url`

### 4. Interface no Painel Financeiro
- Nova aba ou seção **"Notas Fiscais"** no módulo financeiro
- Botão para emitir NFS-e a partir de uma fatura existente (pré-preenchendo dados)
- Listagem de notas emitidas com status, download de PDF/XML
- Filtros por período, status e empresa

### 5. Integração com Faturas Existentes
- Na tela de faturas (`company_invoices`), adicionar botão "Emitir NFS-e" que preenche automaticamente os dados da nota
- Vincular a NFS-e emitida à fatura original

## Etapas de implementação

1. Solicitar ao usuário a API Key da Sigame via `add_secret`
2. Criar a edge function `sigame-nfse` com CORS e autenticação
3. Criar migração para tabela `nfse_records` com RLS
4. Criar componente de listagem e emissão de NFS-e
5. Integrar botão de emissão nas faturas existentes

## Observação importante

Como a documentação da API da Sigame (docs.sigame.digital) não pôde ser acessada automaticamente, vou precisar que você compartilhe os endpoints e formato de autenticação da API, ou me forneça acesso à documentação para implementar corretamente os chamados.

