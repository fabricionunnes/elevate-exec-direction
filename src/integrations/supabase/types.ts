export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      assessment_360_evaluations: {
        Row: {
          additional_comments: string | null
          communication_score: number | null
          completed_at: string | null
          conflict_management_score: number | null
          created_at: string
          cycle_id: string
          evaluated_id: string
          evaluator_email: string | null
          evaluator_id: string | null
          evaluator_name: string
          id: string
          improvements: string | null
          is_completed: boolean | null
          leadership_score: number | null
          proactivity_score: number | null
          relationship: string
          results_delivery_score: number | null
          strengths: string | null
          teamwork_score: number | null
        }
        Insert: {
          additional_comments?: string | null
          communication_score?: number | null
          completed_at?: string | null
          conflict_management_score?: number | null
          created_at?: string
          cycle_id: string
          evaluated_id: string
          evaluator_email?: string | null
          evaluator_id?: string | null
          evaluator_name: string
          id?: string
          improvements?: string | null
          is_completed?: boolean | null
          leadership_score?: number | null
          proactivity_score?: number | null
          relationship: string
          results_delivery_score?: number | null
          strengths?: string | null
          teamwork_score?: number | null
        }
        Update: {
          additional_comments?: string | null
          communication_score?: number | null
          completed_at?: string | null
          conflict_management_score?: number | null
          created_at?: string
          cycle_id?: string
          evaluated_id?: string
          evaluator_email?: string | null
          evaluator_id?: string | null
          evaluator_name?: string
          id?: string
          improvements?: string | null
          is_completed?: boolean | null
          leadership_score?: number | null
          proactivity_score?: number | null
          relationship?: string
          results_delivery_score?: number | null
          strengths?: string | null
          teamwork_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_360_evaluations_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "assessment_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_360_evaluations_evaluated_id_fkey"
            columns: ["evaluated_id"]
            isOneToOne: false
            referencedRelation: "assessment_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_360_evaluations_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "assessment_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_cycles: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          project_id: string
          start_date: string | null
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          project_id: string
          start_date?: string | null
          status?: string
          title?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          project_id?: string
          start_date?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_cycles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_participants: {
        Row: {
          access_token: string
          created_at: string
          cycle_id: string
          department: string | null
          email: string | null
          id: string
          name: string
          role: string
        }
        Insert: {
          access_token?: string
          created_at?: string
          cycle_id: string
          department?: string | null
          email?: string | null
          id?: string
          name: string
          role: string
        }
        Update: {
          access_token?: string
          created_at?: string
          cycle_id?: string
          department?: string | null
          email?: string | null
          id?: string
          name?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_participants_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "assessment_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_advisor_leads: {
        Row: {
          created_at: string
          email: string | null
          id: string
          messages: Json
          name: string | null
          phone: string | null
          recommended_services: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          messages?: Json
          name?: string | null
          phone?: string | null
          recommended_services?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          messages?: Json
          name?: string | null
          phone?: string | null
          recommended_services?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_diagnostics: {
        Row: {
          biggest_challenge: string | null
          company_name: string
          contact_name: string
          created_at: string
          email: string | null
          has_sales_process: boolean
          id: string
          main_pain: string
          notes: string | null
          recommended_product: string | null
          revenue: string
          status: string
          team_size: string
          urgency: string
          whatsapp: string
          why_diagnostic: string | null
        }
        Insert: {
          biggest_challenge?: string | null
          company_name: string
          contact_name: string
          created_at?: string
          email?: string | null
          has_sales_process?: boolean
          id?: string
          main_pain: string
          notes?: string | null
          recommended_product?: string | null
          revenue: string
          status?: string
          team_size: string
          urgency?: string
          whatsapp: string
          why_diagnostic?: string | null
        }
        Update: {
          biggest_challenge?: string | null
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string | null
          has_sales_process?: boolean
          id?: string
          main_pain?: string
          notes?: string | null
          recommended_product?: string | null
          revenue?: string
          status?: string
          team_size?: string
          urgency?: string
          whatsapp?: string
          why_diagnostic?: string | null
        }
        Relationships: []
      }
      client_health_scores: {
        Row: {
          commercial_score: number | null
          created_at: string
          engagement_score: number | null
          goals_score: number | null
          id: string
          last_calculated_at: string | null
          project_id: string
          risk_level: string | null
          satisfaction_score: number | null
          support_score: number | null
          total_score: number
          trend_direction: string | null
          trend_score: number | null
          updated_at: string
        }
        Insert: {
          commercial_score?: number | null
          created_at?: string
          engagement_score?: number | null
          goals_score?: number | null
          id?: string
          last_calculated_at?: string | null
          project_id: string
          risk_level?: string | null
          satisfaction_score?: number | null
          support_score?: number | null
          total_score?: number
          trend_direction?: string | null
          trend_score?: number | null
          updated_at?: string
        }
        Update: {
          commercial_score?: number | null
          created_at?: string
          engagement_score?: number | null
          goals_score?: number | null
          id?: string
          last_calculated_at?: string | null
          project_id?: string
          risk_level?: string | null
          satisfaction_score?: number | null
          support_score?: number | null
          total_score?: number
          trend_direction?: string | null
          trend_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_health_scores_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      climate_survey_responses: {
        Row: {
          adequate_recognition: boolean | null
          communication_with_superiors: number | null
          company_offers_wellness: boolean | null
          company_satisfaction: number | null
          company_values_balance: boolean | null
          completed_at: string
          created_at: string
          cycle_id: string
          diversity_inclusion: number | null
          enjoys_working_score: number | null
          feels_comfortable_safe: boolean | null
          feels_supported: number | null
          feels_valued: string | null
          feels_valued_for_work: boolean | null
          good_coworker_relationship: boolean | null
          has_growth_opportunities: boolean | null
          id: string
          manages_responsibilities: boolean | null
          open_feedback: string | null
          organizational_culture: number | null
          participant_id: string
          receives_feedback: string | null
          respondent_email: string | null
          respondent_name: string
          rewards_rating: number | null
          superior_interest_development: number | null
          training_rating: number | null
          what_company_does_well: string | null
          what_company_should_improve: string | null
          would_recommend_score: number | null
        }
        Insert: {
          adequate_recognition?: boolean | null
          communication_with_superiors?: number | null
          company_offers_wellness?: boolean | null
          company_satisfaction?: number | null
          company_values_balance?: boolean | null
          completed_at?: string
          created_at?: string
          cycle_id: string
          diversity_inclusion?: number | null
          enjoys_working_score?: number | null
          feels_comfortable_safe?: boolean | null
          feels_supported?: number | null
          feels_valued?: string | null
          feels_valued_for_work?: boolean | null
          good_coworker_relationship?: boolean | null
          has_growth_opportunities?: boolean | null
          id?: string
          manages_responsibilities?: boolean | null
          open_feedback?: string | null
          organizational_culture?: number | null
          participant_id: string
          receives_feedback?: string | null
          respondent_email?: string | null
          respondent_name: string
          rewards_rating?: number | null
          superior_interest_development?: number | null
          training_rating?: number | null
          what_company_does_well?: string | null
          what_company_should_improve?: string | null
          would_recommend_score?: number | null
        }
        Update: {
          adequate_recognition?: boolean | null
          communication_with_superiors?: number | null
          company_offers_wellness?: boolean | null
          company_satisfaction?: number | null
          company_values_balance?: boolean | null
          completed_at?: string
          created_at?: string
          cycle_id?: string
          diversity_inclusion?: number | null
          enjoys_working_score?: number | null
          feels_comfortable_safe?: boolean | null
          feels_supported?: number | null
          feels_valued?: string | null
          feels_valued_for_work?: boolean | null
          good_coworker_relationship?: boolean | null
          has_growth_opportunities?: boolean | null
          id?: string
          manages_responsibilities?: boolean | null
          open_feedback?: string | null
          organizational_culture?: number | null
          participant_id?: string
          receives_feedback?: string | null
          respondent_email?: string | null
          respondent_name?: string
          rewards_rating?: number | null
          superior_interest_development?: number | null
          training_rating?: number | null
          what_company_does_well?: string | null
          what_company_should_improve?: string | null
          would_recommend_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "climate_survey_responses_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "assessment_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "climate_survey_responses_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "assessment_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      closer_diagnostics: {
        Row: {
          additional_context: string | null
          admission_statement: string | null
          avg_ticket: string | null
          budget: string | null
          client_agreed: string | null
          client_name: string
          closer_id: string | null
          commitment_level: number | null
          company: string
          connection_point: string | null
          conversion: string | null
          created_at: string
          crm_name: string | null
          decision_maker: string | null
          decision_process: string | null
          deeper_why: string | null
          emotional_impact: string | null
          expectations_aligned: string | null
          goal_12_months: string | null
          has_crm: string | null
          has_process: string | null
          how_affects_life: string | null
          how_long_problem: string | null
          id: string
          ideal_scenario: string | null
          is_coachable: string | null
          lead_source: string[] | null
          lead_volume: string | null
          love_or_status: string | null
          main_pains: string[] | null
          notes: string | null
          pain_details: string | null
          partner_name: string | null
          partner_present: string | null
          rapport_notes: string | null
          realistic_expectation: string | null
          recommended_products: Json | null
          recommended_trail: Json | null
          revenue: string | null
          role: string | null
          sales_cycle: string | null
          segment: string | null
          specific_help: string | null
          status: string
          summary: string | null
          team_size: string | null
          timeline: string | null
          what_saw_about_us: string | null
          what_tried_before: string | null
          what_would_change: string | null
          when_to_fix: string | null
          why_cant_alone: string | null
          why_didnt_work: string | null
          why_now: string | null
          why_scheduled: string | null
        }
        Insert: {
          additional_context?: string | null
          admission_statement?: string | null
          avg_ticket?: string | null
          budget?: string | null
          client_agreed?: string | null
          client_name: string
          closer_id?: string | null
          commitment_level?: number | null
          company: string
          connection_point?: string | null
          conversion?: string | null
          created_at?: string
          crm_name?: string | null
          decision_maker?: string | null
          decision_process?: string | null
          deeper_why?: string | null
          emotional_impact?: string | null
          expectations_aligned?: string | null
          goal_12_months?: string | null
          has_crm?: string | null
          has_process?: string | null
          how_affects_life?: string | null
          how_long_problem?: string | null
          id?: string
          ideal_scenario?: string | null
          is_coachable?: string | null
          lead_source?: string[] | null
          lead_volume?: string | null
          love_or_status?: string | null
          main_pains?: string[] | null
          notes?: string | null
          pain_details?: string | null
          partner_name?: string | null
          partner_present?: string | null
          rapport_notes?: string | null
          realistic_expectation?: string | null
          recommended_products?: Json | null
          recommended_trail?: Json | null
          revenue?: string | null
          role?: string | null
          sales_cycle?: string | null
          segment?: string | null
          specific_help?: string | null
          status?: string
          summary?: string | null
          team_size?: string | null
          timeline?: string | null
          what_saw_about_us?: string | null
          what_tried_before?: string | null
          what_would_change?: string | null
          when_to_fix?: string | null
          why_cant_alone?: string | null
          why_didnt_work?: string | null
          why_now?: string | null
          why_scheduled?: string | null
        }
        Update: {
          additional_context?: string | null
          admission_statement?: string | null
          avg_ticket?: string | null
          budget?: string | null
          client_agreed?: string | null
          client_name?: string
          closer_id?: string | null
          commitment_level?: number | null
          company?: string
          connection_point?: string | null
          conversion?: string | null
          created_at?: string
          crm_name?: string | null
          decision_maker?: string | null
          decision_process?: string | null
          deeper_why?: string | null
          emotional_impact?: string | null
          expectations_aligned?: string | null
          goal_12_months?: string | null
          has_crm?: string | null
          has_process?: string | null
          how_affects_life?: string | null
          how_long_problem?: string | null
          id?: string
          ideal_scenario?: string | null
          is_coachable?: string | null
          lead_source?: string[] | null
          lead_volume?: string | null
          love_or_status?: string | null
          main_pains?: string[] | null
          notes?: string | null
          pain_details?: string | null
          partner_name?: string | null
          partner_present?: string | null
          rapport_notes?: string | null
          realistic_expectation?: string | null
          recommended_products?: Json | null
          recommended_trail?: Json | null
          revenue?: string | null
          role?: string | null
          sales_cycle?: string | null
          segment?: string | null
          specific_help?: string | null
          status?: string
          summary?: string | null
          team_size?: string | null
          timeline?: string | null
          what_saw_about_us?: string | null
          what_tried_before?: string | null
          what_would_change?: string | null
          when_to_fix?: string | null
          why_cant_alone?: string | null
          why_didnt_work?: string | null
          why_now?: string | null
          why_scheduled?: string | null
        }
        Relationships: []
      }
      company_kpis: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_individual: boolean | null
          is_required: boolean | null
          kpi_type: string
          name: string
          periodicity: string
          sort_order: number | null
          target_value: number
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_individual?: boolean | null
          is_required?: boolean | null
          kpi_type: string
          name: string
          periodicity: string
          sort_order?: number | null
          target_value?: number
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_individual?: boolean | null
          is_required?: boolean | null
          kpi_type?: string
          name?: string
          periodicity?: string
          sort_order?: number | null
          target_value?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_kpis_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "onboarding_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_sales_history: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_pre_unv: boolean | null
          month_year: string
          notes: string | null
          revenue: number
          sales_count: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_pre_unv?: boolean | null
          month_year: string
          notes?: string | null
          revenue?: number
          sales_count?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_pre_unv?: boolean | null
          month_year?: string
          notes?: string | null
          revenue?: number
          sales_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_sales_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "onboarding_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_salespeople: {
        Row: {
          access_code: string
          company_id: string
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          access_code?: string
          company_id: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          access_code?: string
          company_id?: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_salespeople_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "onboarding_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_salespeople_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "company_units"
            referencedColumns: ["id"]
          },
        ]
      }
      company_units: {
        Row: {
          code: string | null
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "onboarding_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      csat_configs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          link_reusable: boolean | null
          main_question: string | null
          open_question: string | null
          project_id: string
          scale_max: number | null
          scale_min: number | null
          send_timing: string | null
          send_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          link_reusable?: boolean | null
          main_question?: string | null
          open_question?: string | null
          project_id: string
          scale_max?: number | null
          scale_min?: number | null
          send_timing?: string | null
          send_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          link_reusable?: boolean | null
          main_question?: string | null
          open_question?: string | null
          project_id?: string
          scale_max?: number | null
          scale_min?: number | null
          send_timing?: string | null
          send_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "csat_configs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      csat_responses: {
        Row: {
          created_at: string
          feedback: string | null
          id: string
          meeting_id: string
          project_id: string
          responded_at: string
          respondent_name: string | null
          score: number
          survey_id: string
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          id?: string
          meeting_id: string
          project_id: string
          responded_at?: string
          respondent_name?: string | null
          score: number
          survey_id: string
        }
        Update: {
          created_at?: string
          feedback?: string | null
          id?: string
          meeting_id?: string
          project_id?: string
          responded_at?: string
          respondent_name?: string | null
          score?: number
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "csat_responses_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "onboarding_meeting_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "csat_responses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "csat_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: true
            referencedRelation: "csat_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      csat_surveys: {
        Row: {
          access_token: string
          created_at: string
          id: string
          meeting_id: string
          project_id: string
          sent_at: string | null
          status: string | null
          task_id: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string
          created_at?: string
          id?: string
          meeting_id: string
          project_id: string
          sent_at?: string | null
          status?: string | null
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          meeting_id?: string
          project_id?: string
          sent_at?: string | null
          status?: string | null
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "csat_surveys_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "onboarding_meeting_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "csat_surveys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "csat_surveys_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      disc_responses: {
        Row: {
          completed_at: string
          conscientiousness_score: number
          created_at: string
          cycle_id: string
          dominance_score: number
          id: string
          influence_score: number
          participant_id: string
          primary_profile: string | null
          raw_answers: Json
          respondent_email: string | null
          respondent_name: string
          secondary_profile: string | null
          steadiness_score: number
        }
        Insert: {
          completed_at?: string
          conscientiousness_score?: number
          created_at?: string
          cycle_id: string
          dominance_score?: number
          id?: string
          influence_score?: number
          participant_id: string
          primary_profile?: string | null
          raw_answers?: Json
          respondent_email?: string | null
          respondent_name: string
          secondary_profile?: string | null
          steadiness_score?: number
        }
        Update: {
          completed_at?: string
          conscientiousness_score?: number
          created_at?: string
          cycle_id?: string
          dominance_score?: number
          id?: string
          influence_score?: number
          participant_id?: string
          primary_profile?: string | null
          raw_answers?: Json
          respondent_email?: string | null
          respondent_name?: string
          secondary_profile?: string | null
          steadiness_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "disc_responses_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "assessment_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disc_responses_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "assessment_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      endomarketing_campaigns: {
        Row: {
          all_salespeople: boolean
          calculation_method: string
          company_id: string
          competition_type: string
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string
          ended_manually_at: string | null
          ended_manually_by: string | null
          goal_type: string | null
          goal_value: number | null
          has_goal: boolean
          has_prizes: boolean
          id: string
          kpi_id: string | null
          name: string
          prize_model: string | null
          prize_top_n: number | null
          project_id: string
          start_date: string
          status: string
          tiebreaker: string | null
          updated_at: string
        }
        Insert: {
          all_salespeople?: boolean
          calculation_method?: string
          company_id: string
          competition_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date: string
          ended_manually_at?: string | null
          ended_manually_by?: string | null
          goal_type?: string | null
          goal_value?: number | null
          has_goal?: boolean
          has_prizes?: boolean
          id?: string
          kpi_id?: string | null
          name: string
          prize_model?: string | null
          prize_top_n?: number | null
          project_id: string
          start_date: string
          status?: string
          tiebreaker?: string | null
          updated_at?: string
        }
        Update: {
          all_salespeople?: boolean
          calculation_method?: string
          company_id?: string
          competition_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string
          ended_manually_at?: string | null
          ended_manually_by?: string | null
          goal_type?: string | null
          goal_value?: number | null
          has_goal?: boolean
          has_prizes?: boolean
          id?: string
          kpi_id?: string | null
          name?: string
          prize_model?: string | null
          prize_top_n?: number | null
          project_id?: string
          start_date?: string
          status?: string
          tiebreaker?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "endomarketing_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "onboarding_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "endomarketing_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "endomarketing_campaigns_ended_manually_by_fkey"
            columns: ["ended_manually_by"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "endomarketing_campaigns_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "endomarketing_campaigns_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      endomarketing_participants: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          salesperson_id: string
          team_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          salesperson_id: string
          team_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          salesperson_id?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "endomarketing_participants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "endomarketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "endomarketing_participants_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "company_salespeople"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "endomarketing_participants_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "endomarketing_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      endomarketing_prizes: {
        Row: {
          campaign_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          position: number
          prize_type: string
          value: number | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          position: number
          prize_type?: string
          value?: number | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          position?: number
          prize_type?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "endomarketing_prizes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "endomarketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      endomarketing_snapshots: {
        Row: {
          campaign_id: string
          created_at: string
          final_position: number
          final_value: number
          goal_percentage: number | null
          id: string
          prize_id: string | null
          salesperson_id: string | null
          team_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          final_position: number
          final_value: number
          goal_percentage?: number | null
          id?: string
          prize_id?: string | null
          salesperson_id?: string | null
          team_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          final_position?: number
          final_value?: number
          goal_percentage?: number | null
          id?: string
          prize_id?: string | null
          salesperson_id?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "endomarketing_snapshots_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "endomarketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "endomarketing_snapshots_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "endomarketing_prizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "endomarketing_snapshots_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "company_salespeople"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "endomarketing_snapshots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "endomarketing_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      endomarketing_teams: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "endomarketing_teams_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "endomarketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_badges: {
        Row: {
          condition_kpi_id: string | null
          condition_type: string
          condition_value: number | null
          config_id: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_repeatable: boolean | null
          name: string
          show_on_profile: boolean | null
        }
        Insert: {
          condition_kpi_id?: string | null
          condition_type: string
          condition_value?: number | null
          config_id: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_repeatable?: boolean | null
          name: string
          show_on_profile?: boolean | null
        }
        Update: {
          condition_kpi_id?: string | null
          condition_type?: string
          condition_value?: number | null
          config_id?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_repeatable?: boolean | null
          name?: string
          show_on_profile?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "gamification_badges_condition_kpi_id_fkey"
            columns: ["condition_kpi_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_badges_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "gamification_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_configs: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          project_id: string
          reset_points_on_season_end: boolean | null
          season_type: string | null
          team_mode_enabled: boolean | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          project_id: string
          reset_points_on_season_end?: boolean | null
          season_type?: string | null
          team_mode_enabled?: boolean | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          project_id?: string
          reset_points_on_season_end?: boolean | null
          season_type?: string | null
          team_mode_enabled?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "onboarding_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_configs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_leaderboard_snapshots: {
        Row: {
          created_at: string
          final_points: number
          final_position: number
          id: string
          participant_id: string | null
          reward_id: string | null
          season_id: string
          team_id: string | null
        }
        Insert: {
          created_at?: string
          final_points: number
          final_position: number
          id?: string
          participant_id?: string | null
          reward_id?: string | null
          season_id: string
          team_id?: string | null
        }
        Update: {
          created_at?: string
          final_points?: number
          final_position?: number
          id?: string
          participant_id?: string | null
          reward_id?: string | null
          season_id?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gamification_leaderboard_snapshots_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "gamification_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_leaderboard_snapshots_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "gamification_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_leaderboard_snapshots_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "gamification_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_leaderboard_snapshots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "gamification_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_levels: {
        Row: {
          config_id: string
          created_at: string
          icon: string | null
          id: string
          level_number: number
          min_points: number
          name: string
        }
        Insert: {
          config_id: string
          created_at?: string
          icon?: string | null
          id?: string
          level_number: number
          min_points: number
          name: string
        }
        Update: {
          config_id?: string
          created_at?: string
          icon?: string | null
          id?: string
          level_number?: number
          min_points?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_levels_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "gamification_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_mission_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          current_value: number | null
          id: string
          is_completed: boolean | null
          mission_id: string
          participant_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_value?: number | null
          id?: string
          is_completed?: boolean | null
          mission_id: string
          participant_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_value?: number | null
          id?: string
          is_completed?: boolean | null
          mission_id?: string
          participant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_mission_progress_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "gamification_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_mission_progress_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "gamification_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_missions: {
        Row: {
          condition_type: string
          condition_value: number
          config_id: string
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          metric_kpi_id: string | null
          mission_type: string | null
          name: string
          reward_badge_id: string | null
          reward_points: number | null
          season_id: string | null
          start_date: string | null
        }
        Insert: {
          condition_type: string
          condition_value: number
          config_id: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          metric_kpi_id?: string | null
          mission_type?: string | null
          name: string
          reward_badge_id?: string | null
          reward_points?: number | null
          season_id?: string | null
          start_date?: string | null
        }
        Update: {
          condition_type?: string
          condition_value?: number
          config_id?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          metric_kpi_id?: string | null
          mission_type?: string | null
          name?: string
          reward_badge_id?: string | null
          reward_points?: number | null
          season_id?: string | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gamification_missions_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "gamification_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_missions_metric_kpi_id_fkey"
            columns: ["metric_kpi_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_missions_reward_badge_id_fkey"
            columns: ["reward_badge_id"]
            isOneToOne: false
            referencedRelation: "gamification_badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_missions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "gamification_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_participants: {
        Row: {
          config_id: string
          created_at: string
          current_level: number | null
          id: string
          salesperson_id: string
          total_points: number | null
          updated_at: string
        }
        Insert: {
          config_id: string
          created_at?: string
          current_level?: number | null
          id?: string
          salesperson_id: string
          total_points?: number | null
          updated_at?: string
        }
        Update: {
          config_id?: string
          created_at?: string
          current_level?: number | null
          id?: string
          salesperson_id?: string
          total_points?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_participants_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "gamification_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_participants_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "company_salespeople"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_rewards: {
        Row: {
          condition_type: string
          condition_value: number | null
          config_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          mission_id: string | null
          name: string
          reward_type: string
          season_id: string | null
          show_on_dashboard: boolean | null
          value: number | null
        }
        Insert: {
          condition_type: string
          condition_value?: number | null
          config_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          mission_id?: string | null
          name: string
          reward_type: string
          season_id?: string | null
          show_on_dashboard?: boolean | null
          value?: number | null
        }
        Update: {
          condition_type?: string
          condition_value?: number | null
          config_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          mission_id?: string | null
          name?: string
          reward_type?: string
          season_id?: string | null
          show_on_dashboard?: boolean | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gamification_rewards_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "gamification_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_rewards_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "gamification_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_rewards_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "gamification_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_score_logs: {
        Row: {
          created_at: string
          entry_date: string
          id: string
          mission_id: string | null
          participant_id: string
          points: number
          reason: string
          rule_id: string | null
          season_id: string | null
          source_id: string | null
          source_type: string | null
        }
        Insert: {
          created_at?: string
          entry_date: string
          id?: string
          mission_id?: string | null
          participant_id: string
          points: number
          reason: string
          rule_id?: string | null
          season_id?: string | null
          source_id?: string | null
          source_type?: string | null
        }
        Update: {
          created_at?: string
          entry_date?: string
          id?: string
          mission_id?: string | null
          participant_id?: string
          points?: number
          reason?: string
          rule_id?: string | null
          season_id?: string | null
          source_id?: string | null
          source_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gamification_score_logs_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "gamification_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_score_logs_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "gamification_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_score_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "gamification_scoring_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_score_logs_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "gamification_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_scoring_rules: {
        Row: {
          config_id: string
          created_at: string
          description: string | null
          event_type: string | null
          id: string
          is_active: boolean | null
          kpi_id: string | null
          max_points_per_day: number | null
          max_points_per_week: number | null
          name: string
          points_per_unit: number | null
          points_value: number
          rule_type: string
          streak_bonus: number | null
          streak_days: number | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          config_id: string
          created_at?: string
          description?: string | null
          event_type?: string | null
          id?: string
          is_active?: boolean | null
          kpi_id?: string | null
          max_points_per_day?: number | null
          max_points_per_week?: number | null
          name: string
          points_per_unit?: number | null
          points_value?: number
          rule_type: string
          streak_bonus?: number | null
          streak_days?: number | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          config_id?: string
          created_at?: string
          description?: string | null
          event_type?: string | null
          id?: string
          is_active?: boolean | null
          kpi_id?: string | null
          max_points_per_day?: number | null
          max_points_per_week?: number | null
          name?: string
          points_per_unit?: number | null
          points_value?: number
          rule_type?: string
          streak_bonus?: number | null
          streak_days?: number | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gamification_scoring_rules_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "gamification_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_scoring_rules_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_seasons: {
        Row: {
          config_id: string
          created_at: string
          end_date: string
          id: string
          is_current: boolean | null
          name: string
          start_date: string
          status: string | null
          updated_at: string
        }
        Insert: {
          config_id: string
          created_at?: string
          end_date: string
          id?: string
          is_current?: boolean | null
          name: string
          start_date: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          config_id?: string
          created_at?: string
          end_date?: string
          id?: string
          is_current?: boolean | null
          name?: string
          start_date?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_seasons_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "gamification_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_team_members: {
        Row: {
          created_at: string
          id: string
          salesperson_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          salesperson_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          salesperson_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_team_members_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "company_salespeople"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "gamification_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_teams: {
        Row: {
          config_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          config_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          config_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "gamification_teams_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "gamification_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          id: string
          participant_id: string
          season_id: string | null
        }
        Insert: {
          badge_id: string
          earned_at?: string
          id?: string
          participant_id: string
          season_id?: string | null
        }
        Update: {
          badge_id?: string
          earned_at?: string
          id?: string
          participant_id?: string
          season_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gamification_user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "gamification_badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_user_badges_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "gamification_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gamification_user_badges_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "gamification_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      health_score_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          new_score: number | null
          previous_score: number | null
          project_id: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          new_score?: number | null
          previous_score?: number | null
          project_id: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          new_score?: number | null
          previous_score?: number | null
          project_id?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_score_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      health_score_observations: {
        Row: {
          created_at: string
          id: string
          observation: string
          observation_type: string | null
          project_id: string
          staff_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          observation: string
          observation_type?: string | null
          project_id: string
          staff_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          observation?: string
          observation_type?: string | null
          project_id?: string
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_score_observations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_score_observations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      health_score_snapshots: {
        Row: {
          commercial_score: number | null
          created_at: string
          engagement_score: number | null
          goals_score: number | null
          id: string
          project_id: string
          risk_level: string | null
          satisfaction_score: number | null
          snapshot_date: string
          support_score: number | null
          total_score: number
          trend_score: number | null
        }
        Insert: {
          commercial_score?: number | null
          created_at?: string
          engagement_score?: number | null
          goals_score?: number | null
          id?: string
          project_id: string
          risk_level?: string | null
          satisfaction_score?: number | null
          snapshot_date?: string
          support_score?: number | null
          total_score: number
          trend_score?: number | null
        }
        Update: {
          commercial_score?: number | null
          created_at?: string
          engagement_score?: number | null
          goals_score?: number | null
          id?: string
          project_id?: string
          risk_level?: string | null
          satisfaction_score?: number | null
          snapshot_date?: string
          support_score?: number | null
          total_score?: number
          trend_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "health_score_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      health_score_weights: {
        Row: {
          commercial_weight: number | null
          created_at: string
          engagement_weight: number | null
          goals_weight: number | null
          id: string
          project_id: string
          satisfaction_weight: number | null
          support_weight: number | null
          trend_weight: number | null
          updated_at: string
        }
        Insert: {
          commercial_weight?: number | null
          created_at?: string
          engagement_weight?: number | null
          goals_weight?: number | null
          id?: string
          project_id: string
          satisfaction_weight?: number | null
          support_weight?: number | null
          trend_weight?: number | null
          updated_at?: string
        }
        Update: {
          commercial_weight?: number | null
          created_at?: string
          engagement_weight?: number | null
          goals_weight?: number | null
          id?: string
          project_id?: string
          satisfaction_weight?: number | null
          support_weight?: number | null
          trend_weight?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_score_weights_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_entries: {
        Row: {
          company_id: string
          created_at: string | null
          entry_date: string
          id: string
          kpi_id: string
          observations: string | null
          salesperson_id: string
          unit_id: string | null
          updated_at: string | null
          value: number
        }
        Insert: {
          company_id: string
          created_at?: string | null
          entry_date?: string
          id?: string
          kpi_id: string
          observations?: string | null
          salesperson_id: string
          unit_id?: string | null
          updated_at?: string | null
          value?: number
        }
        Update: {
          company_id?: string
          created_at?: string | null
          entry_date?: string
          id?: string
          kpi_id?: string
          observations?: string | null
          salesperson_id?: string
          unit_id?: string | null
          updated_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "onboarding_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_entries_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_entries_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "company_salespeople"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_entries_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "company_units"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_monthly_targets: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          kpi_id: string
          level_name: string
          level_order: number
          month_year: string
          salesperson_id: string | null
          target_value: number
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          kpi_id: string
          level_name?: string
          level_order?: number
          month_year: string
          salesperson_id?: string | null
          target_value?: number
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          kpi_id?: string
          level_name?: string
          level_order?: number
          month_year?: string
          salesperson_id?: string | null
          target_value?: number
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_monthly_targets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "onboarding_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_monthly_targets_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "company_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_monthly_targets_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "company_salespeople"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_monthly_targets_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "company_units"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_target_levels: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_target_levels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "onboarding_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      mastermind_applications: {
        Row: {
          agrees_confidentiality: boolean
          available_for_meetings: boolean
          aware_of_investment: boolean
          commits_confidentiality: boolean
          company: string
          company_age: string
          contribution_to_group: string
          created_at: string
          email: string
          employees_count: number
          energy_drain: string
          feels_alone: string
          full_name: string
          id: string
          is_decision_maker: boolean
          main_challenge: string
          monthly_revenue: string
          notes: string | null
          phone: string
          reaction_to_confrontation: string
          role: string
          role_other: string | null
          salespeople_count: number
          status: string
          success_definition: string
          understands_mansion_costs: boolean
          understands_may_be_refused: boolean
          understands_not_operational: boolean
          upcoming_decision: string
          validation_or_confrontation: string
          why_right_moment: string
          willing_to_share_numbers: boolean
        }
        Insert: {
          agrees_confidentiality: boolean
          available_for_meetings: boolean
          aware_of_investment: boolean
          commits_confidentiality?: boolean
          company: string
          company_age: string
          contribution_to_group: string
          created_at?: string
          email: string
          employees_count: number
          energy_drain: string
          feels_alone: string
          full_name: string
          id?: string
          is_decision_maker?: boolean
          main_challenge: string
          monthly_revenue: string
          notes?: string | null
          phone: string
          reaction_to_confrontation: string
          role: string
          role_other?: string | null
          salespeople_count: number
          status?: string
          success_definition: string
          understands_mansion_costs: boolean
          understands_may_be_refused?: boolean
          understands_not_operational?: boolean
          upcoming_decision: string
          validation_or_confrontation: string
          why_right_moment: string
          willing_to_share_numbers: boolean
        }
        Update: {
          agrees_confidentiality?: boolean
          available_for_meetings?: boolean
          aware_of_investment?: boolean
          commits_confidentiality?: boolean
          company?: string
          company_age?: string
          contribution_to_group?: string
          created_at?: string
          email?: string
          employees_count?: number
          energy_drain?: string
          feels_alone?: string
          full_name?: string
          id?: string
          is_decision_maker?: boolean
          main_challenge?: string
          monthly_revenue?: string
          notes?: string | null
          phone?: string
          reaction_to_confrontation?: string
          role?: string
          role_other?: string | null
          salespeople_count?: number
          status?: string
          success_definition?: string
          understands_mansion_costs?: boolean
          understands_may_be_refused?: boolean
          understands_not_operational?: boolean
          upcoming_decision?: string
          validation_or_confrontation?: string
          why_right_moment?: string
          willing_to_share_numbers?: boolean
        }
        Relationships: []
      }
      onboarding_ai_chat: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          project_id: string
          role: string
          staff_id: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          project_id: string
          role: string
          staff_id?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          project_id?: string
          role?: string
          staff_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_ai_chat_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_ai_chat_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_ai_chat_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "onboarding_users"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_announcement_acks: {
        Row: {
          acknowledged_at: string
          announcement_id: string
          id: string
          staff_id: string
        }
        Insert: {
          acknowledged_at?: string
          announcement_id: string
          id?: string
          staff_id: string
        }
        Update: {
          acknowledged_at?: string
          announcement_id?: string
          id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_announcement_acks_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "onboarding_announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_announcement_acks_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_announcements: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          message: string
          target_role: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          message: string
          target_role: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          message?: string
          target_role?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_cac_forms: {
        Row: {
          company_name: string
          created_at: string
          facebook_ads_investment: number | null
          facebook_sales_quantity: number | null
          facebook_sales_value: number | null
          form_title: string | null
          google_ads_investment: number | null
          google_sales_quantity: number | null
          google_sales_value: number | null
          id: string
          linkedin_ads_investment: number | null
          linkedin_sales_quantity: number | null
          linkedin_sales_value: number | null
          project_id: string
          sales_quantity_3_months: number | null
          sales_value_3_months: number | null
          submitted_at: string
        }
        Insert: {
          company_name: string
          created_at?: string
          facebook_ads_investment?: number | null
          facebook_sales_quantity?: number | null
          facebook_sales_value?: number | null
          form_title?: string | null
          google_ads_investment?: number | null
          google_sales_quantity?: number | null
          google_sales_value?: number | null
          id?: string
          linkedin_ads_investment?: number | null
          linkedin_sales_quantity?: number | null
          linkedin_sales_value?: number | null
          project_id: string
          sales_quantity_3_months?: number | null
          sales_value_3_months?: number | null
          submitted_at?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          facebook_ads_investment?: number | null
          facebook_sales_quantity?: number | null
          facebook_sales_value?: number | null
          form_title?: string | null
          google_ads_investment?: number | null
          google_sales_quantity?: number | null
          google_sales_value?: number | null
          id?: string
          linkedin_ads_investment?: number | null
          linkedin_sales_quantity?: number | null
          linkedin_sales_value?: number | null
          project_id?: string
          sales_quantity_3_months?: number | null
          sales_value_3_months?: number | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_cac_forms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_companies: {
        Row: {
          acquisition_channels: string | null
          address: string | null
          average_ticket: string | null
          billing_day: number | null
          cnpj: string | null
          commercial_structure: string | null
          company_description: string | null
          competitors: string | null
          consultant_id: string | null
          contract_end_date: string | null
          contract_start_date: string | null
          contract_value: number | null
          conversion_rate: string | null
          created_at: string
          crm_usage: string | null
          cs_id: string | null
          email: string | null
          expected_timeline: Json | null
          goals_long_term: string | null
          goals_short_term: string | null
          growth_expectation_12m: string | null
          growth_expectation_3m: string | null
          growth_expectation_6m: string | null
          growth_target: string | null
          has_sales_goals: string | null
          has_structured_process: string | null
          id: string
          instagram: string | null
          key_results: string | null
          kickoff_date: string | null
          main_challenges: string | null
          name: string
          notes: string | null
          objectives_with_unv: string | null
          payment_method: string | null
          phone: string | null
          quarterly_goals: Json | null
          renewal_notes: string | null
          renewal_plan_type: string | null
          renewal_status: string | null
          sales_team_size: string | null
          segment: string | null
          stakeholders: Json | null
          status: string
          status_changed_at: string | null
          swot_opportunities: string | null
          swot_strengths: string | null
          swot_threats: string | null
          swot_weaknesses: string | null
          target_audience: string | null
          tools_used: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          acquisition_channels?: string | null
          address?: string | null
          average_ticket?: string | null
          billing_day?: number | null
          cnpj?: string | null
          commercial_structure?: string | null
          company_description?: string | null
          competitors?: string | null
          consultant_id?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_value?: number | null
          conversion_rate?: string | null
          created_at?: string
          crm_usage?: string | null
          cs_id?: string | null
          email?: string | null
          expected_timeline?: Json | null
          goals_long_term?: string | null
          goals_short_term?: string | null
          growth_expectation_12m?: string | null
          growth_expectation_3m?: string | null
          growth_expectation_6m?: string | null
          growth_target?: string | null
          has_sales_goals?: string | null
          has_structured_process?: string | null
          id?: string
          instagram?: string | null
          key_results?: string | null
          kickoff_date?: string | null
          main_challenges?: string | null
          name: string
          notes?: string | null
          objectives_with_unv?: string | null
          payment_method?: string | null
          phone?: string | null
          quarterly_goals?: Json | null
          renewal_notes?: string | null
          renewal_plan_type?: string | null
          renewal_status?: string | null
          sales_team_size?: string | null
          segment?: string | null
          stakeholders?: Json | null
          status?: string
          status_changed_at?: string | null
          swot_opportunities?: string | null
          swot_strengths?: string | null
          swot_threats?: string | null
          swot_weaknesses?: string | null
          target_audience?: string | null
          tools_used?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          acquisition_channels?: string | null
          address?: string | null
          average_ticket?: string | null
          billing_day?: number | null
          cnpj?: string | null
          commercial_structure?: string | null
          company_description?: string | null
          competitors?: string | null
          consultant_id?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_value?: number | null
          conversion_rate?: string | null
          created_at?: string
          crm_usage?: string | null
          cs_id?: string | null
          email?: string | null
          expected_timeline?: Json | null
          goals_long_term?: string | null
          goals_short_term?: string | null
          growth_expectation_12m?: string | null
          growth_expectation_3m?: string | null
          growth_expectation_6m?: string | null
          growth_target?: string | null
          has_sales_goals?: string | null
          has_structured_process?: string | null
          id?: string
          instagram?: string | null
          key_results?: string | null
          kickoff_date?: string | null
          main_challenges?: string | null
          name?: string
          notes?: string | null
          objectives_with_unv?: string | null
          payment_method?: string | null
          phone?: string | null
          quarterly_goals?: Json | null
          renewal_notes?: string | null
          renewal_plan_type?: string | null
          renewal_status?: string | null
          sales_team_size?: string | null
          segment?: string | null
          stakeholders?: Json | null
          status?: string
          status_changed_at?: string | null
          swot_opportunities?: string | null
          swot_strengths?: string | null
          swot_threats?: string | null
          swot_weaknesses?: string | null
          target_audience?: string | null
          tools_used?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_companies_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_companies_cs_id_fkey"
            columns: ["cs_id"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_contract_renewals: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          new_end_date: string
          new_start_date: string | null
          new_term_months: number | null
          new_value: number
          notes: string | null
          previous_end_date: string | null
          previous_start_date: string | null
          previous_term_months: number | null
          previous_value: number | null
          renewal_date: string | null
          status: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          new_end_date: string
          new_start_date?: string | null
          new_term_months?: number | null
          new_value: number
          notes?: string | null
          previous_end_date?: string | null
          previous_start_date?: string | null
          previous_term_months?: number | null
          previous_value?: number | null
          renewal_date?: string | null
          status?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          new_end_date?: string
          new_start_date?: string | null
          new_term_months?: number | null
          new_value?: number
          notes?: string | null
          previous_end_date?: string | null
          previous_start_date?: string | null
          previous_term_months?: number | null
          previous_value?: number | null
          renewal_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_contract_renewals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "onboarding_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_contract_renewals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_documents: {
        Row: {
          category: string | null
          company_id: string
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          project_id: string | null
          task_id: string | null
          ticket_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          project_id?: string | null
          task_id?: string | null
          ticket_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          project_id?: string | null
          task_id?: string | null
          ticket_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "onboarding_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_documents_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_documents_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "onboarding_users"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_meeting_notes: {
        Row: {
          attendees: string | null
          created_at: string
          google_event_id: string | null
          id: string
          is_finalized: boolean
          meeting_date: string
          meeting_link: string | null
          meeting_title: string
          notes: string | null
          project_id: string
          recording_link: string | null
          staff_id: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          attendees?: string | null
          created_at?: string
          google_event_id?: string | null
          id?: string
          is_finalized?: boolean
          meeting_date: string
          meeting_link?: string | null
          meeting_title: string
          notes?: string | null
          project_id: string
          recording_link?: string | null
          staff_id?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          attendees?: string | null
          created_at?: string
          google_event_id?: string | null
          id?: string
          is_finalized?: boolean
          meeting_date?: string
          meeting_link?: string | null
          meeting_title?: string
          notes?: string | null
          project_id?: string
          recording_link?: string | null
          staff_id?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_meeting_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_meeting_notes_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_monthly_goals: {
        Row: {
          created_at: string
          id: string
          month: number
          notes: string | null
          project_id: string
          result_set_at: string | null
          result_set_by: string | null
          sales_result: number | null
          sales_target: number | null
          target_set_at: string | null
          target_set_by: string | null
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          notes?: string | null
          project_id: string
          result_set_at?: string | null
          result_set_by?: string | null
          sales_result?: number | null
          sales_target?: number | null
          target_set_at?: string | null
          target_set_by?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          notes?: string | null
          project_id?: string
          result_set_at?: string | null
          result_set_by?: string | null
          sales_result?: number | null
          sales_target?: number | null
          target_set_at?: string | null
          target_set_by?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_monthly_goals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_monthly_goals_result_set_by_fkey"
            columns: ["result_set_by"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_monthly_goals_target_set_by_fkey"
            columns: ["target_set_by"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          project_id: string | null
          reference_id: string | null
          reference_type: string | null
          staff_id: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          project_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          staff_id?: string | null
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          project_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          staff_id?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_notifications_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "onboarding_users"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_nps_celebrations: {
        Row: {
          created_at: string
          id: string
          nps_response_id: string
          seen_at: string | null
          staff_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nps_response_id: string
          seen_at?: string | null
          staff_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nps_response_id?: string
          seen_at?: string | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_nps_celebrations_nps_response_id_fkey"
            columns: ["nps_response_id"]
            isOneToOne: false
            referencedRelation: "onboarding_nps_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_nps_celebrations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_nps_responses: {
        Row: {
          created_at: string
          feedback: string | null
          id: string
          project_id: string
          respondent_email: string | null
          respondent_name: string | null
          score: number
          what_can_improve: string | null
          would_recommend_why: string | null
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          id?: string
          project_id: string
          respondent_email?: string | null
          respondent_name?: string | null
          score: number
          what_can_improve?: string | null
          would_recommend_why?: string | null
        }
        Update: {
          created_at?: string
          feedback?: string | null
          id?: string
          project_id?: string
          respondent_email?: string | null
          respondent_name?: string | null
          score?: number
          what_can_improve?: string | null
          would_recommend_why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_nps_responses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_projects: {
        Row: {
          cancellation_signal_date: string | null
          cancellation_signal_notes: string | null
          cancellation_signal_reason: string | null
          churn_date: string | null
          churn_notes: string | null
          churn_reason: string | null
          churn_risk: string | null
          client_dependency: string | null
          client_feedback: string | null
          communication_channel: string | null
          company_id: string | null
          consultant_id: string | null
          created_at: string
          created_by: string | null
          crm_link: string | null
          crm_login: string | null
          crm_password: string | null
          cs_id: string | null
          current_blockers: string | null
          current_nps: number | null
          documents_link: string | null
          id: string
          last_executive_checkpoint: string | null
          notice_end_date: string | null
          onboarding_company_id: string | null
          product_id: string
          product_name: string
          product_variables: Json | null
          project_complexity: string | null
          reactivated_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cancellation_signal_date?: string | null
          cancellation_signal_notes?: string | null
          cancellation_signal_reason?: string | null
          churn_date?: string | null
          churn_notes?: string | null
          churn_reason?: string | null
          churn_risk?: string | null
          client_dependency?: string | null
          client_feedback?: string | null
          communication_channel?: string | null
          company_id?: string | null
          consultant_id?: string | null
          created_at?: string
          created_by?: string | null
          crm_link?: string | null
          crm_login?: string | null
          crm_password?: string | null
          cs_id?: string | null
          current_blockers?: string | null
          current_nps?: number | null
          documents_link?: string | null
          id?: string
          last_executive_checkpoint?: string | null
          notice_end_date?: string | null
          onboarding_company_id?: string | null
          product_id: string
          product_name: string
          product_variables?: Json | null
          project_complexity?: string | null
          reactivated_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cancellation_signal_date?: string | null
          cancellation_signal_notes?: string | null
          cancellation_signal_reason?: string | null
          churn_date?: string | null
          churn_notes?: string | null
          churn_reason?: string | null
          churn_risk?: string | null
          client_dependency?: string | null
          client_feedback?: string | null
          communication_channel?: string | null
          company_id?: string | null
          consultant_id?: string | null
          created_at?: string
          created_by?: string | null
          crm_link?: string | null
          crm_login?: string | null
          crm_password?: string | null
          cs_id?: string | null
          current_blockers?: string | null
          current_nps?: number | null
          documents_link?: string | null
          id?: string
          last_executive_checkpoint?: string | null
          notice_end_date?: string | null
          onboarding_company_id?: string | null
          product_id?: string
          product_name?: string
          product_variables?: Json | null
          project_complexity?: string | null
          reactivated_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "portal_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_projects_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_projects_cs_id_fkey"
            columns: ["cs_id"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_projects_onboarding_company_id_fkey"
            columns: ["onboarding_company_id"]
            isOneToOne: false
            referencedRelation: "onboarding_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_services: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_staff: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          role: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          role: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      onboarding_subtasks: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          is_completed: boolean
          sort_order: number
          task_id: string
          title: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          sort_order?: number
          task_id: string
          title: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          sort_order?: number
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_subtasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "onboarding_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_task_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "onboarding_users"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_task_history: {
        Row: {
          action: string
          created_at: string
          field_changed: string | null
          id: string
          new_value: string | null
          old_value: string | null
          staff_id: string | null
          task_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          staff_id?: string | null
          task_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          field_changed?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          staff_id?: string | null
          task_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_task_history_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_task_templates: {
        Row: {
          checklist: Json | null
          created_at: string
          default_days_offset: number | null
          description: string | null
          duration_days: number | null
          id: string
          is_internal: boolean
          phase: string | null
          phase_order: number | null
          priority: string | null
          product_id: string
          recurrence: string | null
          responsible_role: string | null
          sort_order: number
          title: string
        }
        Insert: {
          checklist?: Json | null
          created_at?: string
          default_days_offset?: number | null
          description?: string | null
          duration_days?: number | null
          id?: string
          is_internal?: boolean
          phase?: string | null
          phase_order?: number | null
          priority?: string | null
          product_id: string
          recurrence?: string | null
          responsible_role?: string | null
          sort_order?: number
          title: string
        }
        Update: {
          checklist?: Json | null
          created_at?: string
          default_days_offset?: number | null
          description?: string | null
          duration_days?: number | null
          id?: string
          is_internal?: boolean
          phase?: string | null
          phase_order?: number | null
          priority?: string | null
          product_id?: string
          recurrence?: string | null
          responsible_role?: string | null
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      onboarding_tasks: {
        Row: {
          actual_hours: number | null
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          is_internal: boolean
          meeting_link: string | null
          observations: string | null
          priority: string | null
          project_id: string
          recurrence: string | null
          responsible_staff_id: string | null
          sort_order: number
          start_date: string | null
          status: Database["public"]["Enums"]["onboarding_task_status"]
          tags: string[] | null
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          actual_hours?: number | null
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          is_internal?: boolean
          meeting_link?: string | null
          observations?: string | null
          priority?: string | null
          project_id: string
          recurrence?: string | null
          responsible_staff_id?: string | null
          sort_order?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["onboarding_task_status"]
          tags?: string[] | null
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          actual_hours?: number | null
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          is_internal?: boolean
          meeting_link?: string | null
          observations?: string | null
          priority?: string | null
          project_id?: string
          recurrence?: string | null
          responsible_staff_id?: string | null
          sort_order?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["onboarding_task_status"]
          tags?: string[] | null
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "onboarding_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_responsible_staff_id_fkey"
            columns: ["responsible_staff_id"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "onboarding_task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_ticket_replies: {
        Row: {
          created_at: string
          id: string
          message: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_ticket_replies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "onboarding_users"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          id: string
          message: string
          project_id: string
          status: Database["public"]["Enums"]["onboarding_ticket_status"]
          subject: string
          task_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          id?: string
          message: string
          project_id: string
          status?: Database["public"]["Enums"]["onboarding_ticket_status"]
          subject: string
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          id?: string
          message?: string
          project_id?: string
          status?: Database["public"]["Enums"]["onboarding_ticket_status"]
          subject?: string
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "onboarding_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "onboarding_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tickets_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_users: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          password_changed: boolean
          project_id: string
          role: Database["public"]["Enums"]["onboarding_role"]
          temp_password: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          password_changed?: boolean
          project_id: string
          role?: Database["public"]["Enums"]["onboarding_role"]
          temp_password?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          password_changed?: boolean
          project_id?: string
          role?: Database["public"]["Enums"]["onboarding_role"]
          temp_password?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_users_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_audit_logs: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          company_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "portal_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_chat_logs: {
        Row: {
          company_id: string
          created_at: string
          id: string
          messages: Json
          mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          messages?: Json
          mode?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          messages?: Json
          mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_chat_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "portal_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_chat_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_checkins: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string | null
          current_value: number | null
          id: string
          impediments: string | null
          key_result_id: string
          next_action: string | null
          previous_value: number | null
          status: Database["public"]["Enums"]["progress_status"]
          updated_at: string
          week_ref: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          id?: string
          impediments?: string | null
          key_result_id: string
          next_action?: string | null
          previous_value?: number | null
          status?: Database["public"]["Enums"]["progress_status"]
          updated_at?: string
          week_ref: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          id?: string
          impediments?: string | null
          key_result_id?: string
          next_action?: string | null
          previous_value?: number | null
          status?: Database["public"]["Enums"]["progress_status"]
          updated_at?: string
          week_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_checkins_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_checkins_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "portal_key_results"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_companies: {
        Row: {
          created_at: string
          id: string
          invite_code: string | null
          name: string
          segment: string | null
          size: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string | null
          name: string
          segment?: string | null
          size?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string | null
          name?: string
          segment?: string | null
          size?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      portal_initiatives: {
        Row: {
          created_at: string
          deadline: string | null
          description: string | null
          effort: string | null
          id: string
          key_result_id: string
          owner_user_id: string | null
          status: Database["public"]["Enums"]["progress_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          description?: string | null
          effort?: string | null
          id?: string
          key_result_id: string
          owner_user_id?: string | null
          status?: Database["public"]["Enums"]["progress_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          description?: string | null
          effort?: string | null
          id?: string
          key_result_id?: string
          owner_user_id?: string | null
          status?: Database["public"]["Enums"]["progress_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_initiatives_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "portal_key_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_initiatives_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_invites: {
        Row: {
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["portal_role"]
          token: string | null
          used_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["portal_role"]
          token?: string | null
          used_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["portal_role"]
          token?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "portal_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_key_results: {
        Row: {
          baseline: number | null
          created_at: string
          current_value: number | null
          id: string
          objective_id: string
          quarter: number | null
          status: Database["public"]["Enums"]["progress_status"]
          target: number
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          baseline?: number | null
          created_at?: string
          current_value?: number | null
          id?: string
          objective_id: string
          quarter?: number | null
          status?: Database["public"]["Enums"]["progress_status"]
          target?: number
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          baseline?: number | null
          created_at?: string
          current_value?: number | null
          id?: string
          objective_id?: string
          quarter?: number | null
          status?: Database["public"]["Enums"]["progress_status"]
          target?: number
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_key_results_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "portal_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_north_stars: {
        Row: {
          annual_target: number | null
          created_at: string
          definition: string | null
          id: string
          name: string
          plan_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          annual_target?: number | null
          created_at?: string
          definition?: string | null
          id?: string
          name: string
          plan_id: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          annual_target?: number | null
          created_at?: string
          definition?: string | null
          id?: string
          name?: string
          plan_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_north_stars_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "portal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_objectives: {
        Row: {
          created_at: string
          description: string | null
          id: string
          owner_user_id: string | null
          plan_id: string
          priority: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          owner_user_id?: string | null
          plan_id: string
          priority?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          owner_user_id?: string | null
          plan_id?: string
          priority?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_objectives_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_objectives_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "portal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_plans: {
        Row: {
          company_id: string
          context_data: Json | null
          created_at: string
          current_step: number
          id: string
          published_at: string | null
          status: Database["public"]["Enums"]["plan_status"]
          theme: string | null
          updated_at: string
          version: number
          vision: string | null
          year: number
        }
        Insert: {
          company_id: string
          context_data?: Json | null
          created_at?: string
          current_step?: number
          id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["plan_status"]
          theme?: string | null
          updated_at?: string
          version?: number
          vision?: string | null
          year?: number
        }
        Update: {
          company_id?: string
          context_data?: Json | null
          created_at?: string
          current_step?: number
          id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["plan_status"]
          theme?: string | null
          updated_at?: string
          version?: number
          vision?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "portal_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "portal_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_product_catalog: {
        Row: {
          category: string | null
          created_at: string
          cta_url: string | null
          id: string
          is_active: boolean
          name: string
          short_description: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          cta_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          short_description?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          cta_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          short_description?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      portal_recommendations: {
        Row: {
          company_id: string
          created_at: string
          dismissed_at: string | null
          id: string
          key_result_id: string | null
          plan_id: string | null
          product_id: string | null
          reason: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          key_result_id?: string | null
          plan_id?: string | null
          product_id?: string | null
          reason?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          key_result_id?: string | null
          plan_id?: string | null
          product_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_recommendations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "portal_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_recommendations_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "portal_key_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_recommendations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "portal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_recommendations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "portal_product_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_rocks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          owner_user_id: string | null
          plan_id: string
          quarter: number
          status: Database["public"]["Enums"]["progress_status"]
          target: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          owner_user_id?: string | null
          plan_id: string
          quarter: number
          status?: Database["public"]["Enums"]["progress_status"]
          target?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          owner_user_id?: string | null
          plan_id?: string
          quarter?: number
          status?: Database["public"]["Enums"]["progress_status"]
          target?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_rocks_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "portal_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_rocks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "portal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_users: {
        Row: {
          company_id: string | null
          created_at: string
          email: string
          id: string
          lgpd_consent_at: string | null
          name: string
          role: Database["public"]["Enums"]["portal_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email: string
          id?: string
          lgpd_consent_at?: string | null
          name: string
          role?: Database["public"]["Enums"]["portal_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string
          id?: string
          lgpd_consent_at?: string | null
          name?: string
          role?: Database["public"]["Enums"]["portal_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "portal_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      support_room_sessions: {
        Row: {
          attended_at: string | null
          attended_by: string | null
          client_name: string
          company_name: string | null
          created_at: string
          ended_at: string | null
          id: string
          meet_link: string | null
          notes: string | null
          project_id: string
          started_at: string
          status: string
          timeout_at: string | null
          user_id: string
        }
        Insert: {
          attended_at?: string | null
          attended_by?: string | null
          client_name: string
          company_name?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          meet_link?: string | null
          notes?: string | null
          project_id: string
          started_at?: string
          status?: string
          timeout_at?: string | null
          user_id: string
        }
        Update: {
          attended_at?: string | null
          attended_by?: string | null
          client_name?: string
          company_name?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          meet_link?: string | null
          notes?: string | null
          project_id?: string
          started_at?: string
          status?: string
          timeout_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_room_sessions_attended_by_fkey"
            columns: ["attended_by"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_room_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_room_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "onboarding_users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_google_tokens: {
        Row: {
          access_token: string
          created_at: string
          id: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      virtual_office_chat_notifications: {
        Row: {
          created_at: string | null
          id: string
          is_dm: boolean | null
          is_read: boolean | null
          message_id: string
          recipient_staff_id: string
          room_id: string | null
          sender_staff_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_dm?: boolean | null
          is_read?: boolean | null
          message_id: string
          recipient_staff_id: string
          room_id?: string | null
          sender_staff_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_dm?: boolean | null
          is_read?: boolean | null
          message_id?: string
          recipient_staff_id?: string
          room_id?: string | null
          sender_staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_office_chat_notifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "virtual_office_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_office_chat_notifications_recipient_staff_id_fkey"
            columns: ["recipient_staff_id"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_office_chat_notifications_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "virtual_office_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_office_chat_notifications_sender_staff_id_fkey"
            columns: ["sender_staff_id"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_office_message_reads: {
        Row: {
          id: string
          message_id: string
          read_at: string
          staff_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string
          staff_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_office_message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "virtual_office_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_office_message_reads_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_office_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_deleted: boolean | null
          message_type: string
          recipient_staff_id: string | null
          reply_to_id: string | null
          room_id: string
          staff_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_deleted?: boolean | null
          message_type?: string
          recipient_staff_id?: string | null
          reply_to_id?: string | null
          room_id: string
          staff_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_deleted?: boolean | null
          message_type?: string
          recipient_staff_id?: string | null
          reply_to_id?: string | null
          room_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_office_messages_recipient_staff_id_fkey"
            columns: ["recipient_staff_id"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_office_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "virtual_office_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_office_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "virtual_office_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_office_messages_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_office_presence: {
        Row: {
          created_at: string
          current_activity: string | null
          id: string
          last_seen_at: string
          room_id: string | null
          staff_id: string
          status: string
        }
        Insert: {
          created_at?: string
          current_activity?: string | null
          id?: string
          last_seen_at?: string
          room_id?: string | null
          staff_id: string
          status?: string
        }
        Update: {
          created_at?: string
          current_activity?: string | null
          id?: string
          last_seen_at?: string
          room_id?: string | null
          staff_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_office_presence_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "virtual_office_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_office_presence_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_office_room_access: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          room_id: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          room_id: string
          staff_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          room_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_office_room_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_office_room_access_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "virtual_office_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_office_room_access_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_office_rooms: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_restricted: boolean | null
          max_participants: number | null
          meet_link: string | null
          name: string
          room_type: string
          team_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_restricted?: boolean | null
          max_participants?: number | null
          meet_link?: string | null
          name: string
          room_type?: string
          team_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_restricted?: boolean | null
          max_participants?: number | null
          meet_link?: string | null
          name?: string
          room_type?: string
          team_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_office_rooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_office_unread: {
        Row: {
          from_staff_id: string | null
          id: string
          last_read_at: string | null
          room_id: string | null
          staff_id: string
          unread_count: number
          updated_at: string | null
        }
        Insert: {
          from_staff_id?: string | null
          id?: string
          last_read_at?: string | null
          room_id?: string | null
          staff_id: string
          unread_count?: number
          updated_at?: string | null
        }
        Update: {
          from_staff_id?: string | null
          id?: string
          last_read_at?: string | null
          room_id?: string | null
          staff_id?: string
          unread_count?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "virtual_office_unread_from_staff_id_fkey"
            columns: ["from_staff_id"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_office_unread_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "virtual_office_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "virtual_office_unread_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "onboarding_staff"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_notice_period_ending: { Args: never; Returns: undefined }
      get_next_business_day: {
        Args: { days_to_add: number; start_date: string }
        Returns: string
      }
      get_portal_company_id: {
        Args: { check_user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_onboarding_admin: { Args: never; Returns: boolean }
      is_onboarding_assigned_staff: {
        Args: { check_project_id: string }
        Returns: boolean
      }
      is_onboarding_project_member: {
        Args: { check_project_id: string }
        Returns: boolean
      }
      is_onboarding_staff: {
        Args: { check_project_id: string }
        Returns: boolean
      }
      is_portal_admin_unv: { Args: { check_user_id: string }; Returns: boolean }
      is_portal_company_admin: {
        Args: { check_company_id: string; check_user_id: string }
        Returns: boolean
      }
      is_portal_company_member: {
        Args: { check_company_id: string; check_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      onboarding_role: "cs" | "consultant" | "client" | "admin"
      onboarding_task_status: "pending" | "in_progress" | "completed"
      onboarding_ticket_status: "open" | "in_progress" | "resolved" | "closed"
      plan_status: "draft" | "published" | "archived"
      portal_role: "admin_unv" | "admin_company" | "member"
      progress_status: "on_track" | "attention" | "off_track" | "completed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      onboarding_role: ["cs", "consultant", "client", "admin"],
      onboarding_task_status: ["pending", "in_progress", "completed"],
      onboarding_ticket_status: ["open", "in_progress", "resolved", "closed"],
      plan_status: ["draft", "published", "archived"],
      portal_role: ["admin_unv", "admin_company", "member"],
      progress_status: ["on_track", "attention", "off_track", "completed"],
    },
  },
} as const
