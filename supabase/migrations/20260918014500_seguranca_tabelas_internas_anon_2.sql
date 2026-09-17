-- Segurança 18/09/2026: mais 4 tabelas internas bloqueadas só para o papel anon (funções usam service role).
revoke all on public.crm_goal_types from anon;
revoke all on public.crm_goal_values from anon;
revoke all on public.onboarding_task_templates from anon;
revoke all on public.meta_capi_log from anon;
