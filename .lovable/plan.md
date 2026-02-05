
Contexto (o que eu já consegui confirmar)
- O app está gerando a URL de autorização assim (via função `social-instagram-auth`):
  - `client_id=585124554636683`
  - `redirect_uri=https://elevate-exec-direction.lovable.app`
  - `state` contém `{"projectId":"...","flow":"social"}`
- Você já cadastrou estas Redirect URIs e está com Strict Mode ON:
  - https://elevate-exec-direction.lovable.app
  - https://elevate-exec-direction.lovable.app/
  - https://elevate-exec-direction.lovable.app/social/instagram-callback
- Mesmo assim, a Meta segue exibindo “URL blocked / redirect URI”.

Hipóteses mais prováveis para “URL blocked” com Strict Mode ON (mesmo com URIs cadastradas)
1) Você cadastrou as URIs no lugar certo, mas faltou cadastrar o domínio em “App Domains” (Configurações > Básico).
   - Em modo estrito, a Meta pode validar também se o domínio do `redirect_uri` está listado em “App Domains”.
2) A plataforma “Website” (ou equivalente) não está adicionada/ativada no app (Configurações > Básico > Adicionar Plataforma).
   - Em alguns setups, sem Website + Site URL, o login acusa URL bloqueada.
3) Você está editando um app da Meta diferente daquele do `client_id` usado no link (585124554636683).
   - Parece óbvio, mas é uma causa comum: o link usa um App ID, mas você cadastrou as URIs em outro app.
4) Diferença sutil de URL normalizada no Strict Mode.
   - Apesar de você ter cadastrado com e sem “/”, a Meta pode estar comparando com alguma variação (ex.: com `www`, ou com subdomínio diferente, ou normalização interna).

O que farei em seguida (implementação + validação) — sequência recomendada
A) Checklist guiado de configuração no painel da Meta (sem mexer no código ainda)
1. Confirmar que você está no app correto:
   - Verificar se o “App ID” no painel da Meta é exatamente: 585124554636683
2. Configurações > Básico:
   - Em “App Domains”, adicionar exatamente:
     - elevate-exec-direction.lovable.app
   - Salvar
3. Ainda em Básico (ou “Adicionar Plataforma”):
   - Adicionar plataforma “Website”
   - Definir “Site URL” como:
     - https://elevate-exec-direction.lovable.app/
   - Salvar
4. Facebook Login > Settings:
   - Manter Strict Mode ON (ok)
   - Conferir se “Client OAuth Login” está ON (se existir essa opção)
   - Em “Valid OAuth Redirect URIs”, manter pelo menos:
     - https://elevate-exec-direction.lovable.app
     - https://elevate-exec-direction.lovable.app/
   - Salvar
5. Testar de novo o “Conectar” após salvar tudo.

B) Se ainda falhar: ajuste pequeno no código para eliminar qualquer mismatch de barra final (robustez)
1. Atualizar a função `supabase/functions/social-instagram-auth/index.ts` para normalizar o redirect_uri:
   - Garantir que `redirect_uri` sempre seja a versão com barra no final:
     - `https://elevate-exec-direction.lovable.app/`
   - Usar essa mesma string:
     - na URL de autorização (dialog/oauth)
     - na troca de código (oauth/access_token)
2. Adicionar log explícito na função:
   - Logar o `redirect_uri` final usado, para confirmar 100% a string enviada.
3. (Opcional) Exibir no frontend (temporariamente) o domínio de redirect que está sendo usado, para você comparar com o painel.

C) Testes end-to-end (o que validar)
1. Na aba Integrações (UNV Social) clicar “Conectar Instagram”
2. Confirmar que a página da Meta NÃO mostra mais “URL blocked”
3. Completar autorização com uma conta que tenha Instagram Business/Creator e Página vinculada
4. Confirmar que:
   - abre /social/instagram-callback
   - aparece sucesso
   - volta e marca “Conectado” com @username

D) Se mesmo após A+B persistir: coleta objetiva para fechar diagnóstico
- Capturar 2 informações (sem suposições):
  1) Print do erro completo (linha que mostra o `redirect_uri` que a Meta reclama)
  2) Confirmar o App ID do app onde você cadastrou as URIs (tem que bater com 585124554636683)
- Com isso eu consigo dizer exatamente se é app errado, domínio não permitido, ou mismatch de URL.

Arquivos que eu alteraria na etapa B (se necessário)
- `supabase/functions/social-instagram-auth/index.ts` (normalizar `redirect_uri` com barra final + logs)
- (Nenhum outro arquivo é obrigatório para esse ajuste; o roteamento do callback já está correto pelo `flow: "social"`)

Observação importante (para evitar confusão)
- Você NÃO precisa cadastrar `.../social/instagram-callback` como redirect no provedor se o nosso fluxo usa HashRouter com handler na raiz. O mais confiável é cadastrar só a raiz do domínio (com e sem /), e manter o handler cuidando do redirecionamento interno.
