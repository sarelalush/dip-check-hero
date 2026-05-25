# AquaSense Mobile — Cloud Build Path

This folder contains the native iOS/Android app for AquaSense, built with Expo and React Native.

## You can build this without a local computer

You need:

- Expo account
- iPhone
- GitHub repo connected to Expo/EAS
- Supabase environment variables
- Apple Developer account when you want TestFlight/App Store builds

## Required Expo environment variables

Add these in the Expo dashboard for this project:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

These are the mobile equivalents of the Lovable/Vite variables:

```env
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

## Build profiles

This project includes `eas.json` with three profiles:

- `development` — custom development client
- `preview` — internal iPhone install build
- `production` — App Store/TestFlight build

## Recommended first build

Use the `preview` profile first.

It creates an installable iPhone build without needing to publish to the App Store yet.

## App entry

The mobile app starts from:

```text
mobile/App.tsx
```

## Current app status

Implemented:

- Supabase email/password auth
- Hebrew RTL UI
- Home screen
- Select-strip screen
- Camera scan placeholder
- Pools/history placeholder screens

Next work:

- Connect real strip color scanning logic
- Port pools/history database screens from the Lovable web app
- Add subscription/payment flow if needed
- Prepare App Store screenshots and metadata
