// Mobile scan-image storage parity source:
// src/lib/cloudSync.ts uploads scan images to the "scan-images" bucket and
// stores the resulting storage path in tests.image_url. This native version
// uses expo-file-system for Android/iOS file/content URIs, without FileReader,
// DOM image elements, canvas, or browser file inputs.
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
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

function base64ToArrayBuffer(base64: string) {
  const clean = base64.replace(/\s/g, '');
  const lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of clean) {
    if (char === '=') break;
    const value = lookup.indexOf(char);
    if (value < 0) continue;

    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return new Uint8Array(bytes).buffer;
}

function parseDataUrl(dataUrl: string): { contentType: string; base64: string } | undefined {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) return undefined;
  return {
    contentType: match[1] || 'image/jpeg',
    base64: match[2] || '',
  };
}

async function readLocalImageBytes(imageUri: string): Promise<{ body: ArrayBuffer; contentType: string }> {
  const parsedDataUrl = parseDataUrl(imageUri);
  if (parsedDataUrl) {
    return {
      body: base64ToArrayBuffer(parsedDataUrl.base64),
      contentType: parsedDataUrl.contentType,
    };
  }

  const fallbackContentType = contentTypeFromUri(imageUri);

  if (Platform.OS !== 'web' && (imageUri.startsWith('file:') || imageUri.startsWith('content:'))) {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return {
      body: base64ToArrayBuffer(base64),
      contentType: fallbackContentType,
    };
  }

  const response = await fetch(imageUri);

  if (!response.ok) {
    throw new Error(`Failed to read scan image: ${response.status}`);
  }

  const responseContentType = response.headers.get('content-type');
  const contentType = responseContentType?.startsWith('image/') ? responseContentType : fallbackContentType;

  return {
    body: await response.arrayBuffer(),
    contentType,
  };
}

export async function readLocalImageAsDataUrl(imageUri: string): Promise<LocalImageDataUrl | undefined> {
  if (!isLocalUploadCandidate(imageUri)) return undefined;
  if (imageUri.startsWith('data:image/')) {
    const contentType = parseDataUrl(imageUri)?.contentType ?? contentTypeFromUri(imageUri);
    return { contentType, dataUrl: imageUri };
  }

  const { body, contentType } = await readLocalImageBytes(imageUri);

  return {
    contentType,
    dataUrl: `data:${contentType};base64,${arrayBufferToBase64(body)}`,
  };
}

export async function uploadScanImage({ accountId, imageUri, testId, userId }: UploadScanImageInput): Promise<UploadedScanImage | undefined> {
  if (!isSupabaseConfigured || !accountId || !isLocalUploadCandidate(imageUri)) {
    return undefined;
  }

  const { body, contentType } = await readLocalImageBytes(imageUri);
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
    console.warn('Failed to prepare scan image for remote analysis', error);
    return {
      uploadError: 'העלאת תמונת הסטיק לענן נכשלה. ננסה להמשיך בניתוח ישיר אם השירות זמין.',
    };
  }
}
