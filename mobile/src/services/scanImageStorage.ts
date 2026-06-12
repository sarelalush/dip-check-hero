// Mobile scan-image storage parity source:
// src/lib/cloudSync.ts uploads scan images to the "scan-images" bucket and
// stores the resulting storage path in tests.image_url. This native version
// uses Expo/RN-compatible fetch(imageUri) -> ArrayBuffer, without FileReader,
// DOM image elements, canvas, or browser file inputs.
import { getSupabaseClient, isSupabaseConfigured } from '../integrations/supabase/client';

export const SCAN_IMAGES_BUCKET = 'scan-images';

interface UploadScanImageInput {
  accountId?: string;
  imageUri: string;
  testId: string;
  userId: string;
}

export interface PreparedScanImageForAnalysis {
  imagePath?: string;
  imageUrl?: string;
  uploadError?: string;
}

export interface UploadedScanImage {
  bucket: typeof SCAN_IMAGES_BUCKET;
  contentType: string;
  path: string;
  publicUrl?: string;
}

export interface LocalImageDataUrl {
  dataUrl: string;
  contentType: string;
}

function isRemoteOrStorageValue(uri: string) {
  return /^https?:\/\//i.test(uri);
}

function extensionFromContentType(contentType: string) {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  return 'jpg';
}

function contentTypeFromUri(uri: string) {
  const lower = uri.split('?')[0]?.toLowerCase() ?? '';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function buildScanImagePath(accountId: string, userId: string, testId: string, contentType: string) {
  const ext = extensionFromContentType(contentType);
  return `accounts/${accountId}/users/${userId}/tests/${testId}/scan.${ext}`;
}

export function getPublicScanImageUrl(path?: string | null) {
  if (!path) return undefined;
  if (isRemoteOrStorageValue(path) || path.startsWith('data:') || path.startsWith('file:') || path.startsWith('blob:')) {
    return path;
  }
  if (!isSupabaseConfigured) return undefined;

  const { data } = getSupabaseClient().storage.from(SCAN_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function isLocalUploadCandidate(uri?: string) {
  if (!uri) return false;
  if (isRemoteOrStorageValue(uri)) return false;
  return uri.startsWith('file:') || uri.startsWith('content:') || uri.startsWith('blob:') || uri.startsWith('data:');
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  let index = 0;

  while (index < bytes.length) {
    const byte1 = bytes[index++] ?? 0;
    const byte2 = index < bytes.length ? bytes[index++] : Number.NaN;
    const byte3 = index < bytes.length ? bytes[index++] : Number.NaN;
    const enc1 = byte1 >> 2;
    const enc2 = ((byte1 & 3) << 4) | ((byte2 || 0) >> 4);
    const enc3 = Number.isNaN(byte2) ? 64 : (((byte2 & 15) << 2) | ((byte3 || 0) >> 6));
    const enc4 = Number.isNaN(byte3) ? 64 : byte3 & 63;

    output += chars.charAt(enc1);
    output += chars.charAt(enc2);
    output += enc3 === 64 ? '=' : chars.charAt(enc3);
    output += enc4 === 64 ? '=' : chars.charAt(enc4);
  }

  return output;
}

export async function readLocalImageAsDataUrl(imageUri: string): Promise<LocalImageDataUrl | undefined> {
  if (!isLocalUploadCandidate(imageUri)) return undefined;
  if (imageUri.startsWith('data:image/')) {
    const contentType = /^data:([^;]+);base64,/.exec(imageUri)?.[1] ?? contentTypeFromUri(imageUri);
    return { contentType, dataUrl: imageUri };
  }

  const fallbackContentType = contentTypeFromUri(imageUri);
  const response = await fetch(imageUri);

  if (!response.ok) {
    throw new Error(`Failed to read scan image for remote analysis: ${response.status}`);
  }

  const responseContentType = response.headers.get('content-type');
  const contentType = responseContentType?.startsWith('image/') ? responseContentType : fallbackContentType;
  const body = await response.arrayBuffer();

  return {
    contentType,
    dataUrl: `data:${contentType};base64,${arrayBufferToBase64(body)}`,
  };
}

export async function uploadScanImage({ accountId, imageUri, testId, userId }: UploadScanImageInput): Promise<UploadedScanImage | undefined> {
  if (!isSupabaseConfigured || !accountId || !isLocalUploadCandidate(imageUri)) {
    return undefined;
  }

  const fallbackContentType = contentTypeFromUri(imageUri);
  const response = await fetch(imageUri);

  if (!response.ok) {
    throw new Error(`Failed to read scan image: ${response.status}`);
  }

  const responseContentType = response.headers.get('content-type');
  const contentType = responseContentType?.startsWith('image/') ? responseContentType : fallbackContentType;
  const body = await response.arrayBuffer();
  const path = buildScanImagePath(accountId, userId, testId, contentType);

  const { error } = await getSupabaseClient().storage.from(SCAN_IMAGES_BUCKET).upload(path, body, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw error;
  }

  return {
    bucket: SCAN_IMAGES_BUCKET,
    contentType,
    path,
    publicUrl: getPublicScanImageUrl(path),
  };
}

export async function prepareScanImageForRemoteAnalysis({
  accountId,
  imageUri,
  testId,
  userId,
}: UploadScanImageInput): Promise<PreparedScanImageForAnalysis> {
  if (!isSupabaseConfigured || !accountId || !isLocalUploadCandidate(imageUri)) {
    return {};
  }

  try {
    const uploadedImage = await uploadScanImage({ accountId, imageUri, testId, userId });

    return {
      imagePath: uploadedImage?.path,
      imageUrl: uploadedImage?.publicUrl,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn('Failed to prepare scan image for remote analysis', {
      accountIdExists: Boolean(accountId),
      imageUriType: imageUri.startsWith('file:') ? 'file' : imageUri.startsWith('content:') ? 'content' : imageUri.startsWith('data:') ? 'data' : imageUri.startsWith('blob:') ? 'blob' : 'other',
      reason,
      testId,
      userIdExists: Boolean(userId),
    });
    return {
      uploadError: `העלאת תמונת הסטיק לפני הניתוח נכשלה: ${reason}. נמשיך עם fallback מקומי.`,
    };
  }
}
