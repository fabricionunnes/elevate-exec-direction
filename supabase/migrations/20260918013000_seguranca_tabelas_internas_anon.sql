-- Segurança 18/09/2026: tabelas internas (só telas com login; nenhum acesso sem login em 7 dias, nenhuma função com chave pública).
-- Bloqueia apenas o papel anon; usuários logados e funções do servidor não mudam.
revoke all on public.gamification_configs from anon;
revoke all on public.gamification_levels from anon;
revoke all on public.crm_secondary_goals from anon;
revoke all on public.rescue_playbooks from anon;
revoke all on public.consultant_engagement_scores from anon;
revoke all on public.daily_average_health_scores from anon;
revoke all on public.kpi_target_levels from anon;
revoke all on public.company_salesperson_units from anon;
revoke all on public.academy_badges from anon;
revoke all on public.academy_gamification_config from anon;
revoke all on public.academy_lessons from anon;
revoke all on public.academy_level_definitions from anon;
revoke all on public.academy_tracks from anon;
revoke all on public.academy_user_levels from anon;
