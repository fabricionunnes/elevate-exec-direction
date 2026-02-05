
Objetivo
- Resolver o erro “URL bloqueada / O redirecionamento falhou porque o URI usado não está na lista…” que ainda aparece mesmo com o redirect URI raiz cadastrado.

O que eu confirmei do lado do app (código/back-end)
- A função que gera o link de autorização está enviando exatamente:
  - `redirect_uri=https://elevate-exec-direction.lovable.app/` (com barra no final)
- Logs do back-end confirmam a mesma URL.
- Portanto, o erro não é “o app está mandando a URL errada”; é o provedor ainda não aceitando esse redirect por alguma configuração adicional.

O que o seu print indica (causa mais provável)
- A mensagem do pop-up diz explicitamente para verificar se **“login do OAuth do cliente da Web”** está ativado e para adicionar domínios.
- No painel “Login do Facebook para Empresas” existem chaves diferentes, e não basta só “Client OAuth Login = ON”.
- Normalmente faltam (ou estão OFF):
  1) “Login do OAuth na Web” (Web OAuth Login)
  2) “Domínios permitidos para o SDK do JavaScript” (Allowed Domains for JS SDK)

Plano (passo a passo no painel da Meta)
1) No menu lateral, abra:
   - “Login do Facebook para Empresas” → “Configurações” (essa mesma tela do print)

2) Na seção “Configurações de OAuth do cliente”, ajustar estes toggles:
   - “Login no OAuth do cliente” → manter **Sim/ON**
   - “Login do OAuth na Web” → colocar **Sim/ON**  (este é o que a mensagem do erro pede)
   - Manter “Usar modo estrito para URIs de redirecionamento” → **Sim/ON** (ok)

3) Na seção “URIs de redirecionamento do OAuth válidos”
   - Deixar (ou adicionar) exatamente:
     - `https://elevate-exec-direction.lovable.app/`
   - Dica: garanta que não tenha espaços antes/depois e que esteja como HTTPS.

4) Na seção “Domínios permitidos para o SDK do JavaScript”
   - Adicionar (um por linha, sem https, sem barras):
     - `elevate-exec-direction.lovable.app`
   - Se o painel aceitar apenas domínio “nu”, use exatamente esse formato.

5) Salvar
   - Clique em “Salvar alterações” (canto inferior direito)

6) Teste end-to-end no app
   - Voltar no UNV Social → Integrações → “Conectar Instagram”
   - Confirmar que o pop-up da Meta não mostra mais “URL bloqueada”

Se ainda falhar (plano de diagnóstico rápido e objetivo)
A) Confirmar o que a Meta considera como “URI usado”
- No pop-up de erro, normalmente dá para ver o domínio/URI que ela rejeitou (às vezes aparece no texto ou na URL da barra do navegador).
- Vamos comparar com o que o app realmente está enviando (que já medi via back-end).

B) Se houver discrepância
- Possibilidades:
  - Você está abrindo o fluxo a partir de um domínio diferente (ex.: preview) em vez do publicado
  - Existe outra parte do frontend gerando link OAuth sem passar pela função (um link “antigo” no código)
- Aí eu implemento um ajuste no frontend para:
  - Exibir (temporariamente) o “authUrl” gerado na tela, para você comparar
  - Registrar no console qual authUrl está sendo aberto, para eliminar qualquer dúvida

Critério de sucesso
- A janela da Meta deve abrir o consentimento sem “URL bloqueada” e, ao finalizar, redirecionar para a raiz do app (que depois roteia internamente para o callback do Social).

Notas importantes (para evitar armadilhas comuns)
- “Valid OAuth Redirect URIs” aceita URL completa (com https).
- “Domínios permitidos para o SDK do JavaScript” normalmente exige apenas domínio (sem protocolo), e é uma validação separada.
- Em “Login para Empresas”, “Client OAuth Login ON” não substitui “Login do OAuth na Web ON”; ambos podem ser necessários.

O que preciso de você (para executar este plano com precisão)
- Após fazer os passos 2–5, se ainda aparecer erro:
  1) Mande um print mostrando:
     - “Login do OAuth na Web” = Sim/ON
     - “Domínios permitidos para o SDK do JavaScript” preenchido
     - “URIs de redirecionamento do OAuth válidos” com a URL raiz
  2) Mande também a URL completa que aparece na barra do navegador quando o pop-up mostra “URL bloqueada” (se estiver visível).
