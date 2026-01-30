
# Importar Instâncias do STEVO (em vez de criar)

## Entendimento

Você está certo! A abordagem atual tenta criar instâncias via API e falha. A solução mais simples é:

1. **Você conecta o WhatsApp direto no STEVO** (Evolution Manager)
2. **No sistema, você apenas importa** as instâncias que já existem lá

## O que será feito

### 1. Novo botão "Importar do STEVO"

Adicionar um botão ao lado de "Novo dispositivo" que:
- Chama a API para listar instâncias existentes no STEVO
- Mostra um modal com as instâncias disponíveis para importar
- Permite selecionar qual importar para o banco local

### 2. Modal de Importação

```text
+------------------------------------------+
|       Importar Instância do STEVO        |
+------------------------------------------+
|                                          |
|  Instâncias disponíveis:                 |
|                                          |
|  [x] comercial-nexus                     |
|      Status: Conectado                   |
|      Telefone: 5531989840003             |
|                                          |
|  [ ] suporte-nexus                       |
|      Status: Desconectado                |
|                                          |
+------------------------------------------+
|              [Cancelar] [Importar]       |
+------------------------------------------+
```

### 3. Fluxo Simplificado

```text
Usuário                      STEVO                    Sistema Local
   |                           |                           |
   |-- Cria instância -------->|                           |
   |-- Escaneia QR Code ------>|                           |
   |<-- WhatsApp conectado ----|                           |
   |                           |                           |
   |-- Clica "Importar" ------------------------------>|
   |                           |<-- Lista instâncias ---|
   |<-- Mostra disponíveis ----------------------------|
   |-- Seleciona e confirma -------------------------->|
   |                           |                       |-- Salva no DB
   |<-- Instância importada! --------------------------|
```

## Mudanças Técnicas

### Arquivo: `src/components/crm/service-config/DevicesSection.tsx`

1. Adicionar estado para modal de importação
2. Criar função `handleImportFromStevo()` que:
   - Chama `evolution-api` com `action: 'list-instances'`
   - Filtra instâncias que ainda não estão no banco local
   - Mostra modal para seleção
3. Criar função `handleConfirmImport()` que:
   - Insere a instância selecionada no `whatsapp_instances`
   - Configura o webhook automaticamente
4. Adicionar novo Dialog para seleção de instâncias

### Mudanças na UI

- Botão "Importar do STEVO" (ícone de download/refresh)
- Modal listando instâncias disponíveis no servidor
- Checkbox para selecionar qual importar
- Campos para dar um nome de exibição

## Resultado Final

- O botão "Novo dispositivo" ainda existirá (caso queira criar via API)
- O botão **"Importar do STEVO"** será a opção principal e mais confiável
- Você conecta no STEVO, depois importa aqui - sem erros de 404
