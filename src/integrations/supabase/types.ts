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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      plan_status: ["draft", "published", "archived"],
      portal_role: ["admin_unv", "admin_company", "member"],
      progress_status: ["on_track", "attention", "off_track", "completed"],
    },
  },
} as const
