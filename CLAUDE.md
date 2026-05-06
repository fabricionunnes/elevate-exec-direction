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
