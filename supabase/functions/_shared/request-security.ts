export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_ANALYSIS_REQUEST_BYTES = 12 * 1024 * 1024;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readBoundedBytes(stream: ReadableStream<Uint8Array> | null, limit: number) {
  if (!stream) throw new Error('Missing body');
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) throw new Error('Body too large');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export async function readBoundedJson(request: Request, limit: number) {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) throw new Error('Body too large');
  const bytes = await readBoundedBytes(request.body, limit);
  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid body');
  return parsed as Record<string, unknown>;
}

export function userHeaders(request: Request) {
  const key = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const authorization = request.headers.get('authorization');
  if (!key || !authorization?.startsWith('Bearer ')) throw new Error('Authentication required');
  return { apikey: key, Authorization: authorization, 'Content-Type': 'application/json' };
}

export async function getServiceConsentStatus(request: Request) {
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) throw new Error('Missing server configuration');
  const response = await fetch(url + '/rest/v1/rpc/get_service_consent_status', {
    method: 'POST', headers: userHeaders(request), body: '{}',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Consent could not be verified');
  return await response.json() as { serviceAccepted?: boolean; aiAllowed?: boolean; releaseReady?: boolean };
}

export async function requireAnalysisConsent(request: Request) {
  const status = await getServiceConsentStatus(request);
  if (status.serviceAccepted !== true || status.aiAllowed !== true)
    throw new Error('Consent required');
  if (status.releaseReady !== true) throw new Error('Service is unavailable');
}

// Reject compressed image dimensions before an image decoder allocates pixels.
export function validateImage(bytes: Uint8Array, maxPixels = 24000000) {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('Invalid image size');
  let width = 0, height = 0, mimeType = '';
  if (bytes.length >= 24 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 &&
      bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    width = view.getUint32(16); height = view.getUint32(20); mimeType = 'image/png';
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    mimeType = 'image/jpeg';
    let position = 2;
    while (position + 4 < bytes.length) {
      if (bytes[position++] !== 255) throw new Error('Invalid JPEG marker');
      while (bytes[position] === 255) position++;
      const marker = bytes[position++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (position + 2 > bytes.length) break;
      const length = (bytes[position] << 8) | bytes[position + 1];
      if (length < 2 || position + length > bytes.length) throw new Error('Invalid JPEG segment');
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) {
        if (length < 8) throw new Error('Invalid JPEG dimensions');
        height = (bytes[position + 3] << 8) | bytes[position + 4];
        width = (bytes[position + 5] << 8) | bytes[position + 6];
        break;
      }
      position += length;
    }
  }
  if (!mimeType || width < 1 || height < 1 || width * height > maxPixels || width > 12000 || height > 12000)
    throw new Error('Unsupported image or dimensions');
  return mimeType;
}
