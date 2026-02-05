
Objetivo
- Fazer o fluxo “Conectar Instagram” funcionar de ponta a ponta para cada cliente (por projeto), resolvendo o erro “URL bloqueada” e garantindo que o retorno do OAuth caia no callback correto do módulo Social.

Diagnóstico (o que está acontecendo hoje)
- A Meta/Facebook está bloqueando o redirect porque o “redirect_uri” usado no login OAuth precisa estar cadastrado no app da Meta (isso é obrigatório e independe de ser seu Instagram ou do cliente).
- Nosso app usa HashRouter, então o provedor geralmente redireciona para a raiz com query params (ex: https://dominio.com/?code=...&state=...); por isso existe o OAuthRedirectHandler.
- Porém, o OAuthRedirectHandler atualmente identifica qualquer state com “redirectUri” e manda para /auth/instagram/callback (CRM), não para /social/instagram-callback (Social). No Social nós também colocamos “redirectUri” no state, então ele está roteando para a tela errada.
- Resultado: mesmo com credenciais corretas, o retorno do OAuth não finaliza o fluxo do Social, e/ou o cadastro de redirect URI fica confuso.

O que será ajustado no código (sem mudar o objetivo do produto)
1) Corrigir a detecção/roteamento do callback no OAuthRedirectHandler
   - Alterar a lógica para diferenciar:
     - Callback do CRM (instagram-oauth) vs
     - Callback do UNV Social (social-instagram-auth)
   - Estratégia:
     - No state do Social, incluir um campo explícito (ex: provider: "social_instagram" ou flow: "social").
     - No state do CRM, manter o padrão atual (redirectUri/staffId) sem conflitar.
     - No OAuthRedirectHandler:
       - Se state.flow === "social" (ou provider === "social_instagram"), redirecionar para `/social/instagram-callback` preservando `?code=...&state=...`
       - Caso contrário, manter redirecionamento para `/auth/instagram/callback` como hoje.

2) Padronizar “redirect_uri” usado no OAuth com o que o provedor exige
   - Manter o redirect_uri do Facebook Login como a raiz do domínio publicado (SITE_URL), porque:
     - Preview domains mudam e não dá para cadastrar todos.
     - O HashRouter não depende de callback path real no servidor; o handler faz o redirecionamento interno.
   - Garantir que o mesmo redirect_uri (SITE_URL) seja usado:
     - na URL de autorização (dialog/oauth)
     - na troca de código por token (oauth/access_token)
   - (Opcional de robustez) Remover do state campos que confundem (ex: redirectUri), já que para Social basta projectId + flow/provider.

3) Melhorar a UX quando popup é bloqueado (fallback)
   - Na tela de Integrações (SocialIntegrationsTab):
     - Se window.open falhar, mostrar um modal/toast com:
       - botão “Copiar link” (authUrl)
       - instrução simples: “Cole o link em uma nova aba para conectar”
   - Isso evita “travar” o usuário quando o navegador bloqueia popups.

4) Ajustes de callback do Social (SocialInstagramCallback)
   - Garantir que ele consiga ler os params mesmo quando:
     - eles vierem antes do hash (o handler vai resolver isso) e
     - eles vierem já na rota hash `/social/instagram-callback?code=...`
   - Mantém o comportamento de postMessage + fechar janela quando estiver em popup.

Configuração necessária no App da Meta (passo a passo do que você precisa cadastrar)
- No app da Meta, em Facebook Login > Settings:
  - Adicionar em “Valid OAuth Redirect URIs” exatamente o domínio publicado usado como SITE_URL (ex: https://elevate-exec-direction.lovable.app)
  - Se a Meta exigir HTTPS estrito (normal), confirmar que está https.
- Observação importante:
  - Mesmo sendo “Instagram do cliente”, o redirect URI precisa ser do seu app (o seu sistema). O cliente só autoriza a conta dele; o app e seus redirects continuam sendo seus.

Plano de testes (end-to-end)
1) No ambiente publicado, abrir: Social > Strategy > Integrações > Instagram > Conectar
2) Autorizar com uma conta IG Business/Creator vinculada a uma Página do Facebook
3) Confirmar que após autorizar:
   - O popup fecha sozinho (ou mostra sucesso)
   - A lista de integrações atualiza para “Conectado” com @username
4) Validar persistência:
   - Recarregar a página e confirmar que segue conectado
5) Validar erros comuns:
   - Conta pessoal (não Business/Creator) deve retornar mensagem clara
   - Popup bloqueado deve mostrar fallback com link copiável

Riscos e cuidados
- Contas Instagram pessoais não funcionam para publicação via Graph API; precisam ser Creator/Business + vinculadas a uma Página.
- Se o app da Meta estiver em modo “Development”, só usuários com papel no app conseguem autorizar. Para clientes reais, o app precisa estar “Live” e/ou passar por permissões/review conforme os escopos usados.
- Como os preview domains variam, vamos forçar o OAuth a sempre usar o domínio publicado para não quebrar.

Entrega (arquivos que provavelmente serão alterados)
- src/components/OAuthRedirectHandler.tsx (roteamento correto para Social vs CRM)
- supabase/functions/social-instagram-auth/index.ts (state/redirect_uri padronizados)
- src/components/social/strategy/SocialIntegrationsTab.tsx (fallback popup + pequenos ajustes UX)
- (Possível) src/pages/social/SocialInstagramCallback.tsx (robustez de leitura de query se necessário)

O que eu preciso de você (para não bloquear)
- Confirmar se você quer que o OAuth sempre redirecione para o domínio publicado (recomendado) mesmo quando o usuário está no preview.
  - Isso evita “URL bloqueada” por domínio não cadastrado.
