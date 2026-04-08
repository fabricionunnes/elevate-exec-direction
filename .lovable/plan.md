
# CRM Completo para o Portal do Cliente

## Objetivo
Replicar o CRM interno (/#/crm) para o portal do cliente, com interface idêntica mas dados isolados por projeto, permitindo que admins e clientes gerenciem funis.

---

## Fase 1 — Estrutura de Banco de Dados
Criar tabelas dedicadas espelhando a estrutura do CRM interno:

- **`client_crm_leads`** — leads com campos: name, email, phone, company, document, stage_id, origin_id, owner_id, opportunity_value, notes, tags, probability, expected_close_date, closed_at, loss_reason, created_at, etc.
- **`client_crm_lead_tags`** — relação N:N entre leads e tags
- **`client_crm_tag_definitions`** — definições de tags por projeto (name, color)
- **`client_crm_origins`** — origens/fontes de leads por pipeline (tipo: comercial, marketing, venda, recuperação)
- **`client_crm_lead_activities`** — atividades vinculadas a leads (calls, emails, meetings, tasks)
- **`client_crm_lead_interactions`** — histórico de interações no lead
- **`client_crm_stage_checklists`** — checklists por etapa
- **`client_crm_lead_checklist_items`** — itens de checklist concluídos por lead
- **`client_crm_automation_rules`** — regras de automação por pipeline

> As tabelas existentes `client_crm_pipelines`, `client_crm_stages`, `client_crm_contacts`, `client_crm_deals`, `client_crm_activities` serão avaliadas — algumas podem ser reutilizadas ou adaptadas.

**RLS**: Isolamento por `project_id`, acesso apenas para usuários vinculados ao projeto.

---

## Fase 2 — Interface do Pipeline (Kanban)
Replicar o componente `CRMPipelinePage` para o portal do cliente:

- Sidebar de origens (agrupadas por tipo de funil)
- Kanban board com drag & drop
- Cards de lead com informações resumidas
- Filtros completos (busca, data, campos, tags, dono, status, telefone, etapa, valor)
- Indicadores de Forecast e Em Negociação
- Botões de importar e criar negócio

---

## Fase 3 — Módulos Complementares
Replicar as demais abas:

- **Dashboard** — indicadores e gráficos do CRM do cliente
- **Contatos** — lista e gestão de contatos
- **Atividades** — agenda e tarefas
- **Transcrições** — transcrições de reuniões/calls
- **Forecast** — previsão de receita
- **Configurações** — gestão de funis, etapas, origens, automações

---

## Fase 4 — Gestão de Funis (Admin + Cliente)
- Admin interno pode pré-configurar funis para projetos de clientes
- Cliente pode criar/editar/duplicar seus próprios funis e etapas
- Controle de permissão via `project_menu_permissions`

---

## Ordem de Execução
1. Migração do banco de dados (Fase 1)
2. Pipeline/Kanban (Fase 2) — componente principal
3. Módulos complementares (Fase 3) — incrementalmente
4. Gestão de funis (Fase 4)

> ⚠️ Devido à complexidade, cada fase será implementada em etapas separadas para validação.
