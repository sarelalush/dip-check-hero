import { getSupabasePublicUrl, isSupabaseConfigured } from '../integrations/supabase/client';
import { getStripAnalysisConfig } from './stripAnalysisService';

const expoEnv = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>;
const VALID_ANALYSIS_MODES = new Set(['auto', 'mock', 'remote', 'native']);

export interface DeviceEnvironmentDiagnostics {
  analysisFunctionName: string;
  analysisMode: string;
  isAnalysisModeValid: boolean;
  isCloudSupabaseUrl: boolean;
  isLocalSupabaseUrl: boolean;
  isSupabaseConfigured: boolean;
  supabaseUrl?: string;
  warnings: string[];
}

export function isLocalUrl(url?: string) {
  if (!url) return false;
  return /(^|\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(url) || /:54321(\/|$)/.test(url);
}

export function getDeviceEnvironmentDiagnostics(): DeviceEnvironmentDiagnostics {
  const supabaseUrl = getSupabasePublicUrl();
  const config = getStripAnalysisConfig();
  const modeFromEnv = expoEnv.EXPO_PUBLIC_STRIP_ANALYSIS_MODE ?? config.mode;
  const analysisFunctionName = config.remoteFunctionName;
  const warnings: string[] = [];

  if (!supabaseUrl) warnings.push('חסר EXPO_PUBLIC_SUPABASE_URL.');
  if (isLocalUrl(supabaseUrl)) warnings.push('כתובת Supabase מצביעה ל-localhost ולכן לא תעבוד מ-iPhone.');
  if (!VALID_ANALYSIS_MODES.has(modeFromEnv)) warnings.push('מצב ניתוח לא תקין. השתמשו ב-auto, remote, mock או native.');
  if (!analysisFunctionName) warnings.push('חסר שם Edge Function לניתוח סטיק.');

  return {
    analysisFunctionName,
    analysisMode: config.mode,
    isAnalysisModeValid: VALID_ANALYSIS_MODES.has(modeFromEnv),
    isCloudSupabaseUrl: Boolean(supabaseUrl && /^https:\/\/[^/]+\.supabase\.co\/?$/i.test(supabaseUrl)),
    isLocalSupabaseUrl: isLocalUrl(supabaseUrl),
    isSupabaseConfigured,
    supabaseUrl,
    warnings,
  };
}

export function logDeviceEnvironmentWarnings() {
  const diagnostics = getDeviceEnvironmentDiagnostics();
  if (!diagnostics.warnings.length) return;

  console.warn('[device-env] Expo Go readiness warnings', {
    analysisFunctionName: diagnostics.analysisFunctionName,
    analysisMode: diagnostics.analysisMode,
    isCloudSupabaseUrl: diagnostics.isCloudSupabaseUrl,
    isLocalSupabaseUrl: diagnostics.isLocalSupabaseUrl,
    isSupabaseConfigured: diagnostics.isSupabaseConfigured,
    supabaseUrl: diagnostics.supabaseUrl,
    warnings: diagnostics.warnings,
  });
}
