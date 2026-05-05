/**
 * Minimal Database type for api-server's Supabase admin client.
 * Covers only the tables and RPCs accessed by api-server routes.
 * The full generated Database type lives in artifacts/kopihub.
 *
 * Must conform to Supabase's GenericSchema structure so that
 * createClient<Database> produces correct .from()/.rpc() types.
 */
export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string;
          name: string | null;
          slug: string | null;
          logo_url: string | null;
          tagline: string | null;
          is_active: boolean | null;
          custom_domain: string | null;
          custom_domain_verified_at: string | null;
          dns_txt_token: string | null;
          last_dns_check_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name?: string | null;
          slug?: string | null;
          logo_url?: string | null;
          tagline?: string | null;
          is_active?: boolean | null;
          custom_domain?: string | null;
          custom_domain_verified_at?: string | null;
          dns_txt_token?: string | null;
          last_dns_check_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          custom_domain_verified_at?: string | null;
          last_dns_check_at?: string | null;
          [key: string]: unknown;
        };
        Relationships: [];
      };
      menu_items: {
        Row: {
          id: string;
          updated_at: string | null;
          shop_id: string;
          is_available: boolean | null;
        };
        Insert: {
          id?: string;
          updated_at?: string | null;
          shop_id: string;
          is_available?: boolean | null;
        };
        Update: {
          updated_at?: string | null;
          shop_id?: string;
          is_available?: boolean | null;
        };
        Relationships: [];
      };
      cron_runs: {
        Row: {
          id: string;
          job_name: string;
          status: string;
          finished_at: string | null;
          duration_ms: number | null;
          result: unknown;
          error_message: string | null;
        };
        Insert: {
          id?: string;
          job_name: string;
          status: string;
          finished_at?: string | null;
          duration_ms?: number | null;
          result?: unknown;
          error_message?: string | null;
        };
        Update: {
          status?: string;
          finished_at?: string | null;
          duration_ms?: number | null;
          result?: unknown;
          error_message?: string | null;
        };
        Relationships: [];
      };
      billing_settings: {
        Row: {
          id: number;
          cron_secret: string | null;
        };
        Insert: {
          id?: number;
          cron_secret?: string | null;
        };
        Update: {
          cron_secret?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      expire_overdue_plans: {
        Args: Record<string, never>;
        Returns: Array<{ shop_id: string }>;
      };
      expire_overdue_invoices: {
        Args: Record<string, never>;
        Returns: unknown[];
      };
      log_system_event: {
        Args: {
          _event_type: string;
          _shop_id: string;
          _payload: Record<string, unknown>;
          _notes: string;
        };
        Returns: void;
      };
      generate_owner_reminders: {
        Args: Record<string, never>;
        Returns: Record<string, number>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
