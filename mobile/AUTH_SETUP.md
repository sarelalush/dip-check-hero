# Mobile Auth Setup

Google login uses Supabase Auth with Expo `openAuthSessionAsync`.

## Supabase

1. Enable the Google provider in Supabase Auth.
2. Add the Google OAuth Client ID and Client Secret in Supabase.
3. Add these redirect URLs in Supabase Auth URL Configuration:
   - `aquasense://auth/callback`
   - `http://localhost:8083/auth/callback`
   - Expo Go / LAN URLs when testing native development, for example `exp://<your-ip>:8081/--/auth/callback`

## Google Cloud

Configure the OAuth consent screen and client used by Supabase. Supabase handles the Google client secret; do not put Google secrets in the mobile app.

## Production

For production iOS/Android builds, keep the app scheme in `app.json` aligned with the redirect URL configured in Supabase. The current scheme is:

```text
aquasense
```

The production mobile redirect URI is:

```text
aquasense://auth/callback
```

## Environment

The app still needs:

```text
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Keep these values in `mobile/.env`. Do not commit `mobile/.env`.
