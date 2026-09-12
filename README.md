# SHY Music

SHY is a music platform for independent artists, songwriters, and listeners. This repository is the new source of truth for the web app, Supabase schema, catalog import, deployment, and Android wrapper.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the new Supabase project URL and publishable key.
3. Run the migration in `supabase/migrations/20260912090000_initial_shy.sql`.
4. Run `npm install` and `npm run dev`.

## Initial artist and catalog

Create an artist account in the app with `djottuza@gmail.com`, verify the email, then add the server-only `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` and run:

```powershell
npm run catalog:import
```

The import is idempotent. It uploads two album covers and 24 tracks from `D:\KOPA MUSIC`, makes KOPA & DJ Ottuza the catalog owner, and assigns listener, artist, and admin roles to that account. Audio files are uploaded to Supabase Storage and are never committed to Git.

## Quality checks

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

## Deployment

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as GitHub Actions repository secrets. Enable GitHub Pages with GitHub Actions as its source. A push to `main` then tests and deploys the app.

In Supabase Auth URL Configuration, use the final GitHub Pages URL as the Site URL and add `<site-url>/auth` as a redirect URL.

## Android

Set `CAPACITOR_SERVER_URL` to the final GitHub Pages URL, then run:

```powershell
npx cap add android
npm run android:sync
npm run android:build
```

Web-only releases reach the installed app from the shared production URL after the app is reopened. Native plugin or Android configuration changes require a new APK/AAB.
