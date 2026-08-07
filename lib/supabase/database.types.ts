export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      assignments: {
        Row: {
          assigned_at: string
          assigned_by_member_id: string | null
          created_at: string
          id: string
          member_id: string
          organization_id: string
          request_id: string
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by_member_id?: string | null
          created_at?: string
          id?: string
          member_id: string
          organization_id: string
          request_id: string
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by_member_id?: string | null
          created_at?: string
          id?: string
          member_id?: string
          organization_id?: string
          request_id?: string
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_organization_id_assigned_by_member_id_fkey"
            columns: ["organization_id", "assigned_by_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_organization_id_member_id_fkey"
            columns: ["organization_id", "member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "assignments_organization_id_request_id_fkey"
            columns: ["organization_id", "request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          id: string
          message_id: string | null
          mime_type: string
          organization_id: string
          original_filename: string
          request_id: string | null
          size_bytes: number
          storage_bucket: string
          storage_path: string
          uploaded_by_member_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message_id?: string | null
          mime_type: string
          organization_id: string
          original_filename: string
          request_id?: string | null
          size_bytes: number
          storage_bucket: string
          storage_path: string
          uploaded_by_member_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string | null
          mime_type?: string
          organization_id?: string
          original_filename?: string
          request_id?: string | null
          size_bytes?: number
          storage_bucket?: string
          storage_path?: string
          uploaded_by_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_organization_id_message_id_fkey"
            columns: ["organization_id", "message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "attachments_organization_id_request_id_fkey"
            columns: ["organization_id", "request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "attachments_organization_id_uploaded_by_member_id_fkey"
            columns: ["organization_id", "uploaded_by_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_member_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          organization_id: string
        }
        Insert: {
          action: string
          actor_member_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          organization_id: string
        }
        Update: {
          action?: string
          actor_member_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_actor_member_id_fkey"
            columns: ["organization_id", "actor_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_member_id: string | null
          channel: string
          closed_at: string | null
          created_at: string
          customer_id: string
          id: string
          organization_id: string
          request_id: string | null
          started_at: string
          state: string
          updated_at: string
        }
        Insert: {
          assigned_member_id?: string | null
          channel?: string
          closed_at?: string | null
          created_at?: string
          customer_id: string
          id?: string
          organization_id: string
          request_id?: string | null
          started_at?: string
          state?: string
          updated_at?: string
        }
        Update: {
          assigned_member_id?: string | null
          channel?: string
          closed_at?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          organization_id?: string
          request_id?: string | null
          started_at?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_organization_id_assigned_member_id_fkey"
            columns: ["organization_id", "assigned_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "conversations_organization_id_customer_id_fkey"
            columns: ["organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_request_fk"
            columns: ["organization_id", "request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      customers: {
        Row: {
          consent_to_contact: boolean
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          organization_id: string
          phone: string | null
          preferred_language: string
          updated_at: string
        }
        Insert: {
          consent_to_contact?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          organization_id: string
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          consent_to_contact?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string
          id: string
          organization_id: string
          rating: number
          request_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id: string
          id?: string
          organization_id: string
          rating: number
          request_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          organization_id?: string
          rating?: number
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_organization_id_customer_id_fkey"
            columns: ["organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_organization_id_request_id_fkey"
            columns: ["organization_id", "request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      human_handoffs: {
        Row: {
          assigned_member_id: string | null
          conversation_id: string
          created_at: string
          id: string
          organization_id: string
          priority: string
          reason: string
          request_id: string | null
          requested_at: string
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_member_id?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          organization_id: string
          priority?: string
          reason: string
          request_id?: string | null
          requested_at?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_member_id?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          priority?: string
          reason?: string
          request_id?: string | null
          requested_at?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "human_handoffs_organization_id_assigned_member_id_fkey"
            columns: ["organization_id", "assigned_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "human_handoffs_organization_id_conversation_id_fkey"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "human_handoffs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "human_handoffs_organization_id_request_id_fkey"
            columns: ["organization_id", "request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      internal_notes: {
        Row: {
          author_member_id: string
          content: string
          created_at: string
          id: string
          organization_id: string
          request_id: string
          updated_at: string
        }
        Insert: {
          author_member_id: string
          content: string
          created_at?: string
          id?: string
          organization_id: string
          request_id: string
          updated_at?: string
        }
        Update: {
          author_member_id?: string
          content?: string
          created_at?: string
          id?: string
          organization_id?: string
          request_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_notes_organization_id_author_member_id_fkey"
            columns: ["organization_id", "author_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "internal_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_notes_organization_id_request_id_fkey"
            columns: ["organization_id", "request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          approved_at: string | null
          approved_by_member_id: string | null
          content: string
          created_at: string
          document_type: string
          id: string
          organization_id: string
          service_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_member_id?: string | null
          content: string
          created_at?: string
          document_type?: string
          id?: string
          organization_id: string
          service_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by_member_id?: string | null
          content?: string
          created_at?: string
          document_type?: string
          id?: string
          organization_id?: string
          service_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_organization_id_approved_by_member_id_fkey"
            columns: ["organization_id", "approved_by_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "knowledge_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_documents_organization_id_service_id_fkey"
            columns: ["organization_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          organization_id: string
          sender_member_id: string | null
          sender_type: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          organization_id: string
          sender_member_id?: string | null
          sender_type: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          organization_id?: string
          sender_member_id?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_organization_id_conversation_id_fkey"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_organization_id_sender_member_id_fkey"
            columns: ["organization_id", "sender_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          organization_id: string
          read_at: string | null
          recipient_member_id: string
          request_id: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind: string
          organization_id: string
          read_at?: string | null
          recipient_member_id: string
          request_id?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          organization_id?: string
          read_at?: string | null
          recipient_member_id?: string
          request_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_recipient_member_id_fkey"
            columns: ["organization_id", "recipient_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "notifications_organization_id_request_id_fkey"
            columns: ["organization_id", "request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          department_id: string | null
          display_name: string
          id: string
          is_active: boolean
          organization_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          organization_id: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_department_fk"
            columns: ["organization_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          default_language: string
          id: string
          is_active: boolean
          name: string
          reference_prefix: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_language?: string
          id?: string
          is_active?: boolean
          name: string
          reference_prefix: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_language?: string
          id?: string
          is_active?: boolean
          name?: string
          reference_prefix?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      request_reference_counters: {
        Row: {
          last_value: number
          organization_id: string
          reference_year: number
          updated_at: string
        }
        Insert: {
          last_value: number
          organization_id: string
          reference_year: number
          updated_at?: string
        }
        Update: {
          last_value?: number
          organization_id?: string
          reference_year?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_reference_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      request_status_history: {
        Row: {
          changed_by_member_id: string | null
          created_at: string
          from_status: string | null
          id: string
          organization_id: string
          reason: string | null
          request_id: string
          to_status: string
        }
        Insert: {
          changed_by_member_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          organization_id: string
          reason?: string | null
          request_id: string
          to_status: string
        }
        Update: {
          changed_by_member_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          organization_id?: string
          reason?: string | null
          request_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_status_history_organization_id_changed_by_member_i_fkey"
            columns: ["organization_id", "changed_by_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "request_status_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_status_history_organization_id_request_id_fkey"
            columns: ["organization_id", "request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      requests: {
        Row: {
          assigned_member_id: string | null
          confirmed_at: string | null
          conversation_id: string | null
          created_at: string
          customer_id: string
          department_id: string | null
          description: string | null
          id: string
          idempotency_key: string
          location: string | null
          organization_id: string
          priority: string
          reference_number: string
          request_type: string
          service_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_member_id?: string | null
          confirmed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          customer_id: string
          department_id?: string | null
          description?: string | null
          id?: string
          idempotency_key: string
          location?: string | null
          organization_id: string
          priority?: string
          reference_number: string
          request_type: string
          service_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_member_id?: string | null
          confirmed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          customer_id?: string
          department_id?: string | null
          description?: string | null
          id?: string
          idempotency_key?: string
          location?: string | null
          organization_id?: string
          priority?: string
          reference_number?: string
          request_type?: string
          service_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_organization_id_assigned_member_id_fkey"
            columns: ["organization_id", "assigned_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "requests_organization_id_conversation_id_fkey"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "requests_organization_id_customer_id_fkey"
            columns: ["organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "requests_organization_id_department_id_fkey"
            columns: ["organization_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_organization_id_service_id_fkey"
            columns: ["organization_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_department_id_fkey"
            columns: ["organization_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
