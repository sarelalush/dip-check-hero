# AquaSense Admin Dashboard

Local desktop-only admin dashboard for viewing AquaSense users, scans, pool limits, and manual subscription grants.

This dashboard is not part of the mobile app routes or builds. It runs as a separate local web tool.

## Run

```bash
node admin-dashboard/server.mjs
```

Then open:

```text
http://127.0.0.1:8090
```

The dashboard uses the public Supabase key and requires signing in as a user that has the `admin` role in `public.user_roles`.

## Supabase config

The dashboard is separate from the mobile app, but it should usually point to the same Supabase project as the mobile app.

Config priority:

1. `ADMIN_SUPABASE_URL` and `ADMIN_SUPABASE_PUBLISHABLE_KEY` / `ADMIN_SUPABASE_ANON_KEY`
2. `mobile/.env` values: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. Root web app values: `VITE_SUPABASE_URL` / `SUPABASE_URL`

For local-only overrides, create `admin-dashboard/.env.local`. This file is ignored by git.
