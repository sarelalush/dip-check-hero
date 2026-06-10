# Mobile Supabase Setup

This project is ready to run against an independent Supabase project owned by
the app owner. The mobile app uses Supabase Auth, database sync, Storage image
upload, and the `analyze-strip` Edge Function.

## Fresh Project Migration Status

The existing migrations create the required mobile tables:

- `profiles`
- `pools`
- `tests`
- `subscriptions`
- `user_roles`
- `strip_brand_requests`

The migrations also create the private Storage bucket:

- `scan-images`

RLS policies are included for user-owned profiles, pools, tests, brand requests,
roles, and scan images. Scan image policies support both
`users/{user_id}/tests/{test_id}/scan.jpg` and the older `{user_id}/...`
object layout. Admin helper policies/functions are also included.

## Create and Link a New Supabase Project

```powershell
npx supabase login
npx supabase link --project-ref NEW_PROJECT_REF
npx supabase db push
```

If the Storage bucket was not created for any reason, create it manually:

```sql
insert into storage.buckets (id, name, public)
values ('scan-images', 'scan-images', false)
on conflict (id) do nothing;
```

## Required Edge Function Secrets

The mobile app must not contain the Gemini key. Set it only as a Supabase Edge
Function secret:

```powershell
npx supabase secrets set GEMINI_API_KEY="YOUR_GEMINI_API_KEY" --project-ref NEW_PROJECT_REF
npx supabase secrets set GEMINI_MODEL="gemini-2.5-flash" --project-ref NEW_PROJECT_REF
```

`GEMINI_MODEL` is optional. If omitted, `analyze-strip` uses
`gemini-2.5-flash`.

## Deploy the Analysis Function

```powershell
npx supabase functions deploy analyze-strip --project-ref NEW_PROJECT_REF
```

## Mobile Environment

Create or update `mobile/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://NEW_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
EXPO_PUBLIC_STRIP_ANALYSIS_MODE=remote
EXPO_PUBLIC_STRIP_ANALYSIS_FUNCTION=analyze-strip
```

The old `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` name is still supported by the
client for compatibility, but new projects should use
`EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## Local Commands

```powershell
cd mobile
npm install
npm run typecheck
npm run web
```

## Function Invoke Example

After uploading an image to `scan-images`, invoke the function with:

```powershell
npx supabase functions invoke analyze-strip --project-ref NEW_PROJECT_REF --body '{\"testId\":\"test-demo-1\",\"userId\":\"USER_ID\",\"poolId\":\"POOL_ID\",\"brandId\":\"aquachek-pro-5in1\",\"imagePath\":\"users/USER_ID/tests/test-demo-1/scan.jpg\"}'
```

Expected successful AI metadata in the mobile Results screen:

```text
מקור ניתוח: AI · gemini · gemini-2.5-flash · ביטחון XX%
```

If Gemini is missing, fails, or returns low confidence, the Edge Function falls
back to deterministic CV. If CV also fails, it returns `remote-mock` so the app
flow does not crash.
