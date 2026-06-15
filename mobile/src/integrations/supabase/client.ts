import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const expoEnv = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>;

const SUPABASE_URL = expoEnv.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  expoEnv.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? expoEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

export const supabaseConfigMessage =
  'חסרה הגדרת Supabase. יש להגדיר EXPO_PUBLIC_SUPABASE_URL ו-EXPO_PUBLIC_SUPABASE_ANON_KEY.';

export const supabase = isSupabaseConfigured
  ? createClient<Database>(SUPABASE_URL as string, SUPABASE_PUBLISHABLE_KEY as string, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error(supabaseConfigMessage);
  }

  return supabase;
}
