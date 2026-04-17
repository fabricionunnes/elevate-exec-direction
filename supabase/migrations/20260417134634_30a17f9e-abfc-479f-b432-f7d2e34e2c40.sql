-- Helper: list of tables to fully block for tenants (no tenant_id column yet → tenant sees nothing)
DO $$
DECLARE
  t text;
  block_tables text[] := ARRAY[
    'service_catalog',
    'onboarding_announcements','onboarding_announcement_acks',
    'nfse_records',
    'job_openings','candidates','candidate_resumes','candidate_disc_results','candidate_tags','candidate_ai_evaluations',
    'hotseat_recordings','hotseat_notes','hotseat_responses',
    'api_keys',
    'pdi_applications','pdi_assessment_questions','pdi_assessment_responses','pdi_assessments','pdi_attendance',
    'pdi_book_tracks','pdi_books','pdi_certificates','pdi_cohort_tracks','pdi_cohorts',
    'pdi_community_comments','pdi_community_posts','pdi_participants','pdi_programs',
    'pdi_task_submissions','pdi_tasks','pdi_tracks',
    'academy_badges','academy_certificates','academy_gamification_config','academy_lesson_assets',
    'academy_lessons','academy_level_definitions','academy_modules','academy_points_ledger',
    'academy_progress','academy_quiz_attempts','academy_quiz_questions','academy_quizzes',
    'academy_tracks','academy_user_access','academy_user_badges','academy_user_levels',
    'circle_ads_ad_sets','circle_ads_ads','circle_ads_ai_requests','circle_ads_ai_results',
    'circle_ads_auction_history','circle_ads_auctions','circle_ads_bids','circle_ads_campaigns',
    'circle_ads_clicks','circle_ads_config','circle_ads_credits','circle_ads_daily_metrics',
    'circle_ads_hidden','circle_ads_impressions','circle_ads_packages','circle_ads_pricing_rules',
    'circle_ads_privacy','circle_ads_quality_scores','circle_ads_reports','circle_ads_subscriptions',
    'circle_ads_transactions','circle_ads_wallets','circle_ai_content_suggestions','circle_area_reputation',
    'circle_area_reputation_events','circle_audience_members','circle_audiences','circle_badges',
    'circle_boost_config','circle_boost_limits','circle_boosts','circle_comments','circle_communities',
    'circle_community_access','circle_community_members','circle_community_requests','circle_community_summaries',
    'circle_conversation_participants','circle_conversations','circle_digest_history','circle_digest_settings',
    'circle_follows','circle_levels','circle_likes','circle_marketplace_analytics','circle_marketplace_events',
    'circle_marketplace_favorites','circle_marketplace_images','circle_marketplace_listings','circle_marketplace_reports',
    'circle_mentor_messages','circle_mentor_sessions','circle_messages','circle_moderation_logs',
    'circle_notifications','circle_pixel_events','circle_points_config','circle_points_ledger',
    'circle_posts','circle_profiles','circle_reports','circle_saved_posts','circle_saved_stories',
    'circle_stories','circle_story_comments','circle_story_reactions','circle_story_views',
    'circle_subscriptions','circle_testimonials','circle_trust_config','circle_trust_events',
    'circle_user_badges','circle_user_blocks',
    'whatsapp_campaigns','whatsapp_campaign_recipients','whatsapp_default_config',
    'whatsapp_message_log','whatsapp_saved_lists',
    'whatsapp_official_instances','whatsapp_official_instance_access',
    'slide_presentations','slide_items','slide_remote_sessions'
  ];
BEGIN
  FOREACH t IN ARRAY block_tables LOOP
    -- Ensure RLS is enabled
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    -- Drop previous block if exists
    EXECUTE format('DROP POLICY IF EXISTS "Tenant total isolation block" ON public.%I;', t);
    -- Apply restrictive block: tenants cannot see/modify anything
    EXECUTE format($f$
      CREATE POLICY "Tenant total isolation block" ON public.%I
      AS RESTRICTIVE FOR ALL TO authenticated
      USING (NOT public.current_user_is_tenant())
      WITH CHECK (NOT public.current_user_is_tenant());
    $f$, t);
  END LOOP;
END $$;