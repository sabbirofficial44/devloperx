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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_created_users: {
        Row: {
          created_at: string
          created_by: string
          credits: number | null
          display_name: string | null
          email: string
          id: string
          password: string
          plan: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          credits?: number | null
          display_name?: string | null
          email: string
          id?: string
          password: string
          plan?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          credits?: number | null
          display_name?: string | null
          email?: string
          id?: string
          password?: string
          plan?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      alert_log: {
        Row: {
          created_at: string
          email_ok: boolean | null
          id: string
          kind: string
          message: string | null
          slack_ok: boolean | null
          subject: string | null
        }
        Insert: {
          created_at?: string
          email_ok?: boolean | null
          id?: string
          kind: string
          message?: string | null
          slack_ok?: boolean | null
          subject?: string | null
        }
        Update: {
          created_at?: string
          email_ok?: boolean | null
          id?: string
          kind?: string
          message?: string | null
          slack_ok?: boolean | null
          subject?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          active: boolean
          body: string
          created_at: string
          id: string
          kind: string
          title: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          id?: string
          kind?: string
          title: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          id?: string
          kind?: string
          title?: string
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string
          id: string
          metadata: Json
          reason: string | null
          source: string | null
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          source?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_verifications: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      password_resets: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          assigned_cookies: Json | null
          cookies_rotated_at: string | null
          created_at: string
          credits: number
          display_name: string | null
          email: string | null
          last_tick_at: string
          trial_started_at: string | null
          updated_at: string
          user_id: string
          user_plan: string
        }
        Insert: {
          assigned_cookies?: Json | null
          cookies_rotated_at?: string | null
          created_at?: string
          credits?: number
          display_name?: string | null
          email?: string | null
          last_tick_at?: string
          trial_started_at?: string | null
          updated_at?: string
          user_id: string
          user_plan?: string
        }
        Update: {
          assigned_cookies?: Json | null
          cookies_rotated_at?: string | null
          created_at?: string
          credits?: number
          display_name?: string | null
          email?: string | null
          last_tick_at?: string
          trial_started_at?: string | null
          updated_at?: string
          user_id?: string
          user_plan?: string
        }
        Relationships: []
      }
      prompt_history: {
        Row: {
          created_at: string
          id: string
          prompt: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          prompt: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          prompt?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          created_at: string
          id: number
          key: string
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: number
          key: string
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: number
          key?: string
        }
        Relationships: []
      }
      session_cookies: {
        Row: {
          cookies: Json
          created_at: string
          id: string
          total_cookies: number
          updated_at: string
        }
        Insert: {
          cookies?: Json
          created_at?: string
          id?: string
          total_cookies?: number
          updated_at?: string
        }
        Update: {
          cookies?: Json
          created_at?: string
          id?: string
          total_cookies?: number
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          bkash_number: string | null
          contact_number: string | null
          id: number
          offer_text: string | null
          plans: Json
          telegram_url: string | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          bkash_number?: string | null
          contact_number?: string | null
          id?: number
          offer_text?: string | null
          plans?: Json
          telegram_url?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          bkash_number?: string | null
          contact_number?: string | null
          id?: number
          offer_text?: string | null
          plans?: Json
          telegram_url?: string | null
          updated_at?: string
          whatsapp_number?: string | null
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
      video_history: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          model: string | null
          prompt: string | null
          source: string
          status: string
          thumbnail_url: string | null
          user_id: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          model?: string | null
          prompt?: string | null
          source?: string
          status?: string
          thumbnail_url?: string | null
          user_id: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          model?: string | null
          prompt?: string | null
          source?: string
          status?: string
          thumbnail_url?: string | null
          user_id?: string
          video_url?: string | null
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
      start_trial_if_needed: { Args: { _user_id: string }; Returns: undefined }
      tick_trial_credits: {
        Args: { _user_id: string }
        Returns: {
          credits: number
          last_tick_at: string
          plan: string
        }[]
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
