import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The handler is captured instead of starting Deno's server. Every API response
// is an in-memory fixture; no actual account, storage object or network is used.
let handle: (request: Request) => Promise<Response>;
const user = '00000000-0000-0000-0000-000000000001';
const account = '00000000-0000-0000-0000-000000000002';
const second = '00000000-0000-0000-0000-000000000003';
const requestId = '00000000-0000-0000-0000-000000000004';
const env: Record<string,string> = { SUPABASE_URL:'https://mock.invalid', SUPABASE_SERVICE_ROLE_KEY:'fake-operator-token', DELETION_WORKER_SECRET:'local-fixture-secret'.repeat(3) };
const deno = () => ({ env:{get:(name:string)=>env[name]}, serve:(callback:typeof handle)=>{handle=callback;} });
beforeAll(async () => {
  vi.stubGlobal('Deno',deno());
  await import('../supabase/functions/process-account-deletion/index');
});

let approved: boolean, shared: boolean, pending: boolean, failAuth: boolean;
let calls: {path:string;method:string;body:any}[];
beforeEach(() => {
  approved = true; shared = false; pending = true; failAuth = false; calls = [];
  vi.stubGlobal('Deno',deno());
  vi.spyOn(console,'error').mockImplementation(()=>{});
  const listed = new Map<string,number>();
  vi.stubGlobal('fetch',vi.fn(async (input:string, options:RequestInit) => {
    const path = input.replace('https://mock.invalid','');
    const method = options.method ?? 'GET';
    const body = options.body ? JSON.parse(String(options.body)) : undefined;
    calls.push({path,method,body});
    const json = (value:unknown) => new Response(JSON.stringify(value),{status:200});
    if (path.startsWith('/rest/v1/account_deletion_requests?')) {
      if (path.includes('&status=eq.pending')) return json(pending ? [{user_id:user}] : []);
      return json([{id:requestId,...body}]);
    }
    if (path.startsWith('/rest/v1/service_release_config?')) return json([{retention_policy_completed:approved}]);
    if (path.startsWith('/rest/v1/account_members?select=account_id')) return json([{account_id:account}]);
    if (path.startsWith('/rest/v1/accounts?')) return json(shared ? [{id:account},{id:second}] : [{id:account}]);
    if (path.startsWith('/rest/v1/account_members?select=user_id'))
      return json(path.endsWith(second) ? [{user_id:user},{user_id:'another-user'}] : [{user_id:user}]);
    if (path.startsWith('/storage/v1/object/list/')) {
      const count = (listed.get(path) ?? 0)+1; listed.set(path,count);
      return json(path.endsWith('scan-images') && count === 1 ? [{id:'fake-object',name:'scan.jpg'}] : []);
    }
    if (path === '/storage/v1/object/scan-images' && method === 'DELETE') return json([]);
    if (path.startsWith('/rest/v1/strip_brand_requests?') && method === 'DELETE') return json([]);
    if (path === '/auth/v1/admin/users/'+user && method === 'DELETE')
      return failAuth ? new Response('fixture failure',{status:500}) : new Response(null,{status:204});
    throw new Error('Unexpected local mock endpoint: '+path);
  }));
});
function request(body:unknown = {requestId}, secret=env.DELETION_WORKER_SECRET) {
  return new Request('https://mock.invalid/worker',{method:'POST',headers:{'x-deletion-worker-secret':secret},body:JSON.stringify(body)});
}
function deletes() { return calls.filter(call=>call.method==='DELETE'); }

describe('deletion worker with mock-only API fixtures', () => {
  it('rejects an incorrect worker secret without any API call', async () => {
    expect((await handle(request({requestId},'incorrect'))).status).toBe(401);
    expect(calls).toHaveLength(0);
  });
  it('rejects non-POST requests', async () => {
    expect((await handle(new Request('https://mock.invalid/worker'))).status).toBe(405);
    expect(calls).toHaveLength(0);
  });
  it('rejects invalid request identifiers before claiming a request', async () => {
    expect((await handle(request({requestId:'not-a-uuid'}))).status).toBe(400);
    expect(calls).toHaveLength(0);
  });
  it('does not process requests that are not pending', async () => {
    pending = false;
    expect((await handle(request())).status).toBe(409);
    expect(calls).toHaveLength(1);
    expect(deletes()).toHaveLength(0);
  });
  it('does not delete content until the retention policy is approved', async () => {
    approved = false;
    expect((await handle(request())).status).toBe(409);
    expect(deletes()).toHaveLength(0);
    expect(calls.at(-1)?.body.status).toBe('pending');
  });
  it('checks every account for shared data before deleting any account content', async () => {
    shared = true;
    expect((await handle(request())).status).toBe(409);
    expect(calls.some(call=>call.path.endsWith(second))).toBe(true);
    expect(deletes()).toHaveLength(0);
    expect(calls.some(call=>call.path.startsWith('/storage/'))).toBe(false);
    expect(calls.at(-1)?.body.status).toBe('pending');
  });
  it('removes scoped files before Auth deletion and records completion afterward', async () => {
    const response = await handle(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ok:true,requestId,status:'completed'});
    const storage = calls.findIndex(call=>call.path==='/storage/v1/object/scan-images');
    const auth = calls.findIndex(call=>call.path==='/auth/v1/admin/users/'+user);
    expect(storage).toBeGreaterThan(-1);
    expect(auth).toBeGreaterThan(storage);
    expect(calls[storage].body.prefixes).toEqual(['accounts/'+account+'/scan.jpg']);
    expect(calls.at(-1)?.body.status).toBe('completed');
  });
  it('does not report completion if the Auth deletion step fails', async () => {
    failAuth = true;
    const response = await handle(request());
    expect(response.status).toBe(409);
    expect((await response.json()).ok).toBe(false);
    expect(calls.at(-1)?.body.status).toBe('pending');
    expect(calls.some(call=>call.body?.status==='completed')).toBe(false);
  });
});
