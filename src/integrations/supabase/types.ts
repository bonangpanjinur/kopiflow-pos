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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendances: {
        Row: {
          business_date: string
          clock_in: string
          clock_out: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          note: string | null
          outlet_id: string
          shop_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_date?: string
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          note?: string | null
          outlet_id: string
          shop_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_date?: string
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          note?: string | null
          outlet_id?: string
          shop_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      backup_schedules: {
        Row: {
          created_at: string
          frequency: string
          last_run_at: string | null
          next_run_at: string
          retention_days: number
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          frequency?: string
          last_run_at?: string | null
          next_run_at?: string
          retention_days?: number
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          frequency?: string
          last_run_at?: string | null
          next_run_at?: string
          retention_days?: number
          shop_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      billing_settings: {
        Row: {
          account_name: string | null
          account_no: string | null
          bank_name: string | null
          cron_secret: string | null
          id: number
          instructions: string | null
          qris_image_url: string | null
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_no?: string | null
          bank_name?: string | null
          cron_secret?: string | null
          id?: number
          instructions?: string | null
          qris_image_url?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_no?: string | null
          bank_name?: string | null
          cron_secret?: string | null
          id?: number
          instructions?: string | null
          qris_image_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      branding_audit: {
        Row: {
          changed_by: string
          created_at: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          shop_id: string
        }
        Insert: {
          changed_by: string
          created_at?: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          shop_id: string
        }
        Update: {
          changed_by?: string
          created_at?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          shop_id?: string
        }
        Relationships: []
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          customer_id: string
          error: string | null
          id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          customer_id: string
          error?: string | null
          id?: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          customer_id?: string
          error?: string | null
          id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          order_id: string | null
          shift_id: string
          type: Database["public"]["Enums"]["cash_movement_type"]
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          shift_id: string
          type: Database["public"]["Enums"]["cash_movement_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          shift_id?: string
          type?: Database["public"]["Enums"]["cash_movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "cash_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_shifts: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_cash: number | null
          created_at: string
          expected_cash: number | null
          id: string
          note: string | null
          opened_at: string
          opened_by: string
          opening_cash: number
          outlet_id: string
          shop_id: string
          status: Database["public"]["Enums"]["shift_status"]
          updated_at: string
          variance: number | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_cash?: number | null
          created_at?: string
          expected_cash?: number | null
          id?: string
          note?: string | null
          opened_at?: string
          opened_by: string
          opening_cash?: number
          outlet_id: string
          shop_id: string
          status?: Database["public"]["Enums"]["shift_status"]
          updated_at?: string
          variance?: number | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_cash?: number | null
          created_at?: string
          expected_cash?: number | null
          id?: string
          note?: string | null
          opened_at?: string
          opened_by?: string
          opening_cash?: number
          outlet_id?: string
          shop_id?: string
          status?: Database["public"]["Enums"]["shift_status"]
          updated_at?: string
          variance?: number | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          shop_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          shop_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          shop_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "coffee_shops"
            referencedColumns: ["id"]
          },
        ]
      }
      coffee_shops: {
        Row: {
          active_theme_key: string
          address: string | null
          created_at: string
          currency: string
          custom_domain: string | null
          custom_domain_verified_at: string | null
          custom_domain_verify_token: string | null
          description: string | null
          email: string | null
          id: string
          instagram: string | null
          is_active: boolean
          last_dns_check_at: string | null
          logo_url: string | null
          name: string
          open_hours: Json
          owner_id: string
          payment_methods_enabled: string[]
          phone: string | null
          plan: string
          plan_expires_at: string | null
          plan_started_at: string | null
          prep_minutes: number
          qris_image_url: string | null
          qris_merchant_name: string | null
          service_charge_percent: number
          slug: string
          suspended_at: string | null
          suspended_reason: string | null
          tagline: string | null
          tax_inclusive: boolean
          tax_percent: number
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          active_theme_key?: string
          address?: string | null
          created_at?: string
          currency?: string
          custom_domain?: string | null
          custom_domain_verified_at?: string | null
          custom_domain_verify_token?: string | null
          description?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean
          last_dns_check_at?: string | null
          logo_url?: string | null
          name: string
          open_hours?: Json
          owner_id: string
          payment_methods_enabled?: string[]
          phone?: string | null
          plan?: string
          plan_expires_at?: string | null
          plan_started_at?: string | null
          prep_minutes?: number
          qris_image_url?: string | null
          qris_merchant_name?: string | null
          service_charge_percent?: number
          slug: string
          suspended_at?: string | null
          suspended_reason?: string | null
          tagline?: string | null
          tax_inclusive?: boolean
          tax_percent?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          active_theme_key?: string
          address?: string | null
          created_at?: string
          currency?: string
          custom_domain?: string | null
          custom_domain_verified_at?: string | null
          custom_domain_verify_token?: string | null
          description?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          is_active?: boolean
          last_dns_check_at?: string | null
          logo_url?: string | null
          name?: string
          open_hours?: Json
          owner_id?: string
          payment_methods_enabled?: string[]
          phone?: string | null
          plan?: string
          plan_expires_at?: string | null
          plan_started_at?: string | null
          prep_minutes?: number
          qris_image_url?: string | null
          qris_merchant_name?: string | null
          service_charge_percent?: number
          slug?: string
          suspended_at?: string | null
          suspended_reason?: string | null
          tagline?: string | null
          tax_inclusive?: boolean
          tax_percent?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      couriers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          note: string | null
          phone: string
          plate_number: string | null
          shop_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          note?: string | null
          phone: string
          plate_number?: string | null
          shop_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          note?: string | null
          phone?: string
          plate_number?: string | null
          shop_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      cron_runs: {
        Row: {
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          job_name: string
          result: Json
          started_at: string
          status: string
        }
        Insert: {
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_name: string
          result?: Json
          started_at?: string
          status?: string
        }
        Update: {
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_name?: string
          result?: Json
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          address_line: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          phone: string
          recipient_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          phone: string
          recipient_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          phone?: string
          recipient_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_favorites: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string
          shop_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id: string
          shop_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string
          shop_id?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_segments: {
        Row: {
          color: string | null
          created_at: string
          criteria: Json
          description: string | null
          id: string
          is_auto: boolean
          name: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          criteria?: Json
          description?: string | null
          id?: string
          is_auto?: boolean
          name: string
          shop_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          criteria?: Json
          description?: string | null
          id?: string
          is_auto?: boolean
          name?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_settings: {
        Row: {
          base_fee: number
          close_time: string | null
          created_at: string
          delivery_enabled: boolean
          free_above: number | null
          min_order: number
          mode: Database["public"]["Enums"]["delivery_mode"]
          notes: string | null
          open_time: string | null
          pickup_enabled: boolean
          shop_id: string
          updated_at: string
        }
        Insert: {
          base_fee?: number
          close_time?: string | null
          created_at?: string
          delivery_enabled?: boolean
          free_above?: number | null
          min_order?: number
          mode?: Database["public"]["Enums"]["delivery_mode"]
          notes?: string | null
          open_time?: string | null
          pickup_enabled?: boolean
          shop_id: string
          updated_at?: string
        }
        Update: {
          base_fee?: number
          close_time?: string | null
          created_at?: string
          delivery_enabled?: boolean
          free_above?: number | null
          min_order?: number
          mode?: Database["public"]["Enums"]["delivery_mode"]
          notes?: string | null
          open_time?: string | null
          pickup_enabled?: boolean
          shop_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          area_note: string | null
          created_at: string
          fee: number
          id: string
          is_active: boolean
          name: string
          shop_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          area_note?: string | null
          created_at?: string
          fee?: number
          id?: string
          is_active?: boolean
          name: string
          shop_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          area_note?: string | null
          created_at?: string
          fee?: number
          id?: string
          is_active?: boolean
          name?: string
          shop_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      domain_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          new_domain: string | null
          notes: string | null
          old_domain: string | null
          shop_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_domain?: string | null
          notes?: string | null
          old_domain?: string | null
          shop_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_domain?: string | null
          notes?: string | null
          old_domain?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_audit_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "coffee_shops"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_blacklist: {
        Row: {
          created_at: string
          domain: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          reason?: string | null
        }
        Relationships: []
      }
      domain_verify_attempts: {
        Row: {
          actor_id: string | null
          created_at: string
          domain: string | null
          id: string
          result: string | null
          shop_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          result?: string | null
          shop_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          result?: string | null
          shop_id?: string
        }
        Relationships: []
      }
      features: {
        Row: {
          category: string
          created_at: string
          description: string | null
          is_active: boolean
          key: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          key: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          key?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          category: string | null
          cost_per_unit: number
          created_at: string
          current_stock: number
          default_supplier_id: string | null
          id: string
          is_active: boolean
          min_stock: number
          name: string
          shop_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          cost_per_unit?: number
          created_at?: string
          current_stock?: number
          default_supplier_id?: string | null
          id?: string
          is_active?: boolean
          min_stock?: number
          name: string
          shop_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          cost_per_unit?: number
          created_at?: string
          current_stock?: number
          default_supplier_id?: string | null
          id?: string
          is_active?: boolean
          min_stock?: number
          name?: string
          shop_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_default_supplier_id_fkey"
            columns: ["default_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          order_id: string | null
          reason: string
          shop_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          order_id?: string | null
          reason: string
          shop_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          order_id?: string | null
          reason?: string
          shop_id?: string
          user_id?: string
        }
        Relationships: []
      }
      loyalty_points: {
        Row: {
          balance: number
          id: string
          shop_id: string
          total_earned: number
          total_redeemed: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          id?: string
          shop_id: string
          total_earned?: number
          total_redeemed?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          id?: string
          shop_id?: string
          total_earned?: number
          total_redeemed?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loyalty_settings: {
        Row: {
          created_at: string
          is_active: boolean
          max_redeem_percent: number
          min_redeem_points: number
          point_value: number
          rupiah_per_point: number
          shop_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          max_redeem_percent?: number
          min_redeem_points?: number
          point_value?: number
          rupiah_per_point?: number
          shop_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          max_redeem_percent?: number
          min_redeem_points?: number
          point_value?: number
          rupiah_per_point?: number
          shop_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          audience_count: number
          audience_segment: string | null
          channel: string
          created_at: string
          created_by: string
          id: string
          name: string
          scheduled_at: string | null
          sent_at: string | null
          shop_id: string
          status: string
          template: string
          updated_at: string
        }
        Insert: {
          audience_count?: number
          audience_segment?: string | null
          channel?: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          scheduled_at?: string | null
          sent_at?: string | null
          shop_id: string
          status?: string
          template?: string
          updated_at?: string
        }
        Update: {
          audience_count?: number
          audience_segment?: string | null
          channel?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          scheduled_at?: string | null
          sent_at?: string | null
          shop_id?: string
          status?: string
          template?: string
          updated_at?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          price: number
          recipe_yield: number
          shop_id: string
          sort_order: number
          track_stock: boolean
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          price?: number
          recipe_yield?: number
          shop_id: string
          sort_order?: number
          track_stock?: boolean
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          price?: number
          recipe_yield?: number
          shop_id?: string
          sort_order?: number
          track_stock?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "coffee_shops"
            referencedColumns: ["id"]
          },
        ]
      }
      open_bills: {
        Row: {
          created_at: string
          created_by: string
          id: string
          items: Json
          label: string
          note: string | null
          outlet_id: string
          shop_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          items?: Json
          label?: string
          note?: string | null
          outlet_id: string
          shop_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          items?: Json
          label?: string
          note?: string | null
          outlet_id?: string
          shop_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "open_bills_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_bills_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "coffee_shops"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string | null
          name: string
          note: string | null
          order_id: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id?: string | null
          name: string
          note?: string | null
          order_id: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string | null
          name?: string
          note?: string | null
          order_id?: string
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_hpp_view"
            referencedColumns: ["menu_item_id"]
          },
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_tendered: number | null
          business_date: string
          cashier_id: string | null
          change_due: number
          channel: Database["public"]["Enums"]["order_channel"]
          courier_id: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          customer_user_id: string | null
          delivery_address: string | null
          delivery_fee: number
          delivery_zone_id: string | null
          discount: number
          fulfillment: Database["public"]["Enums"]["fulfillment_type"]
          id: string
          note: string | null
          order_no: string
          outlet_id: string
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_proof_url: string | null
          payment_split: Json
          payment_status: Database["public"]["Enums"]["payment_status"]
          points_earned: number
          points_redeemed: number
          promo_code: string | null
          promo_id: string | null
          scheduled_for: string | null
          service_charge: number
          shift_id: string | null
          shop_id: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax: number
          tip_amount: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_tendered?: number | null
          business_date?: string
          cashier_id?: string | null
          change_due?: number
          channel?: Database["public"]["Enums"]["order_channel"]
          courier_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          customer_user_id?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_zone_id?: string | null
          discount?: number
          fulfillment?: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          note?: string | null
          order_no: string
          outlet_id: string
          paid_at?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_proof_url?: string | null
          payment_split?: Json
          payment_status?: Database["public"]["Enums"]["payment_status"]
          points_earned?: number
          points_redeemed?: number
          promo_code?: string | null
          promo_id?: string | null
          scheduled_for?: string | null
          service_charge?: number
          shift_id?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax?: number
          tip_amount?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_tendered?: number | null
          business_date?: string
          cashier_id?: string | null
          change_due?: number
          channel?: Database["public"]["Enums"]["order_channel"]
          courier_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          customer_user_id?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_zone_id?: string | null
          discount?: number
          fulfillment?: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          note?: string | null
          order_no?: string
          outlet_id?: string
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_proof_url?: string | null
          payment_split?: Json
          payment_status?: Database["public"]["Enums"]["payment_status"]
          points_earned?: number
          points_redeemed?: number
          promo_code?: string | null
          promo_id?: string | null
          scheduled_for?: string | null
          service_charge?: number
          shift_id?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax?: number
          tip_amount?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "coffee_shops"
            referencedColumns: ["id"]
          },
        ]
      }
      outlets: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          shop_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          shop_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          shop_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outlets_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "coffee_shops"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_notifications: {
        Row: {
          body: string | null
          created_at: string
          dedupe_key: string | null
          dismissed_at: string | null
          id: string
          link: string | null
          read_at: string | null
          severity: string
          shop_id: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          dismissed_at?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          severity?: string
          shop_id: string
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          dismissed_at?: string | null
          id?: string
          link?: string | null
          read_at?: string | null
          severity?: string
          shop_id?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      plan_features: {
        Row: {
          created_at: string
          feature_key: string
          limit_value: number | null
          meta: Json
          plan_id: string
          requires_min_months: number
        }
        Insert: {
          created_at?: string
          feature_key: string
          limit_value?: number | null
          meta?: Json
          plan_id: string
          requires_min_months?: number
        }
        Update: {
          created_at?: string
          feature_key?: string
          limit_value?: number | null
          meta?: Json
          plan_id?: string
          requires_min_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_invoices: {
        Row: {
          amount_idr: number
          created_at: string
          id: string
          invoice_no: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_proof_url: string | null
          plan_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          shop_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_idr: number
          created_at?: string
          id?: string
          invoice_no: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          plan_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_idr?: number
          created_at?: string
          id?: string
          invoice_no?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          plan_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_invoices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_invoices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "coffee_shops"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_themes: {
        Row: {
          created_at: string
          plan_id: string
          requires_min_months: number
          theme_key: string
        }
        Insert: {
          created_at?: string
          plan_id: string
          requires_min_months?: number
          theme_key: string
        }
        Update: {
          created_at?: string
          plan_id?: string
          requires_min_months?: number
          theme_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_themes_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_themes_theme_key_fkey"
            columns: ["theme_key"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["key"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          created_at: string
          duration_days: number
          features: Json
          id: string
          is_active: boolean
          name: string
          price_idr: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          duration_days: number
          features?: Json
          id?: string
          is_active?: boolean
          name: string
          price_idr: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          duration_days?: number
          features?: Json
          id?: string
          is_active?: boolean
          name?: string
          price_idr?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string
          promo_id: string
          shop_id: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          order_id: string
          promo_id: string
          shop_id: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string
          promo_id?: string
          shop_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      promos: {
        Row: {
          channel: Database["public"]["Enums"]["promo_channel"]
          code: string
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_discount: number | null
          min_order: number
          shop_id: string
          starts_at: string | null
          type: Database["public"]["Enums"]["promo_type"]
          updated_at: string
          usage_count: number
          usage_limit: number | null
          value: number
        }
        Insert: {
          channel?: Database["public"]["Enums"]["promo_channel"]
          code: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_order?: number
          shop_id: string
          starts_at?: string | null
          type?: Database["public"]["Enums"]["promo_type"]
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          value?: number
        }
        Update: {
          channel?: Database["public"]["Enums"]["promo_channel"]
          code?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_order?: number
          shop_id?: string
          starts_at?: string | null
          type?: Database["public"]["Enums"]["promo_type"]
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          value?: number
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          note: string | null
          po_id: string
          quantity: number
          received_qty: number
          subtotal: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          note?: string | null
          po_id: string
          quantity?: number
          received_qty?: number
          subtotal?: number
          unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          note?: string | null
          po_id?: string
          quantity?: number
          received_qty?: number
          subtotal?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          expected_date: string | null
          id: string
          note: string | null
          order_date: string
          po_no: string
          received_date: string | null
          shop_id: string
          status: Database["public"]["Enums"]["po_status"]
          subtotal: number
          supplier_id: string | null
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          note?: string | null
          order_date?: string
          po_no: string
          received_date?: string | null
          shop_id: string
          status?: Database["public"]["Enums"]["po_status"]
          subtotal?: number
          supplier_id?: string | null
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_date?: string | null
          id?: string
          note?: string | null
          order_date?: string
          po_no?: string
          received_date?: string | null
          shop_id?: string
          status?: Database["public"]["Enums"]["po_status"]
          subtotal?: number
          supplier_id?: string | null
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          menu_item_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          menu_item_id: string
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          menu_item_id?: string
          quantity?: number
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          order_id: string
          outlet_id: string
          reason: string | null
          refund_method: string
          shop_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          order_id: string
          outlet_id: string
          reason?: string | null
          refund_method?: string
          shop_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          order_id?: string
          outlet_id?: string
          reason?: string | null
          refund_method?: string
          shop_id?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          note: string | null
          outlet_id: string
          shop_id: string
          start_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          note?: string | null
          outlet_id: string
          shop_id: string
          start_time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          note?: string | null
          outlet_id?: string
          shop_id?: string
          start_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shop_backups: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          file_path: string | null
          id: string
          includes: Json
          requested_by: string
          shop_id: string
          size_bytes: number | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_path?: string | null
          id?: string
          includes?: Json
          requested_by: string
          shop_id: string
          size_bytes?: number | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_path?: string | null
          id?: string
          includes?: Json
          requested_by?: string
          shop_id?: string
          size_bytes?: number | null
          status?: string
        }
        Relationships: []
      }
      shop_customers: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          first_order_at: string | null
          id: string
          last_order_at: string | null
          notes: string | null
          phone: string | null
          segment: string | null
          shop_id: string
          tags: string[]
          total_orders: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_order_at?: string | null
          id?: string
          last_order_at?: string | null
          notes?: string | null
          phone?: string | null
          segment?: string | null
          shop_id: string
          tags?: string[]
          total_orders?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_order_at?: string | null
          id?: string
          last_order_at?: string | null
          notes?: string | null
          phone?: string | null
          segment?: string | null
          shop_id?: string
          tags?: string[]
          total_orders?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          outlet_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          shop_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          outlet_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          shop_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          outlet_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          shop_id?: string
          token?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          ingredient_id: string
          note: string | null
          order_id: string | null
          quantity: number
          shop_id: string
          type: Database["public"]["Enums"]["stock_movement_type"]
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          ingredient_id: string
          note?: string | null
          order_id?: string | null
          quantity: number
          shop_id: string
          type: Database["public"]["Enums"]["stock_movement_type"]
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          ingredient_id?: string
          note?: string | null
          order_id?: string | null
          quantity?: number
          shop_id?: string
          type?: Database["public"]["Enums"]["stock_movement_type"]
          unit_cost?: number | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          lead_time_days: number
          name: string
          note: string | null
          payment_terms: string | null
          phone: string | null
          shop_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          lead_time_days?: number
          name: string
          note?: string | null
          payment_terms?: string | null
          phone?: string | null
          shop_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          lead_time_days?: number
          name?: string
          note?: string | null
          payment_terms?: string | null
          phone?: string | null
          shop_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_audit: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          notes: string | null
          payload: Json
          shop_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          notes?: string | null
          payload?: Json
          shop_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          notes?: string | null
          payload?: Json
          shop_id?: string | null
        }
        Relationships: []
      }
      themes: {
        Row: {
          component_id: string
          created_at: string
          description: string | null
          is_active: boolean
          key: string
          name: string
          preview_image_url: string | null
          sort_order: number
          tier_hint: string | null
          updated_at: string
        }
        Insert: {
          component_id: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          key: string
          name: string
          preview_image_url?: string | null
          sort_order?: number
          tier_hint?: string | null
          updated_at?: string
        }
        Update: {
          component_id?: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          key?: string
          name?: string
          preview_image_url?: string | null
          sort_order?: number
          tier_hint?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          active_carts: Json
          default_outlet_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_carts?: Json
          default_outlet_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_carts?: Json
          default_outlet_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_default_outlet_id_fkey"
            columns: ["default_outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          outlet_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          shop_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          outlet_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          shop_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          outlet_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          shop_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      menu_hpp_view: {
        Row: {
          hpp: number | null
          last_updated: string | null
          margin: number | null
          margin_percent: number | null
          menu_item_id: string | null
          name: string | null
          price: number | null
          recipe_count: number | null
          shop_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "coffee_shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_staff_invitation: { Args: { _token: string }; Returns: Json }
      admin_dashboard_stats: { Args: never; Returns: Json }
      admin_remove_plan_feature: {
        Args: { _feature_key: string; _plan_id: string }
        Returns: undefined
      }
      admin_remove_plan_theme: {
        Args: { _plan_id: string; _theme_key: string }
        Returns: undefined
      }
      admin_set_shop_plan: {
        Args: { _expires_at: string; _plan: string; _shop_id: string }
        Returns: undefined
      }
      admin_shop_detail: { Args: { _shop_id: string }; Returns: Json }
      admin_suspend_shop: {
        Args: { _reason: string; _shop_id: string }
        Returns: undefined
      }
      admin_unsuspend_shop: { Args: { _shop_id: string }; Returns: undefined }
      admin_upsert_feature: {
        Args: {
          _category: string
          _description: string
          _is_active: boolean
          _key: string
          _name: string
          _sort_order: number
        }
        Returns: undefined
      }
      admin_upsert_plan_feature: {
        Args: {
          _feature_key: string
          _limit_value: number
          _meta: Json
          _plan_id: string
          _requires_min_months: number
        }
        Returns: undefined
      }
      admin_upsert_plan_theme: {
        Args: {
          _plan_id: string
          _requires_min_months: number
          _theme_key: string
        }
        Returns: undefined
      }
      admin_upsert_theme: {
        Args: {
          _component_id: string
          _description: string
          _is_active: boolean
          _key: string
          _name: string
          _preview_image_url: string
          _sort_order: number
          _tier_hint: string
        }
        Returns: undefined
      }
      apply_loyalty_post_order: {
        Args: {
          _earned: number
          _order_id: string
          _redeemed: number
          _shop_id: string
          _user_id: string
        }
        Returns: undefined
      }
      approve_plan_invoice: { Args: { _invoice_id: string }; Returns: Json }
      assign_courier_atomic: {
        Args: { _courier_id: string; _order_id: string }
        Returns: Json
      }
      auto_unverify_domain: {
        Args: { _reason: string; _shop_id: string }
        Returns: undefined
      }
      close_shift: {
        Args: { _closing_cash: number; _note?: string; _shift_id: string }
        Returns: Json
      }
      expire_overdue_plans: {
        Args: never
        Returns: {
          shop_id: string
        }[]
      }
      expire_stale_pending_invoices: { Args: never; Returns: number }
      generate_owner_reminders: { Args: never; Returns: Json }
      get_billing_settings_public: {
        Args: never
        Returns: {
          account_name: string
          account_no: string
          bank_name: string
          instructions: string
          qris_image_url: string
        }[]
      }
      get_order_tracking: {
        Args: { _order_id: string }
        Returns: {
          channel: Database["public"]["Enums"]["order_channel"]
          courier_name: string
          courier_phone: string
          courier_plate: string
          created_at: string
          customer_name: string
          delivery_address: string
          delivery_fee: number
          fulfillment: Database["public"]["Enums"]["fulfillment_type"]
          id: string
          order_no: string
          shop_name: string
          shop_slug: string
          status: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at: string
        }[]
      }
      get_shop_entitlements: { Args: { _shop_id: string }; Returns: Json }
      has_outlet_access: {
        Args: { _outlet_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_shop_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _shop_id: string
          _user_id: string
        }
        Returns: boolean
      }
      increment_promo_usage: { Args: { _promo_id: string }; Returns: undefined }
      list_available_delivery_orders: {
        Args: { _courier_id: string }
        Returns: {
          created_at: string
          customer_name: string
          customer_phone: string
          delivery_address: string
          delivery_fee: number
          id: string
          note: string
          order_no: string
          status: Database["public"]["Enums"]["order_status"]
          total: number
        }[]
      }
      log_system_event: {
        Args: {
          _event_type: string
          _notes?: string
          _payload?: Json
          _shop_id: string
        }
        Returns: string
      }
      next_order_no: { Args: { _outlet_id: string }; Returns: string }
      open_shift: {
        Args: { _opening_cash: number; _outlet_id: string }
        Returns: string
      }
      receive_purchase_order: { Args: { _po_id: string }; Returns: undefined }
      refund_order: {
        Args: {
          _amount: number
          _method?: string
          _order_id: string
          _reason?: string
        }
        Returns: string
      }
      reject_plan_invoice: {
        Args: { _invoice_id: string; _reason?: string }
        Returns: undefined
      }
      set_custom_domain_verified: {
        Args: { _shop_id: string; _verified: boolean }
        Returns: undefined
      }
      set_shop_theme: {
        Args: { _shop_id: string; _theme_key: string }
        Returns: undefined
      }
      validate_promo: {
        Args: {
          _channel: string
          _code: string
          _shop_id: string
          _subtotal: number
        }
        Returns: {
          code: string
          discount: number
          error: string
          promo_id: string
        }[]
      }
      void_order: {
        Args: { _order_id: string; _reason?: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "owner"
        | "cashier"
        | "barista"
        | "customer"
        | "manager"
        | "courier"
      cash_movement_type:
        | "in"
        | "out"
        | "sale"
        | "refund"
        | "opening"
        | "closing"
      delivery_mode: "flat" | "zone"
      fulfillment_type: "dine_in" | "pickup" | "delivery"
      order_channel: "pos" | "online"
      order_status:
        | "completed"
        | "voided"
        | "refunded"
        | "pending"
        | "preparing"
        | "ready"
        | "delivering"
        | "cancelled"
      payment_method: "cash" | "qris"
      payment_status: "unpaid" | "awaiting_verification" | "paid" | "refunded"
      po_status: "draft" | "ordered" | "received" | "cancelled"
      promo_channel: "pos" | "online" | "all"
      promo_type: "percent" | "nominal"
      shift_status: "open" | "closed"
      stock_movement_type: "purchase" | "adjustment" | "sale" | "waste"
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
      app_role: [
        "super_admin",
        "owner",
        "cashier",
        "barista",
        "customer",
        "manager",
        "courier",
      ],
      cash_movement_type: ["in", "out", "sale", "refund", "opening", "closing"],
      delivery_mode: ["flat", "zone"],
      fulfillment_type: ["dine_in", "pickup", "delivery"],
      order_channel: ["pos", "online"],
      order_status: [
        "completed",
        "voided",
        "refunded",
        "pending",
        "preparing",
        "ready",
        "delivering",
        "cancelled",
      ],
      payment_method: ["cash", "qris"],
      payment_status: ["unpaid", "awaiting_verification", "paid", "refunded"],
      po_status: ["draft", "ordered", "received", "cancelled"],
      promo_channel: ["pos", "online", "all"],
      promo_type: ["percent", "nominal"],
      shift_status: ["open", "closed"],
      stock_movement_type: ["purchase", "adjustment", "sale", "waste"],
    },
  },
} as const
