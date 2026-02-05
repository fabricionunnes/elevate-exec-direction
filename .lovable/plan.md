
# Plano: Resolver Incompatibilidade de App ID no Instagram OAuth

## Diagnóstico Confirmado
O erro "URL bloqueada" ocorre porque:
- **O código está usando o App ID `585124554636683`**
- **O painel da Meta onde você configurou os redirect URIs tem um App ID diferente**

Ou seja: as configurações estão corretas, mas em apps diferentes.

## Solução
Existem duas opções para resolver:

### Opção A: Configurar o App correto na Meta (Recomendado)
1. No painel da Meta, localize o app com ID `585124554636683`
2. Nesse app específico, adicione:
   - **Valid OAuth Redirect URIs**: `https://elevate-exec-direction.lovable.app/`
   - **Allowed Domains for JS SDK**: `elevate-exec-direction.lovable.app`
3. Ative **"Login do OAuth na Web"** = ON

### Opção B: Atualizar o App ID no código
Se você prefere usar o outro app (o que já está configurado):
1. Obtenha o **App ID** e **App Secret** do app que você configurou
2. Atualize os secrets no backend:
   - `FACEBOOK_APP_ID` → novo App ID
   - `FACEBOOK_APP_SECRET` → novo App Secret

## Detalhes Técnicos

### Arquivos envolvidos (se escolher Opção B):
- **Secrets do backend**: `FACEBOOK_APP_ID` e `FACEBOOK_APP_SECRET`
- Os arquivos de código (`supabase/functions/social-instagram-auth/index.ts`) lêem esses valores de variáveis de ambiente, então basta atualizar os secrets

### Como atualizar secrets:
- Os secrets `FACEBOOK_APP_ID` e `FACEBOOK_APP_SECRET` precisam ser atualizados no painel de backend do projeto

## Próximos Passos
1. Identifique qual dos dois apps você quer usar
2. Se **Opção A**: configure o app `585124554636683` na Meta
3. Se **Opção B**: me informe o novo App ID e vou solicitar a atualização dos secrets
4. Teste a conexão do Instagram novamente

## Critério de Sucesso
- A janela de autorização da Meta abre sem erro "URL bloqueada"
- Após autorizar, o Instagram é conectado com sucesso ao projeto
