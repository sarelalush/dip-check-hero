import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

// Keep bundling/building safe even before Expo environment variables are configured.
// The app shows a setup screen when these values are missing, instead of crashing at import time.
const fallbackUrl = 'https://example.supabase.co';
const fallbackKey = 'missing-supabase-publishable-key';

export const supabase = createClient(
  supabaseUrl || fallbackUrl,
  supabasePublishableKey || fallbackKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
