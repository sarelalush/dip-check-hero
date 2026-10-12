import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readBoundedBytes, readBoundedJson, requireAnalysisConsent, userHeaders, validateImage, MAX_IMAGE_BYTES } from '../supabase/functions/_shared/request-security';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../mobile/src/integrations/supabase/client', () => ({ getSupabaseClient: () => ({ rpc }) }));
import { acceptServiceConsent, fetchServiceConsent, legalDocuments, requireCurrentAiConsent, setAiConsent } from '../mobile/src/services/legalConsentService';

const ready = { serviceAccepted: true, aiAllowed: true, releaseReady: true,
  termsVersion: legalDocuments.version, privacyVersion: legalDocuments.version, aiVersion: legalDocuments.version };
const env = { SUPABASE_URL: 'https://mock.invalid', SUPABASE_ANON_KEY: 'local-fake-key' };
const request = () => new Request('https://mock.invalid', { headers: { Authorization: 'Bearer local-fake-jwt' } });
beforeEach(() => {
  rpc.mockReset();
  vi.stubGlobal('Deno', { env: { get: (key: keyof typeof env) => env[key] } });
  // Any unexpected fetch fails locally; there is no fallback to real network.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected network call')));
});

describe('client consent is confirmed by the server', () => {
  it('accepts only current versions and real boolean flags', async () => {
    rpc.mockResolvedValue({ data: ready, error: null });
    await expect(requireCurrentAiConsent()).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('get_service_consent_status');
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    null, {}, { ...ready, termsVersion: 'old' }, { ...ready, privacyVersion: 'old' },
    { ...ready, aiVersion: 'old' }, { ...ready, releaseReady: 'true' },
  ])('rejects incomplete or stale consent responses %j', async data => {
    rpc.mockResolvedValue({ data, error: null });
    await expect(fetchServiceConsent()).rejects.toThrow();
  });
  it.each(['serviceAccepted', 'aiAllowed', 'releaseReady'])('blocks analysis when %s is false', async flag => {
    rpc.mockResolvedValue({ data: { ...ready, [flag]: false }, error: null });
    await expect(requireCurrentAiConsent()).rejects.toThrow();
  });
  it('blocks analysis when the consent RPC fails', async () => {
    rpc.mockResolvedValue({ data: ready, error: { message: 'offline' } });
    await expect(requireCurrentAiConsent()).rejects.toThrow();
  });
  it.each(['PGRST202', '42883'])('identifies a missing consent RPC (%s) without blaming the connection or exposing raw SQL errors', async code => {
    rpc.mockResolvedValue({ data:null, error:{code,message:'internal database details'} });
    await expect(fetchServiceConsent()).rejects.toMatchObject({kind:'service_update'});
    await expect(fetchServiceConsent()).rejects.toThrow('עדכון השירות עדיין לא זמין');
    await expect(requireCurrentAiConsent()).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('sends the current document version for acceptance and withdrawal', async () => {
    rpc.mockResolvedValue({ data: ready, error: null });
    await acceptServiceConsent();
    expect(rpc).toHaveBeenLastCalledWith('record_service_consent', {
      p_terms_version: legalDocuments.version, p_privacy_version: legalDocuments.version, p_adult_private_pool_use: true });
    rpc.mockResolvedValue({ data: { ...ready, aiAllowed: false }, error: null });
    await setAiConsent(false);
    expect(rpc).toHaveBeenLastCalledWith('record_ai_consent', { p_version: legalDocuments.version, p_allowed: false });
    await expect(requireCurrentAiConsent()).rejects.toThrow();
  });
  it('does not report a successful consent save if the RPC fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'not saved' } });
    await expect(acceptServiceConsent()).rejects.toThrow();
    await expect(setAiConsent(true)).rejects.toThrow();
  });
});

describe('server guards before provider calls', () => {
  it('uses the caller JWT instead of a privileged service key', () => {
    expect(userHeaders(request())).toEqual({ apikey: 'local-fake-key', Authorization: 'Bearer local-fake-jwt', 'Content-Type': 'application/json' });
    expect(() => userHeaders(new Request('https://mock.invalid'))).toThrow();
  });
  it.each([
    {}, { ...ready, serviceAccepted: false }, { ...ready, aiAllowed: false },
    { ...ready, releaseReady: false }, { ...ready, aiAllowed: 'true' },
  ])('refuses analysis for insufficient server consent %j', async status => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(status), { status: 200 }));
    await expect(requireAnalysisConsent(request())).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://mock.invalid/rest/v1/rpc/get_service_consent_status');
  });
  it('passes only when every server consent flag is explicitly true', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(ready), { status: 200 }));
    await expect(requireAnalysisConsent(request())).resolves.toBeUndefined();
  });
  it('fails closed on server errors or invalid JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('error', { status: 500 }));
    await expect(requireAnalysisConsent(request())).rejects.toThrow();
    vi.mocked(fetch).mockResolvedValue(new Response('not JSON', { status: 200 }));
    await expect(requireAnalysisConsent(request())).rejects.toThrow();
  });
});

describe('request and image bounds', () => {
  it('reads exact-size streams and cancels streams that exceed the limit', async () => {
    const stream = (cancel?: () => void) => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([1,2])); c.enqueue(new Uint8Array([3])); }, cancel });
    const exact = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([1,2,3])); c.close(); } });
    expect(Array.from(await readBoundedBytes(exact, 3))).toEqual([1,2,3]);
    const cancel = vi.fn();
    await expect(readBoundedBytes(stream(cancel), 2)).rejects.toThrow('Body too large');
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('rejects oversized declared and undeclared bodies and non-object JSON', async () => {
    await expect(readBoundedJson(new Request('https://mock.invalid', { method:'POST', headers:{'content-length':'100'}, body:'{}' }), 8)).rejects.toThrow('Body too large');
    await expect(readBoundedJson(new Request('https://mock.invalid', { method:'POST', body:JSON.stringify({long:'x'.repeat(20)}) }), 8)).rejects.toThrow('Body too large');
    for (const body of ['[]', 'null', '"string"', 'not JSON'])
      await expect(readBoundedJson(new Request('https://mock.invalid', { method:'POST', body }), 100)).rejects.toThrow();
    await expect(readBoundedJson(new Request('https://mock.invalid', { method:'POST', body:'{"ok":true}' }), 100)).resolves.toEqual({ok:true});
  });
  function png(width:number, height:number) {
    const bytes = new Uint8Array(33);
    bytes.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
    const view = new DataView(bytes.buffer); view.setUint32(16,width); view.setUint32(20,height);
    return bytes;
  }
  it('recognizes PNG/JPEG headers and rejects excessive dimensions', () => {
    expect(validateImage(png(1000,1000))).toBe('image/png');
    const jpeg = new Uint8Array([255,216,255,192,0,8,8,0,100,0,100,1,255,217]);
    expect(validateImage(jpeg)).toBe('image/jpeg');
    for (const bytes of [png(0,10), png(12001,1), png(6000,5000), new Uint8Array([71,73,70]), new Uint8Array(MAX_IMAGE_BYTES+1)])
      expect(() => validateImage(bytes)).toThrow();
  });
});
