-- Etapa 1 do fechamento das regras abertas a visitantes (23/11/2026): 84 tabelas sem acesso anônimo nos
-- últimos 7 dias e sem página pública. Cada regra que valia pra public/anon passa a valer só pra authenticated.
-- A posição anterior fica em zz_rls_fechamento_20261123 (pra desfazer: alter policy ... to <roles_antes>).

create table if not exists public.zz_rls_fechamento_20261123 (tablename text, policyname text, cmd text, roles_antes name[], feito_em timestamptz default now());
alter table public.zz_rls_fechamento_20261123 enable row level security;
revoke all on public.zz_rls_fechamento_20261123 from anon, authenticated;
do $f$
declare p record; n int := 0;
begin
  for p in
    select tablename, policyname, cmd, roles from pg_policies
     where schemaname = 'public' and tablename in ('academy_gamification_config','academy_lesson_assets','academy_level_definitions','academy_points_ledger','academy_user_badges','academy_user_levels','agent_chat_ids','cac_cost_items','candidate_tags','circle_ads_config','circle_ads_quality_scores','circle_area_reputation','circle_area_reputation_events','circle_badges','circle_boost_config','circle_community_access','circle_community_members','circle_follows','circle_levels','circle_likes','circle_marketplace_analytics','circle_marketplace_events','circle_marketplace_images','circle_points_config','circle_story_comments','circle_trust_config','circle_trust_events','circle_user_badges','client_board_opinions','client_board_sessions','client_customers','client_financial_bank_accounts','client_financial_bank_transactions','client_inventory_alerts','client_sale_budget_items','client_sale_budgets','closer_diagnostics','company_salesperson_units','consultant_engagement_scores','crm_goal_types','crm_goal_values','crm_keyword_trigger_logs','crm_lead_form_answers','crm_secondary_goals','crm_staff_goals','daily_average_health_scores','gamification_badges','gamification_configs','gamification_leaderboard_snapshots','gamification_levels','gamification_mission_progress','gamification_missions','gamification_participants','gamification_rewards','gamification_score_logs','gamification_scoring_rules','gamification_seasons','gamification_team_members','gamification_teams','gamification_user_badges','interview_scorecard_criteria','interview_scorecard_scores','kpi_target_levels','mansao_central','mansao_central_docs','mansao_estudio','mansao_estudio_chats','mansao_estudio_fin','mansao_estudio_msgs','mansao_estudio_settings','mansao_estudio_video','meeting_briefings','meeting_sentiment_analysis','meta_capi_log','north_star_alerts_sent','portal_audit_logs','profile_activity_log','public_service_purchases','rescue_playbooks','social_card_subtasks','talent_pool_tags','unv_instagram_posts','unv_instagram_profiles','unv_mika_chat_history')
       and roles && array['anon','public']::name[]
  loop
    insert into public.zz_rls_fechamento_20261123 (tablename, policyname, cmd, roles_antes) values (p.tablename, p.policyname, p.cmd, p.roles);
    execute format('alter policy %I on public.%I to authenticated', p.policyname, p.tablename);
    n := n + 1;
  end loop;
  raise notice 'politicas alteradas: %', n;
end $f$;
