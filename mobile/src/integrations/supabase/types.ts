export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type RowOf<T> = T;
type InsertOf<T> = Partial<T> & Record<string, unknown>;
type UpdateOf<T> = Partial<T>;
type Table<T> = {
  Row: RowOf<T>;
  Insert: InsertOf<T>;
  Update: UpdateOf<T>;
  Relationships: [];
};

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      profiles: Table<{
        avatar_url: string | null;
        created_at: string;
        email: string | null;
        full_name: string | null;
        id: string;
        locale: string;
        units: string;
        updated_at: string;
      }>;
      accounts: Table<{
        created_at: string;
        id: string;
        name: string | null;
        owner_user_id: string;
        status: string;
        updated_at: string;
      }>;
      account_members: Table<{
        account_id: string;
        created_at: string;
        id: string;
        role: string;
        user_id: string;
      }>;
      plans: Table<{
        base_price_cents: number;
        billing_interval: string;
        created_at: string;
        currency: string;
        id: string;
        included_pools: number;
        included_scans_per_month: number;
        is_active: boolean;
        metadata: Json;
        name: string;
        updated_at: string;
      }>;
      plan_addons: Table<{
        addon_type: string;
        created_at: string;
        currency: string;
        id: string;
        is_active: boolean;
        metadata: Json;
        name: string;
        price_cents: number;
        quantity_unit: number;
        updated_at: string;
      }>;
      subscriptions: Table<{
        account_id: string;
        cancel_at_period_end: boolean;
        created_at: string;
        current_period_end: string | null;
        current_period_start: string | null;
        id: string;
        plan_id: string | null;
        provider: string | null;
        provider_customer_id: string | null;
        provider_subscription_id: string | null;
        status: string;
        trial_ends_at: string | null;
        updated_at: string;
      }>;
      subscription_addons: Table<{
        account_id: string;
        addon_id: string | null;
        created_at: string;
        current_period_end: string | null;
        current_period_start: string | null;
        id: string;
        quantity: number;
        status: string;
        subscription_id: string;
        updated_at: string;
      }>;
      account_entitlements: Table<{
        account_id: string;
        created_at: string;
        extra_pools: number;
        extra_scan_packs: number;
        id: string;
        included_pools: number;
        included_scans: number;
        period_end: string;
        period_start: string;
        total_pool_limit: number;
        total_scan_limit: number;
        updated_at: string;
      }>;
      pools: Table<{
        account_id: string;
        created_at: string;
        dimensions: Json;
        id: string;
        image_path: string | null;
        image_url: string | null;
        is_archived: boolean;
        name: string;
        notes: string | null;
        owner_user_id: string | null;
        pool_type: string | null;
        sanitizer_type: string | null;
        shape: string | null;
        updated_at: string;
        volume_liters: number | null;
      }>;
      strip_brands: Table<{
        color_chart: Json;
        created_at: string;
        display_name: string;
        id: string;
        is_enabled: boolean;
        manufacturer: string | null;
        pad_count: number;
        parameter_order: Json;
        updated_at: string;
      }>;
      tests: Table<{
        account_id: string;
        analyzed_at: string | null;
        analysis_status: string;
        confidence: number | null;
        created_at: string;
        error_message: string | null;
        id: string;
        image_path: string | null;
        image_url: string | null;
        is_billable: boolean;
        low_confidence: boolean;
        model: string | null;
        overall_status: string | null;
        pool_id: string | null;
        provider: string | null;
        raw_result: Json;
        recommendation: string | null;
        source: string | null;
        strip_brand_id: string | null;
        updated_at: string;
        user_id: string | null;
      }>;
      test_readings: Table<{
        account_id: string;
        confidence: number | null;
        created_at: string;
        id: string;
        label: string | null;
        max_value: number | null;
        min_value: number | null;
        parameter_key: string;
        raw: Json;
        status: string | null;
        test_id: string;
        unit: string | null;
        value: number | null;
      }>;
      test_recommendations: Table<{
        account_id: string;
        action_type: string | null;
        amount: number | null;
        created_at: string;
        description: string | null;
        id: string;
        parameter_key: string | null;
        priority: number;
        product_type: string | null;
        raw: Json;
        safety_note: string | null;
        test_id: string;
        title: string | null;
        unit: string | null;
      }>;
      usage_periods: Table<{
        account_id: string;
        created_at: string;
        id: string;
        period_end: string;
        period_start: string;
        pools_active_count: number;
        pools_limit: number;
        scans_billable: number;
        scans_limit: number;
        scans_used: number;
        updated_at: string;
      }>;
      usage_events: Table<{
        account_id: string;
        billable: boolean;
        created_at: string;
        event_type: string;
        id: string;
        metadata: Json;
        period_start: string;
        quantity: number;
        test_id: string | null;
        user_id: string | null;
      }>;
      billing_events: Table<{
        account_id: string | null;
        created_at: string;
        error_message: string | null;
        event_type: string | null;
        id: string;
        payload: Json;
        processed: boolean;
        provider: string;
        provider_event_id: string | null;
      }>;
      scan_image_metadata: Table<{
        account_id: string;
        bucket: string;
        created_at: string;
        height: number | null;
        id: string;
        mime_type: string | null;
        path: string;
        size_bytes: number | null;
        test_id: string;
        width: number | null;
      }>;
      strip_brand_requests: Table<{
        account_id: string | null;
        brand_name: string;
        contact_email: string | null;
        created_at: string;
        id: string;
        notes: string | null;
        status: string;
        user_id: string | null;
      }>;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_create_pool: {
        Args: { p_account_id: string };
        Returns: boolean;
      };
      can_create_scan: {
        Args: { p_account_id: string };
        Returns: boolean;
      };
      ensure_default_account: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      get_current_account_entitlements: {
        Args: { p_account_id: string };
        Returns: Database['public']['Tables']['account_entitlements']['Row'];
      };
      refresh_usage_period: {
        Args: { p_account_id: string };
        Returns: Database['public']['Tables']['usage_periods']['Row'];
      };
      register_scan_usage: {
        Args: { p_account_id: string; p_test_id: string; p_user_id: string };
        Returns: Database['public']['Tables']['usage_periods']['Row'];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
