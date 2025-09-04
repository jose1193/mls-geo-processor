import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Cliente público para operaciones del lado del cliente
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente administrativo para operaciones del servidor
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

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
    };
  };
}
