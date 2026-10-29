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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_controls: {
        Row: {
          org_id: string
          paused: boolean
          reason: string | null
          updated_at: string
        }
        Insert: {
          org_id: string
          paused?: boolean
          reason?: string | null
          updated_at?: string
        }
        Update: {
          org_id?: string
          paused?: boolean
          reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_controls_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_jobs: {
        Row: {
          asset_id: string
          attempts: number
          consent_at: string
          consent_by: string
          created_at: string
          error: string | null
          error_status: number | null
          finished_at: string | null
          id: string
          max_attempts: number
          org_id: string
          retry_at: string | null
          status: string
          task: string
        }
        Insert: {
          asset_id: string
          attempts?: number
          consent_at?: string
          consent_by: string
          created_at?: string
          error?: string | null
          error_status?: number | null
          finished_at?: string | null
          id?: string
          max_attempts?: number
          org_id: string
          retry_at?: string | null
          status?: string
          task: string
        }
        Update: {
          asset_id?: string
          attempts?: number
          consent_at?: string
          consent_by?: string
          created_at?: string
          error?: string | null
          error_status?: number | null
          finished_at?: string | null
          id?: string
          max_attempts?: number
          org_id?: string
          retry_at?: string | null
          status?: string
          task?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      annotations: {
        Row: {
          created_at: string
          id: string
          interpretation_id: string
          label: string
          org_id: string
          origin: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          interpretation_id: string
          label: string
          org_id: string
          origin?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          interpretation_id?: string
          label?: string
          org_id?: string
          origin?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "annotations_interpretation_id_fkey"
            columns: ["interpretation_id"]
            isOneToOne: false
            referencedRelation: "interpretations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          org_id: string
          rate_limit_per_minute: number
          revoked_at: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          org_id: string
          rate_limit_per_minute?: number
          revoked_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          org_id?: string
          rate_limit_per_minute?: number
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage: {
        Row: {
          count: number
          key_id: string
          window_start: string
        }
        Insert: {
          count?: number
          key_id: string
          window_start: string
        }
        Update: {
          count?: number
          key_id?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_versions: {
        Row: {
          asset_id: string
          created_at: string
          created_by: string
          derivation: string | null
          id: string
          is_original: boolean
          org_id: string
          sha256: string | null
          storage_path: string | null
          version: number
        }
        Insert: {
          asset_id: string
          created_at?: string
          created_by: string
          derivation?: string | null
          id?: string
          is_original?: boolean
          org_id: string
          sha256?: string | null
          storage_path?: string | null
          version: number
        }
        Update: {
          asset_id?: string
          created_at?: string
          created_by?: string
          derivation?: string | null
          id?: string
          is_original?: boolean
          org_id?: string
          sha256?: string | null
          storage_path?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_versions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          adapter: string | null
          adapter_version: string | null
          byte_size: number | null
          captured_at: string | null
          created_at: string
          created_by: string
          device: string | null
          ebit_id: string
          file_name: string | null
          id: string
          ingestion_status: string
          kind: string
          latitude: number | null
          longitude: number | null
          metadata: Json
          mime_type: string | null
          org_id: string
          original_metadata: Json
          rights_id: string | null
          sha256: string | null
          source: string | null
          source_identifier: string | null
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          adapter?: string | null
          adapter_version?: string | null
          byte_size?: number | null
          captured_at?: string | null
          created_at?: string
          created_by: string
          device?: string | null
          ebit_id?: string
          file_name?: string | null
          id?: string
          ingestion_status?: string
          kind: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json
          mime_type?: string | null
          org_id: string
          original_metadata?: Json
          rights_id?: string | null
          sha256?: string | null
          source?: string | null
          source_identifier?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          adapter?: string | null
          adapter_version?: string | null
          byte_size?: number | null
          captured_at?: string | null
          created_at?: string
          created_by?: string
          device?: string | null
          ebit_id?: string
          file_name?: string | null
          id?: string
          ingestion_status?: string
          kind?: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json
          mime_type?: string | null
          org_id?: string
          original_metadata?: Json
          rights_id?: string | null
          sha256?: string | null
          source?: string | null
          source_identifier?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_rights_id_fkey"
            columns: ["rights_id"]
            isOneToOne: false
            referencedRelation: "rights_records"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          details: Json
          id: string
          occurred_at: string
          org_id: string | null
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          details?: Json
          id?: string
          occurred_at?: string
          org_id?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          details?: Json
          id?: string
          occurred_at?: string
          org_id?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      biodiversity_details: {
        Row: {
          id: string
          latitude: number | null
          locality: string | null
          longitude: number | null
          org_id: string
          original_metadata: Json
          recorded_by: string | null
        }
        Insert: {
          id: string
          latitude?: number | null
          locality?: string | null
          longitude?: number | null
          org_id: string
          original_metadata?: Json
          recorded_by?: string | null
        }
        Update: {
          id?: string
          latitude?: number | null
          locality?: string | null
          longitude?: number | null
          org_id?: string
          original_metadata?: Json
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "biodiversity_details_org_id_id_fkey"
            columns: ["org_id", "id"]
            isOneToOne: false
            referencedRelation: "biodiversity_observations"
            referencedColumns: ["org_id", "id"]
          },
        ]
      }
      biodiversity_observations: {
        Row: {
          basis_of_record: string | null
          coordinate_uncertainty: number | null
          created_at: string
          event_date: string | null
          habitat: string | null
          id: string
          latitude: number | null
          longitude: number | null
          occurrence_id: string
          org_id: string
          sensitive: boolean
          source_asset_id: string | null
          source_row: number | null
          taxon_id: string
        }
        Insert: {
          basis_of_record?: string | null
          coordinate_uncertainty?: number | null
          created_at?: string
          event_date?: string | null
          habitat?: string | null
          id: string
          latitude?: number | null
          longitude?: number | null
          occurrence_id: string
          org_id: string
          sensitive?: boolean
          source_asset_id?: string | null
          source_row?: number | null
          taxon_id: string
        }
        Update: {
          basis_of_record?: string | null
          coordinate_uncertainty?: number | null
          created_at?: string
          event_date?: string | null
          habitat?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          occurrence_id?: string
          org_id?: string
          sensitive?: boolean
          source_asset_id?: string | null
          source_row?: number | null
          taxon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "biodiversity_observations_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "observations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biodiversity_observations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biodiversity_observations_org_id_taxon_id_fkey"
            columns: ["org_id", "taxon_id"]
            isOneToOne: false
            referencedRelation: "taxa"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "biodiversity_observations_source_asset_id_fkey"
            columns: ["source_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      dataset_items: {
        Row: {
          added_at: string
          dataset_id: string
          entity_id: string
          entity_kind: Database["public"]["Enums"]["entity_kind"]
          org_id: string
        }
        Insert: {
          added_at?: string
          dataset_id: string
          entity_id: string
          entity_kind: Database["public"]["Enums"]["entity_kind"]
          org_id: string
        }
        Update: {
          added_at?: string
          dataset_id?: string
          entity_id?: string
          entity_kind?: Database["public"]["Enums"]["entity_kind"]
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dataset_items_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dataset_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      datasets: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          ebit_id: string
          id: string
          metadata: Json
          org_id: string
          published: boolean
          rights_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          ebit_id?: string
          id?: string
          metadata?: Json
          org_id: string
          published?: boolean
          rights_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          ebit_id?: string
          id?: string
          metadata?: Json
          org_id?: string
          published?: boolean
          rights_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "datasets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "datasets_rights_id_fkey"
            columns: ["rights_id"]
            isOneToOne: false
            referencedRelation: "rights_records"
            referencedColumns: ["id"]
          },
        ]
      }
      datastreams: {
        Row: {
          created_at: string
          created_by: string
          ebit_id: string
          id: string
          name: string
          observed_property: string
          org_id: string
          rights_id: string
          sensor_id: string
          unit: string
        }
        Insert: {
          created_at?: string
          created_by: string
          ebit_id?: string
          id?: string
          name: string
          observed_property: string
          org_id: string
          rights_id: string
          sensor_id: string
          unit: string
        }
        Update: {
          created_at?: string
          created_by?: string
          ebit_id?: string
          id?: string
          name?: string
          observed_property?: string
          org_id?: string
          rights_id?: string
          sensor_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "datastreams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "datastreams_org_id_sensor_id_fkey"
            columns: ["org_id", "sensor_id"]
            isOneToOne: false
            referencedRelation: "sensors"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "datastreams_rights_id_fkey"
            columns: ["rights_id"]
            isOneToOne: false
            referencedRelation: "rights_records"
            referencedColumns: ["id"]
          },
        ]
      }
      interpretations: {
        Row: {
          asset_id: string
          confidence: number | null
          created_at: string
          ebit_id: string
          id: string
          job_id: string
          latency_ms: number
          model: string
          model_version: string | null
          org_id: string
          output: Json
          provider: string
          run_id: string | null
          task: string
        }
        Insert: {
          asset_id: string
          confidence?: number | null
          created_at?: string
          ebit_id?: string
          id?: string
          job_id: string
          latency_ms: number
          model: string
          model_version?: string | null
          org_id: string
          output: Json
          provider: string
          run_id?: string | null
          task: string
        }
        Update: {
          asset_id?: string
          confidence?: number | null
          created_at?: string
          ebit_id?: string
          id?: string
          job_id?: string
          latency_ms?: number
          model?: string
          model_version?: string | null
          org_id?: string
          output?: Json
          provider?: string
          run_id?: string | null
          task?: string
        }
        Relationships: [
          {
            foreignKeyName: "interpretations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interpretations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "ai_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interpretations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      measurements: {
        Row: {
          created_at: string
          datastream_id: string
          id: string
          observed_at: string
          org_id: string
          original_metadata: Json
          source: string
          source_asset_id: string | null
          source_row: number | null
          value: number
          verification_status: string
        }
        Insert: {
          created_at?: string
          datastream_id: string
          id?: string
          observed_at: string
          org_id: string
          original_metadata: Json
          source: string
          source_asset_id?: string | null
          source_row?: number | null
          value: number
          verification_status?: string
        }
        Update: {
          created_at?: string
          datastream_id?: string
          id?: string
          observed_at?: string
          org_id?: string
          original_metadata?: Json
          source?: string
          source_asset_id?: string | null
          source_row?: number | null
          value?: number
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "measurements_org_id_datastream_id_fkey"
            columns: ["org_id", "datastream_id"]
            isOneToOne: false
            referencedRelation: "datastreams"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "measurements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurements_source_asset_id_fkey"
            columns: ["source_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      objects: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          domain: string | null
          ebit_id: string
          id: string
          latitude: number | null
          longitude: number | null
          metadata: Json
          name: string
          object_type: string
          org_id: string
          original_metadata: Json
          parent_id: string | null
          rights_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          domain?: string | null
          ebit_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json
          name: string
          object_type: string
          org_id: string
          original_metadata?: Json
          parent_id?: string | null
          rights_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          domain?: string | null
          ebit_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json
          name?: string
          object_type?: string
          org_id?: string
          original_metadata?: Json
          parent_id?: string | null
          rights_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "objects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objects_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objects_rights_id_fkey"
            columns: ["rights_id"]
            isOneToOne: false
            referencedRelation: "rights_records"
            referencedColumns: ["id"]
          },
        ]
      }
      observations: {
        Row: {
          created_at: string
          created_by: string
          domain: string | null
          ebit_id: string
          id: string
          latitude: number | null
          longitude: number | null
          metadata: Json
          object_id: string | null
          observation_type: string
          observed_at: string | null
          org_id: string
          original_metadata: Json
          rights_id: string | null
          source: string | null
          unit: string | null
          updated_at: string
          value_numeric: number | null
          value_text: string | null
          verification_status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          domain?: string | null
          ebit_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json
          object_id?: string | null
          observation_type: string
          observed_at?: string | null
          org_id: string
          original_metadata?: Json
          rights_id?: string | null
          source?: string | null
          unit?: string | null
          updated_at?: string
          value_numeric?: number | null
          value_text?: string | null
          verification_status?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          domain?: string | null
          ebit_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json
          object_id?: string | null
          observation_type?: string
          observed_at?: string | null
          org_id?: string
          original_metadata?: Json
          rights_id?: string | null
          source?: string | null
          unit?: string | null
          updated_at?: string
          value_numeric?: number | null
          value_text?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "observations_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_rights_id_fkey"
            columns: ["rights_id"]
            isOneToOne: false
            referencedRelation: "rights_records"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          ebit_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          ebit_id?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          ebit_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      processing_jobs: {
        Row: {
          adapter: string | null
          adapter_version: string | null
          asset_id: string | null
          attempts: number
          created_at: string
          created_by: string
          error: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          job_type: string
          max_attempts: number
          org_id: string
          result: Json
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          adapter?: string | null
          adapter_version?: string | null
          asset_id?: string | null
          attempts?: number
          created_at?: string
          created_by: string
          error?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key: string
          job_type: string
          max_attempts?: number
          org_id: string
          result?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          adapter?: string | null
          adapter_version?: string | null
          asset_id?: string | null
          attempts?: number
          created_at?: string
          created_by?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          job_type?: string
          max_attempts?: number
          org_id?: string
          result?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      provenance_events: {
        Row: {
          actor_id: string | null
          agent: string
          details: Json
          entity_id: string
          entity_kind: Database["public"]["Enums"]["entity_kind"]
          event_type: string
          id: string
          inputs: Json
          occurred_at: string
          org_id: string
          outputs: Json
          software: string | null
          software_version: string | null
        }
        Insert: {
          actor_id?: string | null
          agent: string
          details?: Json
          entity_id: string
          entity_kind: Database["public"]["Enums"]["entity_kind"]
          event_type: string
          id?: string
          inputs?: Json
          occurred_at?: string
          org_id: string
          outputs?: Json
          software?: string | null
          software_version?: string | null
        }
        Update: {
          actor_id?: string | null
          agent?: string
          details?: Json
          entity_id?: string
          entity_kind?: Database["public"]["Enums"]["entity_kind"]
          event_type?: string
          id?: string
          inputs?: Json
          occurred_at?: string
          org_id?: string
          outputs?: Json
          software?: string | null
          software_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provenance_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      relationships: {
        Row: {
          created_at: string
          created_by: string
          from_id: string
          from_kind: Database["public"]["Enums"]["entity_kind"]
          id: string
          metadata: Json
          org_id: string
          rel_type: string
          to_id: string
          to_kind: Database["public"]["Enums"]["entity_kind"]
        }
        Insert: {
          created_at?: string
          created_by: string
          from_id: string
          from_kind: Database["public"]["Enums"]["entity_kind"]
          id?: string
          metadata?: Json
          org_id: string
          rel_type: string
          to_id: string
          to_kind: Database["public"]["Enums"]["entity_kind"]
        }
        Update: {
          created_at?: string
          created_by?: string
          from_id?: string
          from_kind?: Database["public"]["Enums"]["entity_kind"]
          id?: string
          metadata?: Json
          org_id?: string
          rel_type?: string
          to_id?: string
          to_kind?: Database["public"]["Enums"]["entity_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "relationships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rights_records: {
        Row: {
          ai_training_allowed: boolean
          attribution: string | null
          created_at: string
          created_by: string
          id: string
          license: string | null
          org_id: string
          permitted_uses: string[]
          restrictions: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string | null
          state: Database["public"]["Enums"]["rights_state"]
          updated_at: string
        }
        Insert: {
          ai_training_allowed?: boolean
          attribution?: string | null
          created_at?: string
          created_by: string
          id?: string
          license?: string | null
          org_id: string
          permitted_uses?: string[]
          restrictions?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string | null
          state?: Database["public"]["Enums"]["rights_state"]
          updated_at?: string
        }
        Update: {
          ai_training_allowed?: boolean
          attribution?: string | null
          created_at?: string
          created_by?: string
          id?: string
          license?: string | null
          org_id?: string
          permitted_uses?: string[]
          restrictions?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string | null
          state?: Database["public"]["Enums"]["rights_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rights_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sensor_keys: {
        Row: {
          created_at: string
          created_by: string
          datastream_id: string
          id: string
          key_hash: string
          key_prefix: string
          name: string
          org_id: string
          revoked_at: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          datastream_id: string
          id?: string
          key_hash: string
          key_prefix: string
          name: string
          org_id: string
          revoked_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          datastream_id?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          name?: string
          org_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sensor_keys_org_id_datastream_id_fkey"
            columns: ["org_id", "datastream_id"]
            isOneToOne: false
            referencedRelation: "datastreams"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "sensor_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sensors: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          ebit_id: string
          id: string
          name: string
          object_id: string | null
          org_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          ebit_id?: string
          id?: string
          name: string
          object_id?: string | null
          org_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          ebit_id?: string
          id?: string
          name?: string
          object_id?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sensors_object_id_fkey"
            columns: ["object_id"]
            isOneToOne: false
            referencedRelation: "objects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      taxa: {
        Row: {
          created_at: string
          created_by: string
          family: string | null
          genus: string | null
          id: string
          kingdom: string | null
          org_id: string
          scientific_name: string
          taxon_rank: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          family?: string | null
          genus?: string | null
          id?: string
          kingdom?: string | null
          org_id: string
          scientific_name: string
          taxon_rank?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          family?: string | null
          genus?: string | null
          id?: string
          kingdom?: string | null
          org_id?: string
          scientific_name?: string
          taxon_rank?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "taxa_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_events: {
        Row: {
          created_at: string
          decision: string
          evidence: string
          id: string
          interpretation_id: string
          org_id: string
          reviewer_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          evidence: string
          id?: string
          interpretation_id: string
          org_id: string
          reviewer_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          evidence?: string
          id?: string
          interpretation_id?: string
          org_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_events_interpretation_id_fkey"
            columns: ["interpretation_id"]
            isOneToOne: false
            referencedRelation: "interpretations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_events_org_id_fkey"
            columns: ["org_id"]
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
      api_read: {
        Args: {
          _dataset?: string
          _hash: string
          _page?: number
          _resource: string
        }
        Returns: Json
      }
      complete_ai_job: {
        Args: {
          _confidence: number
          _job: string
          _latency: number
          _model: string
          _output: Json
          _run: string
          _version: string
        }
        Returns: string
      }
      ebit_id: { Args: { prefix: string }; Returns: string }
      export_biodiversity: { Args: { _org: string }; Returns: Json }
      import_biodiversity: {
        Args: { _asset?: string; _org: string; _rows: Json }
        Returns: Json
      }
      import_sensor_measurements: {
        Args: { _asset: string; _rows: Json; _stream: string }
        Returns: Json
      }
      ingest_sensor_key: { Args: { _hash: string; _rows: Json }; Returns: Json }
      is_org_member: {
        Args: { _min?: Database["public"]["Enums"]["org_role"]; _org: string }
        Returns: boolean
      }
      issue_api_key: {
        Args: { _hash: string; _name: string; _org: string; _prefix: string }
        Returns: string
      }
      issue_sensor_key: {
        Args: { _hash: string; _name: string; _prefix: string; _stream: string }
        Returns: string
      }
      register_datastream: {
        Args: {
          _name: string
          _property: string
          _sensor: string
          _unit: string
        }
        Returns: string
      }
      register_sensor: {
        Args: {
          _description: string
          _name: string
          _object?: string
          _org: string
        }
        Returns: string
      }
      review_interpretation: {
        Args: { _decision: string; _evidence: string; _id: string }
        Returns: string
      }
      revoke_api_key: { Args: { _id: string }; Returns: undefined }
      revoke_sensor_key: { Args: { _key: string }; Returns: undefined }
      write_sensor_batch: {
        Args: {
          _actor: string
          _asset: string
          _rows: Json
          _source: string
          _stream: string
        }
        Returns: Json
      }
    }
    Enums: {
      entity_kind:
        | "object"
        | "asset"
        | "observation"
        | "dataset"
        | "interpretation"
        | "annotation"
      org_role: "admin" | "curator" | "contributor" | "viewer"
      rights_state:
        | "unknown"
        | "under_review"
        | "permitted_processing"
        | "permitted_redistribution"
        | "restricted"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      entity_kind: [
        "object",
        "asset",
        "observation",
        "dataset",
        "interpretation",
        "annotation",
      ],
      org_role: ["admin", "curator", "contributor", "viewer"],
      rights_state: [
        "unknown",
        "under_review",
        "permitted_processing",
        "permitted_redistribution",
        "restricted",
      ],
    },
  },
} as const
