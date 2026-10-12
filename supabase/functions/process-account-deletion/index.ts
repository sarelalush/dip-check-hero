// Internal operator endpoint. Never called by a mobile client.
// Configure a high-entropy DELETION_WORKER_SECRET independently of API keys.
import { readBoundedJson, UUID_PATTERN } from '../_shared/request-security.ts';

async function sameSecret(input: string, expected: string) {
  const hash = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [a,b] = await Promise.all([hash(input),hash(expected)]);
  let difference = 0;
  for (let i=0;i<a.length;i++) difference |= a[i]^b[i];
  return difference === 0;
}
function adminHeaders() {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw new Error('Server configuration missing');
  return {apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
}
async function api(path: string, method='GET', body?: unknown) {
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) throw new Error('Server configuration missing');
  const response = await fetch(url+path, {
    method, headers:{...adminHeaders(),Prefer:'return=representation'},
    body:body === undefined ? undefined : JSON.stringify(body),
    signal:AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('Deletion step failed ('+response.status+')');
  if (response.status === 204) return null;
  const content = await response.text();
  return content ? JSON.parse(content) : null;
}
async function removeFolder(bucket: string, prefix: string, depth=0) {
  if (depth > 10 || !prefix.startsWith('accounts/')) throw new Error('Invalid deletion scope');
  // Delete files after listing; always restart at offset zero because removals
  // shift pages. Empty folders disappear when their final object is removed.
  for (let page=0;page<100;page++) {
    const items = await api('/storage/v1/object/list/'+bucket,'POST',{
      prefix,limit:100,offset:0,sortBy:{column:'name',order:'asc'},
    }) as {id?:string|null;name:string}[];
    if (!Array.isArray(items)) throw new Error('Invalid storage response');
    if (!items.length) return;
    const files: string[] = [];
    for (const item of items) {
      if (!item.name || item.name.includes('/') || item.name === '.' || item.name === '..')
        throw new Error('Unexpected storage path');
      const path = prefix.replace(/\/$/,'')+'/'+item.name;
      if (item.id) files.push(path);
      else await removeFolder(bucket,path,depth+1);
    }
    if (files.length) await api('/storage/v1/object/'+bucket,'DELETE',{prefixes:files});
  }
  throw new Error('Deletion requires another processing attempt');
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return Response.json({ok:false},{status:405});
  const expected = Deno.env.get('DELETION_WORKER_SECRET') ?? '';
  const secret = request.headers.get('x-deletion-worker-secret') ?? '';
  if (expected.length < 32 || !secret || !(await sameSecret(secret,expected)))
    return Response.json({ok:false},{status:401});
  let requestId = '';
  let claimed = false;
  try {
    const body = await readBoundedJson(request,4096);
    if (typeof body.requestId !== 'string' || !UUID_PATTERN.test(body.requestId))
      return Response.json({ok:false},{status:400});
    requestId = body.requestId;
    const rows = await api('/rest/v1/account_deletion_requests?id=eq.'+requestId+
      '&status=eq.pending','PATCH',{status:'processing',operator_note:null}) as {user_id:string|null}[];
    if (!Array.isArray(rows) || rows.length !== 1)
      return Response.json({ok:false,message:'Request is not pending'},{status:409});
    claimed = true;
    const userId = rows[0].user_id;
    if (!userId || !UUID_PATTERN.test(userId)) throw new Error('Manual review required');
    const config = await api('/rest/v1/service_release_config?select=retention_policy_completed&id=eq.true') as {retention_policy_completed:boolean}[];
    if (config?.[0]?.retention_policy_completed !== true) throw new Error('Retention policy review required');
    const memberships = await api('/rest/v1/account_members?select=account_id&user_id=eq.'+userId) as {account_id:string}[];
    const owned = await api('/rest/v1/accounts?select=id&owner_user_id=eq.'+userId) as {id:string}[];
    if (!Array.isArray(memberships) || !Array.isArray(owned)) throw new Error('Invalid account response');
    const accountIds = [...new Set([...memberships.map(x=>x.account_id),...owned.map(x=>x.id)])];
    for (const accountId of accountIds) {
      if (!UUID_PATTERN.test(accountId)) throw new Error('Invalid account scope');
      const members = await api('/rest/v1/account_members?select=user_id&account_id=eq.'+accountId) as {user_id:string}[];
      if (!Array.isArray(members) || members.some(x=>x.user_id !== userId) ||
          !owned.some(x=>x.id === accountId)) throw new Error('Shared account requires manual review');
    }
    // No content deletion begins until ALL accounts have passed the shared-data check.
    for (const accountId of accountIds) {
      await removeFolder('scan-images','accounts/'+accountId);
      await removeFolder('pool-images','accounts/'+accountId);
    }
    // These optional request records otherwise use ON DELETE SET NULL and can
    // contain identifying free text. Billing records follow the reviewed policy.
    await api('/rest/v1/strip_brand_requests?user_id=eq.'+userId,'DELETE');
    // Supabase Auth deletion cascades solo-owned accounts, pools, tests, profiles
    // and consent records. Files were removed via Storage API first.
    await api('/auth/v1/admin/users/'+userId,'DELETE');
    await api('/rest/v1/account_deletion_requests?id=eq.'+requestId,'PATCH',{
      status:'completed',completed_at:new Date().toISOString(),operator_note:null,
    });
    return Response.json({ok:true,requestId,status:'completed'});
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Deletion failed';
    if (claimed && requestId) {
      // No silent success. Re-running retries safely after a partial failure.
      await api('/rest/v1/account_deletion_requests?id=eq.'+requestId,'PATCH',{
        status:'pending',operator_note:reason,
      }).catch(() => {});
    }
    console.error('account deletion requires attention',{requestId,reason});
    return Response.json({ok:false,requestId,message:'Operator attention required'},{status:409});
  }
});
