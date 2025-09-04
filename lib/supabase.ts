import { createClient } from "@supabase/supabase-js";

// Validar variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}
if (!supabaseAnonKey) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

// Cliente público para operaciones del lado del cliente
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente administrativo para operaciones del servidor (solo disponible en servidor)
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// Tipos para la base de datos
export interface Database {
  public: {
    Tables: {
      otp_codes: {
        Row: {
          id: string;
          email: string;
          code_hash: string;
          expires_at: string;
          attempts: number;
          created_at: string;
          used: boolean;
        };
        Insert: {
          id?: string;
          email: string;
          code_hash: string;
          expires_at: string;
          attempts?: number;
          created_at?: string;
          used?: boolean;
        };
        Update: {
          id?: string;
          email?: string;
          code_hash?: string;
          expires_at?: string;
          attempts?: number;
          created_at?: string;
          used?: boolean;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          last_login: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          last_login?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          last_login?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      mls_completed_files: {
        Row: {
          id: string;
          user_id: string | null;
          original_filename: string;
          original_file_size: number | null;
          total_records: number;
          job_name: string | null;
          started_at: string;
          completed_at: string;
          processing_duration_ms: number | null;
          successful_records: number;
          failed_records: number;
          mapbox_requests: number;
          geocodio_requests: number;
          gemini_requests: number;
          cache_hits: number;
          storage_path: string;
          storage_url: string;
          file_size_bytes: number | null;
          batch_config: Record<string, unknown> | null;
          detected_columns: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          original_filename: string;
          original_file_size?: number | null;
          total_records: number;
          job_name?: string | null;
          started_at: string;
          completed_at: string;
          processing_duration_ms?: number | null;
          successful_records?: number;
          failed_records?: number;
          mapbox_requests?: number;
          geocodio_requests?: number;
          gemini_requests?: number;
          cache_hits?: number;
          storage_path: string;
          storage_url?: string;
          file_size_bytes?: number | null;
          batch_config?: Record<string, unknown> | null;
          detected_columns?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          original_filename?: string;
          original_file_size?: number | null;
          total_records?: number;
          job_name?: string | null;
          started_at?: string;
          completed_at?: string;
          processing_duration_ms?: number | null;
          successful_records?: number;
          failed_records?: number;
          mapbox_requests?: number;
          geocodio_requests?: number;
          gemini_requests?: number;
          cache_hits?: number;
          storage_path?: string;
          storage_url?: string;
          file_size_bytes?: number | null;
          batch_config?: Record<string, unknown> | null;
          detected_columns?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}
