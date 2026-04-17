
-- 1) Adicionar tenant_id em asaas_accounts
ALTER TABLE public.asaas_accounts ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.whitelabel_tenants(id) ON DELETE CASCADE;

-- Política: tenant só vê suas próprias contas Asaas; master (tenant_id NULL) vê as globais
DROP POLICY IF EXISTS "Tenant isolation" ON public.asaas_accounts;
CREATE POLICY "Tenant isolation" ON public.asaas_accounts
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (tenant_id IS NOT DISTINCT FROM public.current_user_tenant_id())
  WITH CHECK (tenant_id IS NOT DISTINCT FROM public.current_user_tenant_id());

-- 2) Função helper: o usuário atual é tenant white-label?
CREATE OR REPLACE FUNCTION public.current_user_is_tenant()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.current_user_tenant_id() IS NOT NULL
$$;

-- 3) Aplicar bloqueio RESTRICTIVE em todas as tabelas que NÃO devem ser visíveis por tenants
-- Tenant não vê NADA dessas tabelas. Master (tenant_id NULL) vê tudo normalmente.
DO $$
DECLARE
  t text;
  blocked_tables text[] := ARRAY[
    -- Financeiro Master (não-cliente)
    'financial_payables','financial_receivables','financial_categories','financial_cost_centers',
    'financial_bank_accounts','financial_bank_transactions','financial_invoices','financial_recurring_rules',
    'company_invoices','company_recurring_charges','company_payment_methods',
    'pagarme_orders','payment_links','billing_notification_logs','billing_notification_rules',
    -- CRM Master
    'crm_lead_activities','crm_lead_history','crm_lead_tags','crm_lead_summaries',
    'crm_loss_reasons','crm_origins','crm_origin_groups','crm_tags','crm_settings',
    'crm_meeting_events','crm_message_sequences','crm_sequence_steps','crm_sequence_enrollments',
    'crm_stage_checklists','crm_lead_checklist_items','crm_call_summaries','crm_transcriptions',
    'crm_forecasts','crm_notifications',
    -- Onboarding/Tarefas Master
    'onboarding_tasks','onboarding_task_templates','onboarding_meetings','onboarding_documents',
    'onboarding_kpis','onboarding_kickoff','onboarding_health_scores','onboarding_user_permissions',
    'onboarding_consultants','onboarding_ai_chat',
    -- Comissões / KPIs
    'kpi_dashboards','kpi_targets','kpi_periods','commission_tiers','commission_calculations',
    -- Comunicação
    'whatsapp_instances','whatsapp_instance_access','whatsapp_messages','whatsapp_contacts',
    'whatsapp_conversations','evolution_config',
    -- Recrutamento / RH
    'candidates','candidate_resumes','candidate_disc_results','candidate_ai_evaluations',
    'candidate_tags','employee_contracts','hr_jobs',
    -- B2B Prospecção
    'b2b_leads','b2b_saved_lists','b2b_search_history','b2b_search_logs','b2b_lead_notes',
    -- Automação
    'automation_rules','automation_executions',
    -- Academy / Avaliações
    'academy_user_access','academy_progress','assessment_cycles','assessment_participants','assessment_360_evaluations',
    -- API Keys / Integrações sensíveis
    'api_keys'
  ];
BEGIN
  FOREACH t IN ARRAY blocked_tables LOOP
    -- só aplica se a tabela existir
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP POLICY IF EXISTS "Tenant isolation block" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "Tenant isolation block" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.current_user_is_tenant()) WITH CHECK (NOT public.current_user_is_tenant())',
        t
      );
    END IF;
  END LOOP;
END $$;
