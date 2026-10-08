# Diretrizes para Claude Code — UNV Nexus

## Fluxo de branches (obrigatório)

Nunca commitar diretamente em `main`. Para qualquer alteração:

1. Criar uma branch antes de editar:
   ```bash
   git checkout -b fix/nome-curto       # para correções
   git checkout -b feat/nome-curto      # para novas funcionalidades
   ```

2. Fazer as alterações e commitar normalmente.

3. Push da branch e abrir PR:
   ```bash
   git push origin nome-da-branch
   gh pr create
   ```

## Stack

- **Frontend:** React + Vite + Tailwind + shadcn/ui
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **Dev:** `npm run dev` → `http://localhost:8080`

## Contexto do projeto

Plataforma SaaS UNV Nexus — all-in-one para gestão comercial de PMEs.
Módulos: CRM, KPIs, RH (UNV Profile), Financeiro, Treinamentos, IA.

## Padrões de código

- Componentes em `src/pages/` organizados por módulo
- Queries Supabase sempre com deduplicação quando há risco de duplicatas via sync
- Migrations em `supabase/migrations/` com timestamp no nome

## Como falar com o Fabrício (regra fixa)

Sempre que uma etapa depender de uma ação dele (aprovar PR, configurar conta, pagar fatura,
registrar domínio, trocar conector), **mandar o link direto e o passo a passo numerado**,
do jeito que ele clica. Nunca só "faça X no painel". Uma mensagem = uma ação. Sem emojis.

## YasFood (sistema da Yas Delícias) — referências operacionais

- Código: `yasfood/` (projeto independente). PR de entrada: #47.
- Site: https://yasfood.unvholdings.workers.dev (Cloudflare Workers, conta `unvholdings`).
- Banco: projeto Supabase Pro `xrncvhzxjmddqluxoosu` (conta fabricioaugustonoliveira@gmail.com),
  tudo no schema `yasfood`, isolado do Nexus. Schema exposto na Data API.
- Deploy e banco: `.github/workflows/deploy-yasfood.yml` (push em `main` ou na branch de trabalho).
  Usa `SUPABASE_ACCESS_TOKEN` (Management API) e os secrets do Cloudflare. O secret `SUPABASE_URL`
  do repo está vazio; a URL é derivada do ref do projeto e a anon key é buscada pela API.
- Admin: usuária `yasmimaguiarsc@gmail.com`. A senha é definida pelo `workflow_dispatch` com o input
  `admin_password` (só disponível com o workflow em `main`). Senha nunca vai pro código.
- Marca: loja "Yas Delícias" (logo da Yasmim em destaque, cores vinho/rosa/creme/chocolate);
  "YasFood" é só o nome do sistema, crédito discreto. Logo: upload em Painel → Configurações.
- Domínio próprio: quando houver, adicionar `routes` em `yasfood/wrangler.toml`.
