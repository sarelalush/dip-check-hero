import bundledDocuments from '../config/legalDocuments.json';
import { getSupabaseClient } from '../integrations/supabase/client';

// Display exactly the snapshot selected by the server. A contact/terms rollout
// can then be staged before an app update reaches all devices.
export let legalDocuments = bundledDocuments;
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
async function readStatus(data: unknown): Promise<ServiceConsentStatus> {
  const status = data as Partial<ServiceConsentStatus> | null;
  if (!status || typeof status.serviceAccepted !== 'boolean' ||
      typeof status.aiAllowed !== 'boolean' || typeof status.releaseReady !== 'boolean' ||
      typeof status.termsVersion !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:\.\d+)?$/.test(status.termsVersion) ||
      status.privacyVersion !== status.termsVersion || status.aiVersion !== status.termsVersion)
    throw new ConsentVerificationError('לא ניתן לאמת את גרסת התנאים. יש לעדכן את האפליקציה או לנסות שוב.');
  if (status.termsVersion !== legalDocuments.version) {
    const { data: rows, error } = await getSupabaseClient().from('legal_document_versions')
      .select('kind,content').eq('version', status.termsVersion).in('kind',['terms','privacy','ai']);
    const parts = new Map((rows ?? []).map((row) => [row.kind,row.content]));
    const valid = (value: unknown): value is typeof bundledDocuments.terms => {
      const doc = value as typeof bundledDocuments.terms | null;
      return Boolean(doc && typeof doc.title === 'string' && Array.isArray(doc.sections) && doc.sections.length > 0 &&
        doc.sections.every((section) => typeof section.title === 'string' && typeof section.body === 'string'));
    };
    const terms=parts.get('terms'), privacy=parts.get('privacy'), ai=parts.get('ai');
    if (error || rows?.length !== 3 || !valid(terms) || !valid(privacy) || !valid(ai))
      throw new ConsentVerificationError('לא ניתן לטעון את נוסח התנאים שנבחר בשרת. נסה שוב לפני אישור.');
    legalDocuments={...bundledDocuments,version:status.termsVersion,terms,privacy,ai};
  }
  return status as ServiceConsentStatus;
}
export async function fetchServiceConsent() {
  const { data, error } = await getSupabaseClient().rpc('get_service_consent_status');
  if (error) throw rpcFailure(error, 'לא ניתן לאמת הסכמה כרגע. בדוק חיבור ונסה שוב.');
  return readStatus(data);
}
export async function acceptServiceConsent() {
  const { data, error } = await getSupabaseClient().rpc('record_service_consent', {
    p_terms_version: legalDocuments.version, p_privacy_version: legalDocuments.version,
    p_adult_private_pool_use: true,
  });
  if (error) throw rpcFailure(error, 'ההסכמה לא נשמרה. לא נמשיך לפני שמירה בשרת.');
  return readStatus(data);
}
export async function setAiConsent(allowed: boolean) {
  const { data, error } = await getSupabaseClient().rpc('record_ai_consent', {
    p_version: legalDocuments.version, p_allowed: allowed,
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
