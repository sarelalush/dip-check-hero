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
