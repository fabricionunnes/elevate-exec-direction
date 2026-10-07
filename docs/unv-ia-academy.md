# UNV IA Academy

Produto de assinatura que ensina o empresário de PME a implantar IA no comercial
usando o Método CRESCER, dentro do módulo Academy do UNV Nexus.

## Oferta

| Plano   | Preço        | Observação                                  |
|---------|--------------|---------------------------------------------|
| Anual   | R$ 2.497/ano | Plano principal, "2 meses grátis"           |
| Mensal  | R$ 297/mês   | Sem fidelidade                               |

Incluído em qualquer plano:

- 7 trilhas (Trilha 0 aberta + uma trilha por fase do CRESCER), cada aula com roteiro e entregável.
- 1 sessão individual de planejamento ao vivo com o Fabrício na entrada (1:1).
- 1 hotseat mensal em grupo, ao vivo, com o Fabrício.
- Laboratório de Agentes: prompts, agentes e fluxos N8N prontos pra copiar.
- Tutor IA dentro de cada aula.
- Entregáveis revisados pelo time UNV, pontos, níveis e certificado.

Clientes DCT e Mastermind já têm acesso ao Academy pelo papel `client`.

## URLs

| O quê                       | URL                                                    |
|-----------------------------|--------------------------------------------------------|
| Página de vendas (estática) | `unvholdings.com.br/unviaacademy/`                     |
| Checkout                    | `unvholdings.com.br/#/unviaacademy/checkout?plano=anual` ou `mensal` |
| Obrigado                    | `unvholdings.com.br/#/unviaacademy/obrigado`           |
| Área do aluno               | `unvholdings.com.br/#/academy` (login em `/#/onboarding-tasks/login`) |

O item "UNV IA Academy" está no menu Serviços > Trilha Principal do site.

## O que foi construído

### Banco (migrations)

- `20261007150000_unv_ia_academy_schema.sql`
  - Colunas novas: `academy_tracks.program / is_free_preview / crescer_phase`,
    `academy_lessons.lesson_kind / content_md / deliverable_prompt / deliverable_points`.
  - Tabelas: `ia_academy_subscriptions`, `ia_academy_live_sessions`,
    `ia_academy_live_registrations`, `academy_lesson_deliverables`,
    `ia_academy_lab_items`, `ia_academy_tutor_messages`.
  - Funções: `ia_academy_is_staff()`, `ia_academy_my_onboarding_user_ids()`,
    `ia_academy_find_user_by_email()` (service role), `ia_academy_review_deliverable()`.
  - RLS em tudo, com o bloqueio de tenant white-label igual às demais tabelas do Academy.
- `20261007151000_unv_ia_academy_seed.sql`
  - 7 trilhas, 35 aulas com roteiro (markdown) e entregável, 19 itens do Laboratório.
  - Idempotente (`ON CONFLICT DO NOTHING`). Vídeos entram depois pelo admin.

### Edge functions

- `ia-academy-checkout` (público): `create` (Asaas customer + subscription + Pix QR / link do cartão,
  cria a conta auth com a senha do aluno), `status` (polling, com fallback consultando o Asaas),
  `asaas_event` (ativa / renova / atraso / estorno). Ao ativar: cria empresa, projeto
  `ia_academy`, `onboarding_user` (role `client`), `academy_user_access`, lead no CRM,
  e manda boas-vindas por e-mail (`send-welcome-email`) e WhatsApp (Evolution).
- `academy-tutor` (autenticado): tutor IA com contexto da aula, do entregável e do plano
  da sessão individual. Modelo em `ACADEMY_TUTOR_MODEL` (padrão `claude-sonnet-5-5`).
- `asaas-webhook`: encaminha eventos de `externalReference = ia-academy:<id>` ou da
  assinatura Asaas pra `ia-academy-checkout`.

### Frontend

- Página de vendas estática: `public/unviaacademy/index.html`.
- Checkout e obrigado: `src/pages/ia-academy/`.
- Aluno: `Encontros ao Vivo` (`/academy/live`), `Laboratório de Agentes` (`/academy/lab`),
  roteiro + entregável + tutor dentro da aula.
- Admin: `Assinantes IA Academy` (`/academy/admin/subscribers`, agenda da sessão 1:1),
  `Encontros` (`/academy/admin/live`), `Entregáveis` (`/academy/admin/deliverables`),
  `Laboratório` (`/academy/admin/lab`). O form de aula em `Admin: Conteúdos` ganhou
  roteiro, entregável, duração e tipo.

## Publicar

1. **Migrations**: aplicar as duas no projeto Nexus (`xrncvhzxjmddqluxoosu`) via
   `supabase db push` ou pelo SQL Editor, nesta ordem: schema, seed.
2. **Edge functions**: o workflow `deploy-functions.yml` já inclui `ia-academy-checkout`
   (sem JWT) e `academy-tutor` (com JWT) e redeploya `asaas-webhook` no push pra `main`.
   Manual: `supabase functions deploy ia-academy-checkout --no-verify-jwt` e
   `supabase functions deploy academy-tutor`.
3. **Secrets** usados (já existentes no projeto): `ASAAS_API_KEY`, `ANTHROPIC_API_KEY`,
   `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`. Opcionais: `IA_ACADEMY_WA_INSTANCE`
   (instância do WhatsApp pras boas-vindas; cai em `EVOLUTION_INSTANCE`), `SITE_URL`,
   `ACADEMY_TUTOR_MODEL`.
4. **Asaas**: o webhook já aponta pra `asaas-webhook`; nada a mudar.
5. **Frontend**: deploy normal (`deploy-frontend.yml`).

## Operar

- **Sessão individual**: o aluno pede em `Encontros ao Vivo` com horários preferidos. Em
  `Admin: Assinantes IA Academy` você agenda (data, link), marca como realizada e cola o
  plano de IA em markdown, que aparece pro aluno e alimenta o Tutor IA.
- **Hotseat mensal**: crie o encontro em `Admin: Encontros` (tipo Hotseat, data, link da sala).
  Os inscritos enviam o caso; marque quem vai pra cadeira quente. Depois, suba a gravação
  como aula (tipo "Gravação de encontro") e vincule no encontro.
- **Entregáveis**: fila em `Admin: Entregáveis`. Aprovar pontua uma única vez.
- **Conteúdo**: vídeos e ajustes de roteiro em `Admin: Conteúdos`. Novos prompts e fluxos
  em `Admin: Laboratório`.

## Métricas que importam

Alunos ativos, MRR equivalente (painel de assinantes), conclusão de trilha, entregáveis
aprovados por aluno, presença no hotseat, NPS, churn mensal, conversão aluno → DCT.

## Próximos passos sugeridos

- Gravar a Trilha 0 e a Trilha 3 primeiro (vitória rápida: agente SDR rodando).
- Grupo de WhatsApp da turma via N8N no evento de ativação.
- Pixel: Purchase server-side (CAPI) no gate de pagamento, como no UNV Start.
- Lembrete automático do hotseat (24h e 1h antes) pelos inscritos.
