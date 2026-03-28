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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_users: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          name: string
          pin: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          name: string
          pin: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          name?: string
          pin?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          end_date: string
          id: string
          property_id: string
          source_url: string | null
          start_date: string
          status: string
          summary: string | null
          synced_at: string
        }
        Insert: {
          end_date: string
          id?: string
          property_id: string
          source_url?: string | null
          start_date: string
          status?: string
          summary?: string | null
          synced_at?: string
        }
        Update: {
          end_date?: string
          id?: string
          property_id?: string
          source_url?: string | null
          start_date?: string
          status?: string
          summary?: string | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tickets: {
        Row: {
          cost_visible_to_owner: boolean
          created_at: string
          created_by_role: string
          created_by_user_id: string | null
          description: string | null
          id: string
          priority: string
          property_id: string
          repair_cost: number
          resolved_at: string | null
          status: string
          title: string
          visible_to_cleaner: boolean
          visible_to_owner: boolean
        }
        Insert: {
          cost_visible_to_owner?: boolean
          created_at?: string
          created_by_role?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          priority?: string
          property_id: string
          repair_cost?: number
          resolved_at?: string | null
          status?: string
          title: string
          visible_to_cleaner?: boolean
          visible_to_owner?: boolean
        }
        Update: {
          cost_visible_to_owner?: boolean
          created_at?: string
          created_by_role?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          priority?: string
          property_id?: string
          repair_cost?: number
          resolved_at?: string | null
          status?: string
          title?: string
          visible_to_cleaner?: boolean
          visible_to_owner?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tickets_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_reservations: {
        Row: {
          check_in: string
          check_out: string
          cleaning_status: string
          created_at: string
          external_id: string | null
          guest_name: string
          id: string
          is_blocked: boolean
          last_cleaned_at: string | null
          net_payout: number
          property_id: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          check_in: string
          check_out: string
          cleaning_status?: string
          created_at?: string
          external_id?: string | null
          guest_name: string
          id?: string
          is_blocked?: boolean
          last_cleaned_at?: string | null
          net_payout?: number
          property_id: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          check_in?: string
          check_out?: string
          cleaning_status?: string
          created_at?: string
          external_id?: string | null
          guest_name?: string
          id?: string
          is_blocked?: boolean
          last_cleaned_at?: string | null
          net_payout?: number
          property_id?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_reservations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      pin_attempts: {
        Row: {
          attempted_at: string
          id: string
          ip_address: string
        }
        Insert: {
          attempted_at?: string
          id?: string
          ip_address: string
        }
        Update: {
          attempted_at?: string
          id?: string
          ip_address?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          cleaner_pin: string | null
          cleaning_notes: string | null
          created_at: string
          currency: string
          ical_urls: string[] | null
          id: string
          keybox_code: string | null
          name: string
          nightly_rate: number
          owner_name: string
          owner_pin: string
        }
        Insert: {
          cleaner_pin?: string | null
          cleaning_notes?: string | null
          created_at?: string
          currency?: string
          ical_urls?: string[] | null
          id?: string
          keybox_code?: string | null
          name: string
          nightly_rate?: number
          owner_name: string
          owner_pin: string
        }
        Update: {
          cleaner_pin?: string | null
          cleaning_notes?: string | null
          created_at?: string
          currency?: string
          ical_urls?: string[] | null
          id?: string
          keybox_code?: string | null
          name?: string
          nightly_rate?: number
          owner_name?: string
          owner_pin?: string
        }
        Relationships: []
      }
      ticket_media: {
        Row: {
          created_at: string
          id: string
          media_type: string
          storage_path: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_type: string
          storage_path: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          media_type?: string
          storage_path?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_media_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_property_access: {
        Row: {
          can_mark_cleaned: boolean
          can_view_cleaning: boolean
          can_view_finance: boolean
          id: string
          property_id: string
          user_id: string
        }
        Insert: {
          can_mark_cleaned?: boolean
          can_view_cleaning?: boolean
          can_view_finance?: boolean
          id?: string
          property_id: string
          user_id: string
        }
        Update: {
          can_mark_cleaned?: boolean
          can_view_cleaning?: boolean
          can_view_finance?: boolean
          id?: string
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_property_access_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_property_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
