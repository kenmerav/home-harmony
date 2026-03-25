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
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      household_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          household_id: string
          id: string
          invited_by: string
          role: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          household_id: string
          id?: string
          invited_by: string
          role: string
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          household_id?: string
          id?: string
          invited_by?: string
          role?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          created_at: string
          household_id: string
          id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      growth_events: {
        Row: {
          created_at: string
          dedupe_key: string
          event_type: string
          id: string
          metadata: Json | null
          occurred_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dedupe_key: string
          event_type: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lifecycle_flow_settings: {
        Row: {
          created_at: string
          day0_enabled: boolean
          day10_enabled: boolean
          day2_enabled: boolean
          day5_enabled: boolean
          email_enabled: boolean
          sms_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day0_enabled?: boolean
          day10_enabled?: boolean
          day2_enabled?: boolean
          day5_enabled?: boolean
          email_enabled?: boolean
          sms_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day0_enabled?: boolean
          day10_enabled?: boolean
          day2_enabled?: boolean
          day5_enabled?: boolean
          email_enabled?: boolean
          sms_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      free_tools_cta_events: {
        Row: {
          created_at: string
          dedupe_key: string
          event_type: string
          id: string
          metadata: Json | null
          occurred_at: string
          tool_slug: string
          user_id: string
          variant: string
        }
        Insert: {
          created_at?: string
          dedupe_key: string
          event_type: string
          id?: string
          metadata?: Json | null
          occurred_at: string
          tool_slug: string
          user_id?: string
          variant: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          tool_slug?: string
          user_id?: string
          variant?: string
        }
        Relationships: []
      }
      free_tools_lead_captures: {
        Row: {
          captured_at: string
          created_at: string
          dedupe_key: string
          email: string
          id: string
          tool_slug: string
          user_id: string
          variant: string
        }
        Insert: {
          captured_at: string
          created_at?: string
          dedupe_key: string
          email: string
          id?: string
          tool_slug: string
          user_id?: string
          variant: string
        }
        Update: {
          captured_at?: string
          created_at?: string
          dedupe_key?: string
          email?: string
          id?: string
          tool_slug?: string
          user_id?: string
          variant?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_events: {
        Row: {
          created_at: string
          id: string
          referred_email: string | null
          referred_user_id: string | null
          referrer_user_id: string
          source: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          referred_email?: string | null
          referred_user_id?: string | null
          referrer_user_id: string
          source?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          referred_email?: string | null
          referred_user_id?: string | null
          referrer_user_id?: string
          source?: string | null
          status?: string
        }
        Relationships: []
      }
      planned_meals: {
        Row: {
          created_at: string
          day: string
          id: string
          is_locked: boolean
          is_skipped: boolean
          owner_id: string | null
          recipe_id: string
          week_of: string
        }
        Insert: {
          created_at?: string
          day: string
          id?: string
          is_locked?: boolean
          is_skipped?: boolean
          owner_id?: string | null
          recipe_id: string
          week_of: string
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          is_locked?: boolean
          is_skipped?: boolean
          owner_id?: string | null
          recipe_id?: string
          week_of?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_meals_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          dietary_preferences: string[]
          email: string | null
          family_size: number | null
          full_name: string | null
          goals: string | null
          household_id: string | null
          household_name: string | null
          id: string
          onboarding_completed_at: string | null
          onboarding_settings: Json | null
          phone: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dietary_preferences?: string[]
          email?: string | null
          family_size?: number | null
          full_name?: string | null
          goals?: string | null
          household_id?: string | null
          household_name?: string | null
          id: string
          onboarding_completed_at?: string | null
          onboarding_settings?: Json | null
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dietary_preferences?: string[]
          email?: string | null
          family_size?: number | null
          full_name?: string | null
          goals?: string | null
          household_id?: string | null
          household_name?: string | null
          id?: string
          onboarding_completed_at?: string | null
          onboarding_settings?: Json | null
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          calories: number
          carbs_g: number
          course_type: string
          created_at: string
          default_day: string | null
          fat_g: number
          fiber_g: number | null
          id: string
          ingredients: string[]
          ingredients_raw: string | null
          instructions: string | null
          is_anchored: boolean
          is_meal_prep: boolean
          meal_type: string
          name: string
          owner_id: string | null
          protein_g: number
          servings: number
          updated_at: string
        }
        Insert: {
          calories?: number
          carbs_g?: number
          course_type?: string
          created_at?: string
          default_day?: string | null
          fat_g?: number
          fiber_g?: number | null
          id?: string
          ingredients?: string[]
          ingredients_raw?: string | null
          instructions?: string | null
          is_anchored?: boolean
          is_meal_prep?: boolean
          meal_type?: string
          name: string
          owner_id?: string | null
          protein_g?: number
          servings?: number
          updated_at?: string
        }
        Update: {
          calories?: number
          carbs_g?: number
          course_type?: string
          created_at?: string
          default_day?: string | null
          fat_g?: number
          fiber_g?: number | null
          id?: string
          ingredients?: string[]
          ingredients_raw?: string | null
          instructions?: string | null
          is_anchored?: boolean
          is_meal_prep?: boolean
          meal_type?: string
          name?: string
          owner_id?: string | null
          protein_g?: number
          servings?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          price_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          price_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          price_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_household_invite: {
        Args: { invite_token: string }
        Returns: string
      }
      claim_referral: {
        Args: { ref_code: string }
        Returns: boolean
      }
      create_or_get_household: {
        Args: { household_name?: string }
        Returns: string
      }
      get_or_create_referral_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_referral_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_household_dashboard: { Args: never; Returns: Json }
      invite_household_member: {
        Args: { invite_email: string; invite_role?: string }
        Returns: string
      }
      track_growth_event: {
        Args: {
          p_dedupe_key?: string
          p_event_type: string
          p_metadata?: Json
          p_occurred_at?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
