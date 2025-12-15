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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    },
  },
} as const
