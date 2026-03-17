

## Plano: Produto White-Label com Atualizacoes Automaticas

### Conceito

O sistema continuara sendo um **unico deploy** (single codebase, single deployment). Cada tenant (empresa que compra o white-label) tera suas configuracoes armazenadas no banco de dados. Quando o sistema recebe uma atualizacao, **todos os tenants recebem automaticamente** porque todos acessam o mesmo codigo.

A diferenciacao acontece apenas no **branding visual** (logo, cores, nome) e no **isolamento de dados** (cada tenant ve apenas seus proprios dados).

### Arquitetura

```text
                    ┌──────────────────────┐
                    │   Deploy Unico        │
                    │   (codigo atualizado)  │
                    └──────────┬───────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                     │
  tenant-a.nexus.com    tenant-b.nexus.com    unvholdings.com.br
  (logo A, cores A)     (logo B, cores B)     (UNV original)
  (dados isolados)      (dados isolados)      (dados master)
```

### Fase 1 — Infraestrutura Multi-Tenant

**Banco de dados** (3 tabelas novas via migration):

1. **`whitelabel_tenants`** — cadastro de cada empresa compradora
   - `id`, `name`, `slug`, `custom_domain`, `logo_url`, `favicon_url`, `platform_name`, `theme_colors` (jsonb com primary/accent/background/etc), `is_dark_mode`, `status` (active/suspended/trial), `max_active_projects`, `owner_user_id`, `created_at`

2. **`whitelabel_subscriptions`** — controle de cobranca por projeto ativo
   - `id`, `tenant_id`, `price_per_project`, `billing_cycle` (monthly), `active_projects_count`, `current_period_start`, `current_period_end`, `status`, `created_at`

3. **`whitelabel_tenant_users`** — vinculo usuarios ao tenant
   - `id`, `tenant_id`, `user_id` (auth.users), `role` (owner/admin/member), `created_at`

**RLS**: Todas as 3 tabelas com policies usando `SECURITY DEFINER` function `get_user_tenant_id()` para isolar dados.

**Coluna `tenant_id`**: Adicionar em `onboarding_companies`, `onboarding_projects` e tabelas dependentes. `NULL` = tenant UNV original (retrocompativel).

### Fase 2 — Resolucao de Tenant e Branding Dinamico

**Resolver de dominio** — Expandir `domainRouting.ts`:
- Ao carregar, buscar no banco qual tenant corresponde ao dominio/subdominio atual
- Fallback para UNV original se nenhum tenant encontrado

**TenantProvider** (novo React Context):
- Carrega dados do tenant (logo, nome, cores) do banco
- Injeta cores no `ThemeCustomizationContext` existente
- Substitui todas as referencias visuais a "UNV" pelo `platform_name` do tenant
- Componentes como `NexusHeader` lerao o logo/nome do TenantProvider

**Painel de branding** (nova pagina dentro de Settings):
- Upload de logo e favicon (storage bucket)
- Definicao de nome da plataforma
- Picker de cores (reutiliza `ColorCustomizer` existente)
- Preview em tempo real

### Fase 3 — Billing por Projeto Ativo

- Edge Function `whitelabel-meter` (cron diario): conta projetos ativos por tenant, atualiza `active_projects_count`
- Bloqueia criacao de novos projetos se `active_projects_count >= max_active_projects`
- Dashboard de uso para o tenant owner ver consumo
- Integracao com gateway de pagamento existente para fatura mensal automatica

### Fase 4 — Painel Admin do Tenant

- Gestao de usuarios do tenant (convites, roles)
- Configuracoes de branding
- Visualizacao de faturas e uso
- Configuracao de dominio customizado

### Ponto-chave: Atualizacoes Automaticas

Como tudo roda no **mesmo deploy**, qualquer feature nova que voce adicionar ao sistema ja estara disponivel para todos os tenants. O unico filtro e o `tenant_id` nos dados — o codigo e identico para todos.

### Ordem de Implementacao Sugerida

Comecar pela **Fase 1 + Fase 2** juntas, pois entregam o core funcional do white-label (tabelas + branding dinamico). Fases 3 e 4 vem em seguida.

