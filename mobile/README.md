# AquaSense Mobile

## Run on iPhone with Expo Go

Use this path before Apple Developer/TestFlight is available.

1. Install **Expo Go** from the iOS App Store.
2. Make sure `mobile/.env` points to the cloud Supabase project, not localhost:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://xajsepqiviezgkgqyapl.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
   EXPO_PUBLIC_STRIP_ANALYSIS_MODE=remote
   EXPO_PUBLIC_STRIP_ANALYSIS_FUNCTION=analyze-strip
   ```

3. Start Expo from Windows:

   ```powershell
   cd mobile
   npx.cmd expo start --lan -c
   ```

4. Open Expo Go on the iPhone and scan the QR code.
5. The iPhone and PC must be on the same Wi-Fi network.
6. If LAN is unstable, the best option is often connecting the PC to the iPhone hotspot and running the LAN command again.
7. If tunnel fails, use LAN. If LAN fails, use hotspot.

### Device diagnostics

Open:

`הגדרות -> בדיקת חיבור`

The screen checks the active Supabase URL, auth session, profile/account access, usage RPCs, Storage visibility, and whether the app is configured to invoke `analyze-strip` through Supabase cloud. It never displays the anon key, API keys, or image data.

### Manual device checklist

- App opens in Expo Go.
- Login/signup works.
- Add pool works.
- Add pool image works.
- Scan image selection/camera works.
- Scan image upload works.
- `analyze-strip` is called through Supabase Functions.
- Results opens.
- History saves.
- Settings diagnostics shows a cloud Supabase URL and healthy statuses.
