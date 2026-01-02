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
      onboarding_companies: {
        Row: {
          address: string | null
          billing_day: number | null
          cnpj: string | null
          company_description: string | null
          competitors: string | null
          consultant_id: string | null
          contract_end_date: string | null
          contract_start_date: string | null
          contract_value: number | null
          created_at: string
          cs_id: string | null
          email: string | null
          expected_timeline: Json | null
          goals_long_term: string | null
          goals_short_term: string | null
          id: string
          kickoff_date: string | null
          main_challenges: string | null
          name: string
          notes: string | null
          phone: string | null
          segment: string | null
          stakeholders: Json | null
          status: string
          target_audience: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          billing_day?: number | null
          cnpj?: string | null
          company_description?: string | null
          competitors?: string | null
          consultant_id?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_value?: number | null
          created_at?: string
          cs_id?: string | null
          email?: string | null
          expected_timeline?: Json | null
          goals_long_term?: string | null
          goals_short_term?: string | null
          id?: string
          kickoff_date?: string | null
          main_challenges?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          segment?: string | null
          stakeholders?: Json | null
          status?: string
          target_audience?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          billing_day?: number | null
          cnpj?: string | null
          company_description?: string | null
          competitors?: string | null
          consultant_id?: string | null
          contract_end_date?: string | null
          contract_start_date?: string | null
          contract_value?: number | null
          created_at?: string
          cs_id?: string | null
          email?: string | null
          expected_timeline?: Json | null
          goals_long_term?: string | null
          goals_short_term?: string | null
          id?: string
          kickoff_date?: string | null
          main_challenges?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          segment?: string | null
          stakeholders?: Json | null
          status?: string
          target_audience?: string | null
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
      onboarding_projects: {
        Row: {
          churn_risk: string | null
          client_dependency: string | null
          client_feedback: string | null
          communication_channel: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          current_blockers: string | null
          current_nps: number | null
          id: string
          last_executive_checkpoint: string | null
          onboarding_company_id: string | null
          product_id: string
          product_name: string
          product_variables: Json | null
          project_complexity: string | null
          status: string
          updated_at: string
        }
        Insert: {
          churn_risk?: string | null
          client_dependency?: string | null
          client_feedback?: string | null
          communication_channel?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          current_blockers?: string | null
          current_nps?: number | null
          id?: string
          last_executive_checkpoint?: string | null
          onboarding_company_id?: string | null
          product_id: string
          product_name: string
          product_variables?: Json | null
          project_complexity?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          churn_risk?: string | null
          client_dependency?: string | null
          client_feedback?: string | null
          communication_channel?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          current_blockers?: string | null
          current_nps?: number | null
          id?: string
          last_executive_checkpoint?: string | null
          onboarding_company_id?: string | null
          product_id?: string
          product_name?: string
          product_variables?: Json | null
          project_complexity?: string | null
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
            foreignKeyName: "onboarding_projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "portal_users"
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
