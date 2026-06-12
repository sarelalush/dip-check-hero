import { getSupabaseClient, isSupabaseConfigured } from '../integrations/supabase/client';

export const POOL_IMAGES_BUCKET = 'pool-images';

interface UploadPoolImageInput {
  accountId: string;
  imageUri: string;
  poolId: string;
  userId: string;
}

export interface UploadedPoolImage {
  bucket: typeof POOL_IMAGES_BUCKET;
  contentType: string;
  path: string;
  signedUrl?: string;
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

function buildPoolImagePath(accountId: string, userId: string, poolId: string, contentType: string) {
  const ext = extensionFromContentType(contentType);
  return `accounts/${accountId}/users/${userId}/pools/${poolId}/cover.${ext}`;
}

export function isLocalPoolImageCandidate(uri?: string) {
  if (!uri) return false;
  if (isRemoteOrStorageValue(uri)) return false;
  return uri.startsWith('file:') || uri.startsWith('content:') || uri.startsWith('blob:') || uri.startsWith('data:');
}

export async function getSignedPoolImageUrl(path?: string | null) {
  if (!path) return undefined;
  if (isRemoteOrStorageValue(path) || path.startsWith('data:') || path.startsWith('file:') || path.startsWith('blob:')) {
    return path;
  }
  if (!isSupabaseConfigured) return undefined;

  const { data, error } = await getSupabaseClient().storage.from(POOL_IMAGES_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error) {
    console.warn('Failed to create signed pool image URL', error);
    return undefined;
  }

  return data.signedUrl;
}

export async function uploadPoolImage({ accountId, imageUri, poolId, userId }: UploadPoolImageInput): Promise<UploadedPoolImage | undefined> {
  if (!isSupabaseConfigured || !accountId || !isLocalPoolImageCandidate(imageUri)) {
    return undefined;
  }

  const fallbackContentType = contentTypeFromUri(imageUri);
  const response = await fetch(imageUri);

  if (!response.ok) {
    throw new Error(`Failed to read pool image: ${response.status}`);
  }

  const responseContentType = response.headers.get('content-type');
  const contentType = responseContentType?.startsWith('image/') ? responseContentType : fallbackContentType;
  const body = await response.arrayBuffer();
  const path = buildPoolImagePath(accountId, userId, poolId, contentType);

  const { error } = await getSupabaseClient().storage.from(POOL_IMAGES_BUCKET).upload(path, body, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw error;
  }

  return {
    bucket: POOL_IMAGES_BUCKET,
    contentType,
    path,
    signedUrl: await getSignedPoolImageUrl(path),
  };
}

export async function removePoolImage(path?: string | null) {
  if (!isSupabaseConfigured || !path || isRemoteOrStorageValue(path) || path.startsWith('data:') || path.startsWith('file:') || path.startsWith('blob:')) {
    return;
  }

  const { error } = await getSupabaseClient().storage.from(POOL_IMAGES_BUCKET).remove([path]);
  if (error) {
    console.warn('Failed to remove pool image from storage', error);
  }
}
