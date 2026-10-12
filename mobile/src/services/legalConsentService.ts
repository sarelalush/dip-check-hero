import documents from '../config/legalDocuments.json';
import { getSupabaseClient } from '../integrations/supabase/client';

export { documents as legalDocuments };
export type ConsentFailureKind = 'service_update' | 'verification';
export class ConsentVerificationError extends Error {
  constructor(message: string, readonly kind: ConsentFailureKind = 'verification') {
    super(message);
    this.name = 'ConsentVerificationError';
  }
}
function rpcFailure(error: { code?: string }, message: string) {
  // PostgREST reports an absent/unavailable RPC as PGRST202 or 42883.
  // Retrying the user's connection cannot install the missing service update.
  if (error.code === 'PGRST202' || error.code === '42883')
    return new ConsentVerificationError('עדכון השירות עדיין לא זמין. אפשר לצפות בדוגמה ובמדדים השמורים; אישור התנאים וניתוח חדש יהיו זמינים לאחר השלמת העדכון.', 'service_update');
  return new ConsentVerificationError(message);
}
export interface ServiceConsentStatus {
  serviceAccepted: boolean;
  aiAllowed: boolean;
  // Legacy RPC name: operational availability, independent of legal-review completion.
  releaseReady: boolean;
  serviceAvailable?: boolean;
  reviewCompleted?: boolean;
  deletionPending?: boolean;
  termsVersion: string;
  privacyVersion: string;
  aiVersion: string;
}
function readStatus(data: unknown): ServiceConsentStatus {
  const status = data as Partial<ServiceConsentStatus> | null;
  if (!status || typeof status.serviceAccepted !== 'boolean' ||
      typeof status.aiAllowed !== 'boolean' || typeof status.releaseReady !== 'boolean' ||
      status.termsVersion !== documents.version || status.privacyVersion !== documents.version ||
      status.aiVersion !== documents.version)
    throw new ConsentVerificationError('לא ניתן לאמת את גרסת התנאים. יש לעדכן את האפליקציה או לנסות שוב.');
  return status as ServiceConsentStatus;
}
export async function fetchServiceConsent() {
  const { data, error } = await getSupabaseClient().rpc('get_service_consent_status');
  if (error) throw rpcFailure(error, 'לא ניתן לאמת הסכמה כרגע. בדוק חיבור ונסה שוב.');
  return readStatus(data);
}
export async function acceptServiceConsent() {
  const { data, error } = await getSupabaseClient().rpc('record_service_consent', {
    p_terms_version: documents.version, p_privacy_version: documents.version,
    p_adult_private_pool_use: true,
  });
  if (error) throw rpcFailure(error, 'ההסכמה לא נשמרה. לא נמשיך לפני שמירה בשרת.');
  return readStatus(data);
}
export async function setAiConsent(allowed: boolean) {
  const { data, error } = await getSupabaseClient().rpc('record_ai_consent', {
    p_version: documents.version, p_allowed: allowed,
  });
  if (error) throw rpcFailure(error, 'הבחירה לא נשמרה. נסה שוב לפני שליחת תמונה.');
  return readStatus(data);
}
export async function requireCurrentAiConsent() {
  const status = await fetchServiceConsent();
  if (!status.serviceAccepted || !status.aiAllowed)
    throw new Error('נדרשת הסכמה מעודכנת לניתוח באמצעות Google Gemini.');
  if (!status.releaseReady) throw new Error('ניתוח חדש אינו זמין כרגע.');
}
