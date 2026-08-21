# Release Guide — Subby

## Versioning
* `app.json` `expo.version` is the marketing version (e.g. `1.0.0`). Bump patch for fixes, minor for features.
* `android.versionCode` / `ios.buildNumber` are auto-incremented by EAS (`autoIncrement: true` in `eas.json` production). Do not hard-set in `app.json`.
* Tag releases: `git tag v1.0.1 && git push --tags` after promoting to Production.

## Env
* Production Supabase creds are EAS Secrets (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) scoped to `production`. Local dev uses `.env.local` (`http://127.0.0.1:54321` / `10.0.2.2` for Android emulator via `src/lib/supabase-env.ts`).
* Demo data: `ENABLE_DEMO_DATA` is `__DEV__` only unless `EXPO_PUBLIC_ENABLE_DEMO=1`. Keep off for store builds (`APP_VARIANT=production`).

## Build & Submit
```bash
# Preview (prod-like, sideload)
npm run build:preview:android
npm run build:preview:ios

# Production (AAB + IPA)
eas build --profile production --platform all --non-interactive
eas build:view

# Submit (placeholders in eas.json submit.production must be filled with real Asc App ID / Team ID / Play service-account JSON)
eas submit --profile production --platform ios --latest
eas submit --profile production --platform android --latest
# Play track: internal → closed → production (staged)
# iOS: TestFlight internal → external beta → production (phased)
```

## Credentials
* `credentialsSource: "remote"` — EAS manages iOS cert/provisioning + Android keystore at `expo.dev/accounts/gjsuarezdev/credentials`.
* Do not commit `*.jks`, `*.p8`, `pc-api-*.json`.

## Hosting
* Privacy/support hosted on `https://subby.georgejsuarez.com` (Cloudflare Pages on `georgejsuarez.com` zone, DNS `subby` CNAME). Deploy `site/` (index, privacy, support, terms, delete).
* Supabase Dashboard → Auth → URL Configuration: Site URL `https://subby.georgejsuarez.com`, Additional Redirect URLs `subby://*`, `https://subby.georgejsuarez.com/*`.

## Hotfix
* EAS Update channel `production`: `eas update --channel production --message "fix: ..."`
* Emergency: `eas update --channel production --branch emergency`

## Checklist before submit
* `npm run doctor` 20/20, `npm run lint && npm run typecheck && npm test` green
* `npx expo prebuild --clean` shows no `usesCleartextTraffic` in prod, no `SCHEDULE_EXACT_ALARM`
* Screenshots + feature graphic + privacy URL live + Data Safety/App Privacy filled + demo account `app-review@subby.georgejsuarez.com` seeded
