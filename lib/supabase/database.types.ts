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
          department_id: string | null
          id: string
          member_id: string | null
          organization_id: string
          reason: string | null
          request_id: string
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by_member_id?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          member_id?: string | null
          organization_id: string
          reason?: string | null
          request_id: string
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by_member_id?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          member_id?: string | null
          organization_id?: string
          reason?: string | null
          request_id?: string
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_department_fk"
            columns: ["organization_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["organization_id", "id"]
          },
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
          approved_at: string | null
          approved_by_member_id: string | null
          client_upload_id: string
          completed_at: string | null
          content_sha256: string | null
          conversation_id: string | null
          created_at: string
          deleted_at: string | null
          document_kind: string
          id: string
          invalidated_at: string | null
          message_id: string | null
          mime_type: string
          organization_id: string
          original_filename: string
          rejection_code: string | null
          request_id: string | null
          scan_status: string
          size_bytes: number
          storage_bucket: string
          storage_path: string
          upload_expires_at: string | null
          upload_status: string
          uploaded_by_member_id: string | null
          uploaded_by_type: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_member_id?: string | null
          client_upload_id?: string
          completed_at?: string | null
          content_sha256?: string | null
          conversation_id?: string | null
          created_at?: string
          deleted_at?: string | null
          document_kind?: string
          id?: string
          invalidated_at?: string | null
          message_id?: string | null
          mime_type: string
          organization_id: string
          original_filename: string
          rejection_code?: string | null
          request_id?: string | null
          scan_status?: string
          size_bytes: number
          storage_bucket: string
          storage_path: string
          upload_expires_at?: string | null
          upload_status?: string
          uploaded_by_member_id?: string | null
          uploaded_by_type?: string
        }
        Update: {
          approved_at?: string | null
          approved_by_member_id?: string | null
          client_upload_id?: string
          completed_at?: string | null
          content_sha256?: string | null
          conversation_id?: string | null
          created_at?: string
          deleted_at?: string | null
          document_kind?: string
          id?: string
          invalidated_at?: string | null
          message_id?: string | null
          mime_type?: string
          organization_id?: string
          original_filename?: string
          rejection_code?: string | null
          request_id?: string | null
          scan_status?: string
          size_bytes?: number
          storage_bucket?: string
          storage_path?: string
          upload_expires_at?: string | null
          upload_status?: string
          uploaded_by_member_id?: string | null
          uploaded_by_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_approved_by_member_fkey"
            columns: ["organization_id", "approved_by_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "attachments_conversation_fk"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
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
      conversation_drafts: {
        Row: {
          budget_currency: string
          budget_max: number | null
          budget_min: number | null
          cancelled_at: string | null
          confirmation_idempotency_key: string | null
          confirmation_nonce_digest: string | null
          confirmation_nonce_expires_at: string | null
          confirmed_at: string | null
          conversation_id: string
          created_at: string
          customer_name: string | null
          description: string | null
          edit_field: string | null
          email: string | null
          intent: string | null
          location: string | null
          organization_id: string
          phone: string | null
          phone_confirmed_at: string | null
          preferred_start_date: string | null
          request_type: string | null
          service_id: string | null
          stage: string
          summary_version: number
          updated_at: string
          version: number
        }
        Insert: {
          budget_currency?: string
          budget_max?: number | null
          budget_min?: number | null
          cancelled_at?: string | null
          confirmation_idempotency_key?: string | null
          confirmation_nonce_digest?: string | null
          confirmation_nonce_expires_at?: string | null
          confirmed_at?: string | null
          conversation_id: string
          created_at?: string
          customer_name?: string | null
          description?: string | null
          edit_field?: string | null
          email?: string | null
          intent?: string | null
          location?: string | null
          organization_id: string
          phone?: string | null
          phone_confirmed_at?: string | null
          preferred_start_date?: string | null
          request_type?: string | null
          service_id?: string | null
          stage?: string
          summary_version?: number
          updated_at?: string
          version?: number
        }
        Update: {
          budget_currency?: string
          budget_max?: number | null
          budget_min?: number | null
          cancelled_at?: string | null
          confirmation_idempotency_key?: string | null
          confirmation_nonce_digest?: string | null
          confirmation_nonce_expires_at?: string | null
          confirmed_at?: string | null
          conversation_id?: string
          created_at?: string
          customer_name?: string | null
          description?: string | null
          edit_field?: string | null
          email?: string | null
          intent?: string | null
          location?: string | null
          organization_id?: string
          phone?: string | null
          phone_confirmed_at?: string | null
          preferred_start_date?: string | null
          request_type?: string | null
          service_id?: string | null
          stage?: string
          summary_version?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "conversation_drafts_organization_id_conversation_id_fkey"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "conversation_drafts_organization_id_service_id_fkey"
            columns: ["organization_id", "service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_member_id: string | null
          channel: string
          closed_at: string | null
          created_at: string
          customer_id: string | null
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
          customer_id?: string | null
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
          customer_id?: string | null
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
          activated_at: string | null
          assigned_at: string | null
          assigned_member_id: string | null
          cancelled_at: string | null
          conversation_id: string
          created_at: string
          id: string
          idempotency_key: string
          organization_id: string
          priority: string
          queued_at: string | null
          reason: string
          reason_code: string
          request_id: string | null
          requested_at: string
          resolution: string | null
          resolved_at: string | null
          resume_automation: boolean | null
          status: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          assigned_at?: string | null
          assigned_member_id?: string | null
          cancelled_at?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          idempotency_key?: string
          organization_id: string
          priority?: string
          queued_at?: string | null
          reason: string
          reason_code?: string
          request_id?: string | null
          requested_at?: string
          resolution?: string | null
          resolved_at?: string | null
          resume_automation?: boolean | null
          status?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          assigned_at?: string | null
          assigned_member_id?: string | null
          cancelled_at?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          organization_id?: string
          priority?: string
          queued_at?: string | null
          reason?: string
          reason_code?: string
          request_id?: string | null
          requested_at?: string
          resolution?: string | null
          resolved_at?: string | null
          resume_automation?: boolean | null
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
          client_message_id: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          organization_id: string
          reply_to_message_id: string | null
          sender_member_id: string | null
          sender_type: string
        }
        Insert: {
          client_message_id?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          organization_id: string
          reply_to_message_id?: string | null
          sender_member_id?: string | null
          sender_type: string
        }
        Update: {
          client_message_id?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          organization_id?: string
          reply_to_message_id?: string | null
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
          {
            foreignKeyName: "messages_reply_to_fk"
            columns: ["organization_id", "reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
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
      public_conversation_access: {
        Row: {
          conversation_id: string
          created_at: string
          expires_at: string
          organization_id: string
          read_disabled_at: string | null
          revoked_at: string | null
          token_digest: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          expires_at: string
          organization_id: string
          read_disabled_at?: string | null
          revoked_at?: string | null
          token_digest: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          expires_at?: string
          organization_id?: string
          read_disabled_at?: string | null
          revoked_at?: string | null
          token_digest?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_conversation_access_organization_id_conversation_id_fkey"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      public_rate_limits: {
        Row: {
          action: string
          expires_at: string
          id: number
          organization_id: string | null
          request_count: number
          subject_digest: string
          window_started_at: string
        }
        Insert: {
          action: string
          expires_at: string
          id?: never
          organization_id?: string | null
          request_count?: number
          subject_digest: string
          window_started_at: string
        }
        Update: {
          action?: string
          expires_at?: string
          id?: never
          organization_id?: string | null
          request_count?: number
          subject_digest?: string
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_rate_limits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          changed_by_type: string
          created_at: string
          from_status: string | null
          id: string
          organization_id: string
          reason: string | null
          request_id: string
          source: string
          to_status: string
        }
        Insert: {
          changed_by_member_id?: string | null
          changed_by_type?: string
          created_at?: string
          from_status?: string | null
          id?: string
          organization_id: string
          reason?: string | null
          request_id: string
          source?: string
          to_status: string
        }
        Update: {
          changed_by_member_id?: string | null
          changed_by_type?: string
          created_at?: string
          from_status?: string | null
          id?: string
          organization_id?: string
          reason?: string | null
          request_id?: string
          source?: string
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
          budget_currency: string | null
          budget_max: number | null
          budget_min: number | null
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
          preferred_start_date: string | null
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
          budget_currency?: string | null
          budget_max?: number | null
          budget_min?: number | null
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
          preferred_start_date?: string | null
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
          budget_currency?: string | null
          budget_max?: number | null
          budget_min?: number | null
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
          preferred_start_date?: string | null
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
      status_verification_challenges: {
        Row: {
          attempt_count: number
          code_digest: string
          consumed_at: string | null
          created_at: string
          delivery_outcome: string
          expires_at: string
          id: string
          locked_until: string | null
          max_attempts: number
          organization_id: string | null
          request_id: string | null
          state: string
          subject_digest: string
          superseded_at: string | null
          verified_at: string | null
        }
        Insert: {
          attempt_count?: number
          code_digest: string
          consumed_at?: string | null
          created_at?: string
          delivery_outcome?: string
          expires_at: string
          id?: string
          locked_until?: string | null
          max_attempts: number
          organization_id?: string | null
          request_id?: string | null
          state?: string
          subject_digest: string
          superseded_at?: string | null
          verified_at?: string | null
        }
        Update: {
          attempt_count?: number
          code_digest?: string
          consumed_at?: string | null
          created_at?: string
          delivery_outcome?: string
          expires_at?: string
          id?: string
          locked_until?: string | null
          max_attempts?: number
          organization_id?: string | null
          request_id?: string | null
          state?: string
          subject_digest?: string
          superseded_at?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "status_verification_challenges_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_verification_challenges_organization_id_request_id_fkey"
            columns: ["organization_id", "request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      status_verification_events: {
        Row: {
          challenge_id: string | null
          created_at: string
          event_type: string
          id: number
          organization_id: string | null
          outcome_code: string
          subject_digest: string
          trace_id: string
        }
        Insert: {
          challenge_id?: string | null
          created_at?: string
          event_type: string
          id?: never
          organization_id?: string | null
          outcome_code: string
          subject_digest: string
          trace_id: string
        }
        Update: {
          challenge_id?: string | null
          created_at?: string
          event_type?: string
          id?: never
          organization_id?: string | null
          outcome_code?: string
          subject_digest?: string
          trace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_verification_events_organization_id_challenge_id_fkey"
            columns: ["organization_id", "challenge_id"]
            isOneToOne: false
            referencedRelation: "status_verification_challenges"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "status_verification_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      status_verification_tokens: {
        Row: {
          access_kind: string
          challenge_id: string
          consumed_at: string | null
          conversation_id: string | null
          created_at: string
          expires_at: string
          id: string
          organization_id: string
          request_id: string
          revoked_at: string | null
          token_digest: string
        }
        Insert: {
          access_kind?: string
          challenge_id: string
          consumed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          organization_id: string
          request_id: string
          revoked_at?: string | null
          token_digest: string
        }
        Update: {
          access_kind?: string
          challenge_id?: string
          consumed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          organization_id?: string
          request_id?: string
          revoked_at?: string | null
          token_digest?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_verification_tokens_organization_id_challenge_id_fkey"
            columns: ["organization_id", "challenge_id"]
            isOneToOne: false
            referencedRelation: "status_verification_challenges"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "status_verification_tokens_organization_id_conversation_id_fkey"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "status_verification_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_verification_tokens_organization_id_request_id_fkey"
            columns: ["organization_id", "request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      whatsapp_accounts: {
        Row: {
          created_at: string
          display_phone_number: string | null
          id: string
          is_active: boolean
          is_test: boolean
          organization_id: string
          phone_number_id: string
          updated_at: string
          whatsapp_business_account_id: string
        }
        Insert: {
          created_at?: string
          display_phone_number?: string | null
          id?: string
          is_active?: boolean
          is_test?: boolean
          organization_id: string
          phone_number_id: string
          updated_at?: string
          whatsapp_business_account_id: string
        }
        Update: {
          created_at?: string
          display_phone_number?: string | null
          id?: string
          is_active?: boolean
          is_test?: boolean
          organization_id?: string
          phone_number_id?: string
          updated_at?: string
          whatsapp_business_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          access_token_digest: string
          conversation_id: string
          created_at: string
          id: string
          organization_id: string
          state: string
          updated_at: string
          whatsapp_account_id: string
          whatsapp_identity_id: string
        }
        Insert: {
          access_token_digest: string
          conversation_id: string
          created_at?: string
          id?: string
          organization_id: string
          state?: string
          updated_at?: string
          whatsapp_account_id: string
          whatsapp_identity_id: string
        }
        Update: {
          access_token_digest?: string
          conversation_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          state?: string
          updated_at?: string
          whatsapp_account_id?: string
          whatsapp_identity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_organization_id_conversation_id_fkey"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_organization_id_whatsapp_account_id_fkey"
            columns: ["organization_id", "whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_organization_id_whatsapp_identity_i_fkey"
            columns: ["organization_id", "whatsapp_identity_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_identities"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      whatsapp_identities: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          organization_id: string
          profile_name: string | null
          updated_at: string
          wa_id: string
          whatsapp_account_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          organization_id: string
          profile_name?: string | null
          updated_at?: string
          wa_id: string
          whatsapp_account_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          organization_id?: string
          profile_name?: string | null
          updated_at?: string
          wa_id?: string
          whatsapp_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_identities_organization_id_customer_id_fkey"
            columns: ["organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "whatsapp_identities_organization_id_whatsapp_account_id_fkey"
            columns: ["organization_id", "whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      whatsapp_message_deliveries: {
        Row: {
          attempt_count: number
          client_message_id: string | null
          conversation_id: string | null
          created_at: string
          direction: string
          id: string
          last_error_code: string | null
          message_id: string | null
          next_attempt_at: string | null
          organization_id: string
          processing_started_at: string | null
          provider_message_id: string | null
          provider_timestamp: string | null
          reply_to_delivery_id: string | null
          status: string
          trace_id: string
          updated_at: string
          whatsapp_account_id: string
          whatsapp_identity_id: string | null
        }
        Insert: {
          attempt_count?: number
          client_message_id?: string | null
          conversation_id?: string | null
          created_at?: string
          direction: string
          id?: string
          last_error_code?: string | null
          message_id?: string | null
          next_attempt_at?: string | null
          organization_id: string
          processing_started_at?: string | null
          provider_message_id?: string | null
          provider_timestamp?: string | null
          reply_to_delivery_id?: string | null
          status: string
          trace_id: string
          updated_at?: string
          whatsapp_account_id: string
          whatsapp_identity_id?: string | null
        }
        Update: {
          attempt_count?: number
          client_message_id?: string | null
          conversation_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          last_error_code?: string | null
          message_id?: string | null
          next_attempt_at?: string | null
          organization_id?: string
          processing_started_at?: string | null
          provider_message_id?: string | null
          provider_timestamp?: string | null
          reply_to_delivery_id?: string | null
          status?: string
          trace_id?: string
          updated_at?: string
          whatsapp_account_id?: string
          whatsapp_identity_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_deliveries_organization_id_conversation_i_fkey"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "whatsapp_message_deliveries_organization_id_message_id_fkey"
            columns: ["organization_id", "message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "whatsapp_message_deliveries_organization_id_reply_to_deliv_fkey"
            columns: ["organization_id", "reply_to_delivery_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_message_deliveries"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "whatsapp_message_deliveries_organization_id_whatsapp_accou_fkey"
            columns: ["organization_id", "whatsapp_account_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_accounts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "whatsapp_message_deliveries_organization_id_whatsapp_ident_fkey"
            columns: ["organization_id", "whatsapp_identity_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_identities"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_private_attachment: {
        Args: {
          p_actual_size: number
          p_attachment_id: string
          p_organization_id: string
          p_sha256: string
        }
        Returns: {
          approved_at: string | null
          approved_by_member_id: string | null
          client_upload_id: string
          completed_at: string | null
          content_sha256: string | null
          conversation_id: string | null
          created_at: string
          deleted_at: string | null
          document_kind: string
          id: string
          invalidated_at: string | null
          message_id: string | null
          mime_type: string
          organization_id: string
          original_filename: string
          rejection_code: string | null
          request_id: string | null
          scan_status: string
          size_bytes: number
          storage_bucket: string
          storage_path: string
          upload_expires_at: string | null
          upload_status: string
          uploaded_by_member_id: string | null
          uploaded_by_type: string
        }[]
        SetofOptions: {
          from: "*"
          to: "attachments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      add_internal_note: {
        Args: { p_content: string; p_request_id: string }
        Returns: {
          author_member_id: string
          content: string
          created_at: string
          id: string
          organization_id: string
          request_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "internal_notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_quotation_attachment: {
        Args: { p_attachment_id: string; p_request_id: string }
        Returns: {
          approved_at: string | null
          approved_by_member_id: string | null
          client_upload_id: string
          completed_at: string | null
          content_sha256: string | null
          conversation_id: string | null
          created_at: string
          deleted_at: string | null
          document_kind: string
          id: string
          invalidated_at: string | null
          message_id: string | null
          mime_type: string
          organization_id: string
          original_filename: string
          rejection_code: string | null
          request_id: string | null
          scan_status: string
          size_bytes: number
          storage_bucket: string
          storage_path: string
          upload_expires_at: string | null
          upload_status: string
          uploaded_by_member_id: string | null
          uploaded_by_type: string
        }
        SetofOptions: {
          from: "*"
          to: "attachments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assign_handoff: {
        Args: { p_handoff_id: string; p_member_id: string }
        Returns: {
          activated_at: string | null
          assigned_at: string | null
          assigned_member_id: string | null
          cancelled_at: string | null
          conversation_id: string
          created_at: string
          id: string
          idempotency_key: string
          organization_id: string
          priority: string
          queued_at: string | null
          reason: string
          reason_code: string
          request_id: string | null
          requested_at: string
          resolution: string | null
          resolved_at: string | null
          resume_automation: boolean | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "human_handoffs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assign_request: {
        Args: {
          p_department_id: string
          p_expected_updated_at: string
          p_member_id: string
          p_reason: string
          p_request_id: string
        }
        Returns: {
          assigned_member_id: string | null
          budget_currency: string | null
          budget_max: number | null
          budget_min: number | null
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
          preferred_start_date: string | null
          priority: string
          reference_number: string
          request_type: string
          service_id: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_whatsapp_delivery: {
        Args: { p_delivery_id: string; p_organization_id: string }
        Returns: boolean
      }
      claim_whatsapp_outbound: {
        Args: { p_inbound_delivery_id: string; p_organization_id: string }
        Returns: {
          delivery_id: string
          message_content: string
        }[]
      }
      complete_whatsapp_delivery: {
        Args: {
          p_delivery_id: string
          p_message_id: string
          p_organization_id: string
          p_trace_id: string
        }
        Returns: string
      }
      complete_whatsapp_handoff_delivery: {
        Args: { p_delivery_id: string; p_organization_id: string }
        Returns: boolean
      }
      confirm_public_request: {
        Args: {
          p_conversation_id: string
          p_idempotency_key: string
          p_nonce_digest: string
          p_token_digest: string
        }
        Returns: {
          created_at: string
          id: string
          reference_number: string
          replayed: boolean
          status: string
        }[]
      }
      consume_conversation_status_grant: {
        Args: {
          p_conversation_id: string
          p_organization_id: string
          p_reference_number: string
          p_trace_id: string
        }
        Returns: {
          reference_number: string
          service_name: string
          status: string
          updated_at: string
        }[]
      }
      consume_public_rate_limit: {
        Args: {
          p_action: string
          p_limit: number
          p_organization_id: string
          p_subject_digest: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      consume_status_token: {
        Args: {
          p_reference_number: string
          p_token_digest: string
          p_trace_id: string
        }
        Returns: {
          reference_number: string
          service_name: string
          status: string
          updated_at: string
        }[]
      }
      create_public_conversation: {
        Args: { p_organization_slug: string; p_token_digest: string }
        Returns: {
          conversation_id: string
          created_at: string
          organization_id: string
          organization_name: string
        }[]
      }
      find_status_target: {
        Args: { p_organization_slug: string; p_reference_number: string }
        Returns: {
          organization_id: string
          phone: string
          reference_number: string
          request_id: string
          service_name: string
          status: string
          updated_at: string
        }[]
      }
      ingest_whatsapp_text_message: {
        Args: {
          p_access_token_digest: string
          p_client_message_id: string
          p_phone_number_id: string
          p_profile_name: string
          p_provider_message_id: string
          p_provider_timestamp: string
          p_trace_id: string
          p_wa_id: string
          p_whatsapp_business_account_id: string
        }
        Returns: {
          access_token_digest: string
          account_id: string
          client_message_id: string
          conversation_id: string
          created: boolean
          delivery_id: string
          delivery_status: string
          identity_id: string
          organization_id: string
        }[]
      }
      join_handoff: {
        Args: { p_handoff_id: string }
        Returns: {
          activated_at: string | null
          assigned_at: string | null
          assigned_member_id: string | null
          cancelled_at: string | null
          conversation_id: string
          created_at: string
          id: string
          idempotency_key: string
          organization_id: string
          priority: string
          queued_at: string | null
          reason: string
          reason_code: string
          request_id: string | null
          requested_at: string
          resolution: string | null
          resolved_at: string | null
          resume_automation: boolean | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "human_handoffs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      process_public_message: {
        Args: {
          p_budget_max: number
          p_budget_min: number
          p_cancelled_at: string
          p_client_message_id: string
          p_conversation_id: string
          p_customer_content: string
          p_customer_name: string
          p_description: string
          p_email: string
          p_expected_version: number
          p_intent: string
          p_location: string
          p_phone: string
          p_phone_confirmed_at: string
          p_preferred_start_date: string
          p_reply: string
          p_request_type: string
          p_service_id: string
          p_stage: string
          p_token_digest: string
        }
        Returns: boolean
      }
      record_handoff_customer_message: {
        Args: {
          p_client_message_id: string
          p_content: string
          p_conversation_id: string
          p_token_digest: string
        }
        Returns: boolean
      }
      record_public_request_follow_up: {
        Args: {
          p_client_message_id: string
          p_content: string
          p_conversation_id: string
          p_token_digest: string
        }
        Returns: boolean
      }
      record_whatsapp_send_result: {
        Args: {
          p_delivery_id: string
          p_error_code?: string
          p_organization_id: string
          p_outcome: string
          p_provider_message_id?: string
        }
        Returns: boolean
      }
      release_whatsapp_delivery: {
        Args: {
          p_delivery_id: string
          p_error_code: string
          p_organization_id: string
        }
        Returns: boolean
      }
      request_more_information: {
        Args: {
          p_expected_updated_at: string
          p_question: string
          p_request_id: string
        }
        Returns: {
          assigned_member_id: string | null
          budget_currency: string | null
          budget_max: number | null
          budget_min: number | null
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
          preferred_start_date: string | null
          priority: string
          reference_number: string
          request_type: string
          service_id: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_public_handoff: {
        Args: {
          p_conversation_id: string
          p_idempotency_key: string
          p_priority: string
          p_reason: string
          p_reason_code: string
          p_token_digest: string
        }
        Returns: {
          activated_at: string | null
          assigned_at: string | null
          assigned_member_id: string | null
          cancelled_at: string | null
          conversation_id: string
          created_at: string
          id: string
          idempotency_key: string
          organization_id: string
          priority: string
          queued_at: string | null
          reason: string
          reason_code: string
          request_id: string | null
          requested_at: string
          resolution: string | null
          resolved_at: string | null
          resume_automation: boolean | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "human_handoffs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_handoff: {
        Args: {
          p_handoff_id: string
          p_resolution: string
          p_resume_automation: boolean
        }
        Returns: {
          activated_at: string | null
          assigned_at: string | null
          assigned_member_id: string | null
          cancelled_at: string | null
          conversation_id: string
          created_at: string
          id: string
          idempotency_key: string
          organization_id: string
          priority: string
          queued_at: string | null
          reason: string
          reason_code: string
          request_id: string | null
          requested_at: string
          resolution: string | null
          resolved_at: string | null
          resume_automation: boolean | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "human_handoffs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      restore_whatsapp_conversation_access: {
        Args: { p_conversation_id: string; p_organization_id: string }
        Returns: boolean
      }
      send_handoff_message: {
        Args: {
          p_client_message_id: string
          p_content: string
          p_handoff_id: string
        }
        Returns: {
          client_message_id: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          organization_id: string
          reply_to_message_id: string | null
          sender_member_id: string | null
          sender_type: string
        }
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_request_status: {
        Args: {
          p_expected_updated_at: string
          p_new_status: string
          p_reason: string
          p_request_id: string
        }
        Returns: {
          assigned_member_id: string | null
          budget_currency: string | null
          budget_max: number | null
          budget_min: number | null
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
          preferred_start_date: string | null
          priority: string
          reference_number: string
          request_type: string
          service_id: string
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_whatsapp_delivery_status: {
        Args: {
          p_error_code?: string
          p_phone_number_id: string
          p_provider_message_id: string
          p_status: string
        }
        Returns: boolean
      }
      verify_status_challenge: {
        Args: {
          p_challenge_id: string
          p_code_digest: string
          p_conversation_id: string
          p_conversation_token_digest: string
          p_lockout_seconds: number
          p_organization_id: string
          p_token_digest: string
          p_token_ttl_seconds: number
          p_trace_id: string
        }
        Returns: {
          success: boolean
          token_expires_at: string
        }[]
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
  public: {
    Enums: {},
  },
} as const
