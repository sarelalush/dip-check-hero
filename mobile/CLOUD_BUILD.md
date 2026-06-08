# AquaSense Mobile

This folder contains the native Expo React Native app for AquaSense.

## Current Scope

Implemented:

- TypeScript Expo app entry
- Native first Home/Landing screen
- Shared mobile theme tokens
- Hebrew RTL-oriented layout and copy

Not implemented yet:

- Auth
- Camera
- Backend sync
- Payments
- Navigation beyond the first screen

## App Entry

```text
mobile/App.tsx
```

## Local Test Commands

```powershell
cd mobile
npm install
npm run typecheck
npm run start
```

On Windows, if PowerShell blocks `npm`, use `npm.cmd` instead:

```powershell
npm.cmd install
npm.cmd run typecheck
npm.cmd run start
```
