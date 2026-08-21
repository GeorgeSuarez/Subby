# Subby — Production Readiness & Store Deployment Plan

## Context

Subby is currently an internal/test app (Expo SDK 57 / RN 0.86 / Supabase) with working iOS + Android internal builds (`development` + `preview` APK/IPA via EAS). It is **not** store-ready:

* No versioning discipline (`1.0.0` everywhere, `autoIncrement` only in `eas.json` production, no `android.versionCode` / `ios.buildNumber` strategy)
* Dev-only config leaking to prod (`expo-build-properties.usesCleartextTraffic=true`, `.env` anon key committed, `SCHEDULE_EXACT_ALARM` to be removed per owner decision, `NSCameraUsageDescription` placeholder)
* No EAS Submit credentials, no `submit` section in `eas.json`, no App Store / Play signing (`.jks`, `.p8`, Asc API key, Play service account)
* No hosted privacy policy / terms / support URLs, no Data Safety / App Privacy nutrition labels, no content rating, no encryption export declaration
* Production Supabase project (`wiungqhmzgavfpvvlkmj`) exists but production env vars are not injected via EAS Secrets/environment — local loopback rewrites still present
* Assets are correct for internal builds but store listings (screenshots, feature graphic, preview video, description, categories) not prepared; `build/Subby.*` artifacts are gitignored
* CI only runs lint/typecheck/test — no `expo-doctor`, no `eas build` dry-run, no release tagging

**Outcome:** a checklist and concrete file changes to go from `main` → TestFlight + Play Internal Track → Production with zero blocking store rejections.

## Approach — Keep Expo Config-Driven, Gate Prod Behavior at Build Time

1. **Audit first, then fix.** Run `npx expo-doctor`, `npx expo config --json --type public`, and inspect generated `android/app/build.gradle` + `Info.plist` via `npx expo prebuild` (no commit of `android/`/`ios/`). Fix all `doctor` failures before any store build.

2. **Separate dev vs prod at the EAS layer, not code branches.** Keep `app.json` as the single source of truth, add `app.config.ts` (or `APP_VARIANT` env already in `eas.json`) to **disable** `usesCleartextTraffic` in production, strip demo-data, and inject prod Supabase URL/key via `EXPO_PUBLIC_*` EAS secrets. No `if (__DEV__)` leakage for store binaries.

3. **Reuse existing pipelines.** The offline-first architecture (`src/db/offline.ts` queue + cache), RLS (`supabase/migrations/*`), notification sidecar (`src/db/notification-sidecar.ts` + `src/utils/notifications.ts`), and auth flows (`supabase/functions/delete-account`) are store-compatible — harden them for production rather than rewrite.

4. **Treat stores as compliance, not just builds.** Privacy policy hosting on `subby.georgejsuarez.com` (Cloudflare), Data Safety / App Privacy answers (`POST_NOTIFICATIONS` only — `SCHEDULE_EXACT_ALARM` dropped), and encryption declarations are gating; prepare them before bumping `version`.

5. **Ship incrementally:** Internal → Preview (production-like AAB/IPA) → TestFlight + Play Internal Track → staged rollout (10% → 100%). Each promotion reuses the same binary artifact.

## Inventory — What Exists vs What's Missing

### Exists & Reusable
* `app.json`: correct `ios.bundleIdentifier` + `android.package` (`com.subby.app`), `scheme=subby`, adaptive icons, splash plugin, `expo-notifications` channel, `expo-sqlite`, `expo-secure-store`
* `eas.json`: `development`/`preview`/`production` profiles, `projectId=4d56890e-...`, `owner=gjsuarezdev`
* Supabase: `supabase/migrations/*.sql` with RLS (`subscriptions` + `user_prefs` scoped to `auth.uid()`), `supabase/functions/delete-account` (JWT-scoped, FK cascade)
* Offline: `src/db/offline.ts:buildDefaultDeps` lazy-requires `expo-notifications` with Expo Go guard (already fixed), `src/db/queries.ts` typed CRUD, `notification_map` sidecar local-only
* Assets: `icon.png`, `android-icon-*`, `ledger-stack-splash.png`, `favicon.png` (via `scripts/generate-icons.mjs`)
* Docs: `docs/privacy-policy.md` (content ok, not hosted), `docs/screenshots/*`, `docs/demo/*`
* CI: `.github/workflows/ci.yml` (lint/typecheck/test)

### Missing / Risky for Store Review
* `app.json` still has `usesCleartextTraffic:true` (Play will flag), placeholder `NSCameraUsageDescription`, no `versionCode`/`buildNumber`, no `privacy` URL, no `expo.android.googleServicesFile` if needed, no `ios.config.usesAppleSignIn` declaration
* `eas.json` has no `submit` section, no credentials (`credentialsSource`, Asc API key, Play service account), `production` outputs `.apk` instead of `.aab` for Play
* `.env` committed with publishable key — must move to `eas.json` env + EAS Secrets; `.env.local` correctly gitignored but `10.0.2.2` rewrite in `src/lib/supabase-env.ts` is dev-only
* No hosted privacy/support URLs — owner has `georgejsuarez.com` on Cloudflare; plan is `https://subby.georgejsuarez.com/privacy` (Cloudflare Pages/Workers) + `/support` + `/delete` (Play requires HTTPS, App Store requires link in App Privacy)
* No `Data Safety` form prep (Play) / `App Privacy` labels (App Store) — app collects **email + subscriptions + prefs**, no ads, **no tracking for v1** (per owner decision), `POST_NOTIFICATIONS` justified for reminders; `SCHEDULE_EXACT_ALARM` will be **removed/dropped** (owner prefers to drop exact timing claim rather than risk Play rejection)
* No store listing assets: Play requires 2+ phone screenshots + 1024x500 feature graphic + 512x512 hi-res icon; App Store requires 6.5" + 5.5" screenshots + 1024x1024 App Icon (already has but must verify no alpha)
* No encryption export compliance (App Store questionnaire: app uses HTTPS only → exempt)
* No crash reporting for v1 (owner: ship with no tracking) — keep `expo-updates` rollback channel only, defer Sentry to post-launch if needed
* No production RLS re-test against hosted project, no backup/restore drill
* No version bump & changelog discipline, no `expo-updates` channel

## Files to Modify

* `app.json` → add `expo.version` bump strategy, `android.versionCode` / `ios.buildNumber` via `expo.applicationConfig` or migrate to `app.config.ts` for `APP_VARIANT` branching; remove `usesCleartextTraffic` in prod, tighten `permissions`, add `privacy`, fix `NSCameraUsageDescription` or remove camera plugin, set `ios.supportsTablet` correctly, add `expo.ios.privacyManifests` if needed
* `eas.json` → add `submit.production.ios` + `android` (Asc API key, Play service account), switch `production.android.buildType` to `app-bundle` (AAB), add `env.EXPO_PUBLIC_SUPABASE_URL/ANON_KEY` via `eas env` secrets, keep `autoIncrement`
* `app.config.ts` **(new or derive from app.json)** → handle `APP_VARIANT` to disable `usesCleartextTraffic` + `ENABLE_DEMO_DATA` in production, pick correct `scheme` host (`subby://` prod vs dev)
* `.env` / `.env.production` → remove committed prod key, document `EXPO_PUBLIC_SUPABASE_URL` injection via EAS Secrets; keep `.env.local` for `10.0.2.2`
* `src/lib/supabase-env.ts` + `src/utils/environment.ts` → ensure Loopback → `10.0.2.2` rewrite is dev-only, prod always uses `https://*.supabase.co`, guard `ENABLE_DEMO_DATA` off in prod
* `src/features/settings/components/DemoDataSection.tsx` + `DangerZoneSection` → hide in production (`!__DEV__ && !ENABLE_DEMO_DATA` already exists — verify not bundled)
* `src/utils/notifications.ts` + `src/db/offline.ts` → already hardened (no-op in Expo Go); **remove `SCHEDULE_EXACT_ALARM` from `app.json` permissions** and rely on inexact scheduling (Play Data Safety: `POST_NOTIFICATIONS` only, justification "local renewal reminder the day before, ±15 min window, not exact alarm"); keep channel `renewals` behavior
* `supabase/migrations/*` + `supabase/tests/rls.sql` → re-run `supabase db test --local` + `supabase db push --linked` to hosted `wiungqhmzgavfpvvlkmj`; confirm `grant` + `(select auth.uid())` initPlan wrapper preserved
* `supabase/functions/delete-account/index.ts` → verify deployed to hosted (`supabase functions deploy delete-account --no-verify-jwt` check)
* `docs/privacy-policy.md` → host at `https://subby.georgejsuarez.com/privacy` via Cloudflare (Pages or Worker on `georgejsuarez.com` zone — add DNS `subby` CNAME/page); add `terms.md`, `support.md`/`delete.md` at same subdomain; Play requires HTTPS privacy URL, App Store requires link in App Privacy form
* `store/` or `fastlane/` **(new)** → Play `store/metadata/en-US/*` (title, short/full description, `dataSafety.csv`), `fastlane/metadata/ios/*` or App Store Connect via `eas.json submit`
* `assets/store/*` **(new)** → 6.5" iPhone, 5.5" iPhone, iPad (if `supportsTablet:true`), Android phone + tablet screenshots, 1024x500 feature graphic, 512x512 hi-res icon export (no alpha for iOS per HIG)
* `.github/workflows/ci.yml` → add `npx expo-doctor`, `npm run format:check`, `supabase db test`; add `release.yml` for tag-triggered `eas build --auto-submit` (optional)
* `package.json` scripts → add `prebuild:clean`, `eject-check`, keep `build:production:*` + `submit:*` aliased to `eas`
* `README.md` / `docs/release.md` **(new)** → document production env setup, bumping version, creating store credentials, promoting TestFlight → Production

## Reuse (Do Not Rebuild)

* `src/db/queries.ts` + `rowToSubscription/subscriptionToRow` — typed Supabase CRUD, same store API, RLS-tested
* `src/store/useSubscriptionsStore.ts` + `useUIStore.ts` + `useAuthStore.ts` — read-through cache + queue flush on `expo-network` reconnect; keep `persist` for device prefs only
* `src/lib/supabase.ts` — Supabase client with `expo-secure-store` session, `isSupabaseConfigured` guard
* `src/features/auth/auth-flow.ts` + `handleAuthUrl` + `ForgotPasswordScreen`/`ResetPasswordScreen` — deep-link `subby://` + Mailpit local vs `*.supabase.co` prod handled via `EXPO_PUBLIC_SUPABASE_URL`; keep `subby` scheme intent filter verified via `prebuild`
* `scripts/generate-icons.mjs` + `expo-image` — already cyan-on-dark, adaptive + monochrome, no alpha for iOS per HIG (verified via sharp)
* `supabase/.temp` / `supabase start` / `supabase functions serve` — local parity loop for auth/RLS before pushing to hosted
* `android` prebuild output (`POST_NOTIFICATIONS` only after `SCHEDULE_EXACT_ALARM` removal, notification icon `android-icon-monochrome`, splash `ledger-stack-splash`) — config-only, no hand edit

## Steps — Production Checklist

### Phase 0 — Audit & Blockers (P0)
- [ ] `npm run doctor` green (currently 20/20 needed), `npx expo install --check` clean, `npm run lint && npm run typecheck && npm test` green
- [ ] `npx expo config --json --type public` + `npx expo prebuild --clean` — verify `android.package`, `ios.bundleIdentifier`, `scheme`, permissions, `targetSdkVersion` 35 (Android 15), `compileSdkVersion`, `edgeToEdgeEnabled`
- [ ] Decide **APP_VARIANT** branching: recommend `app.config.ts` exporting `app.json` + `process.env.APP_VARIANT === 'production' ? { android: { usesCleartextTraffic: false } } : { usesCleartextTraffic: true }`

### Phase 1 — Config & Secrets (P0)
- [ ] Bump `expo.version` to `1.0.0` → `1.0.1` strategy doc, ensure `ios.buildNumber` + `android.versionCode` auto-increment via EAS (already `autoIncrement:true` in production) — confirm `app.json` `android.versionCode` not hard-set
- [ ] Migrate prod Supabase creds to EAS Secrets: `eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value https://wiungqhmzgavfpvvlkmj.supabase.co --environment production` same for `EXPO_PUBLIC_SUPABASE_ANON_KEY` (publishable key safe but consistent), remove from `.env` commit; add `subby.georgejsuarez.com` URLs to Supabase Dashboard → Auth → URL Configuration (Site URL + Additional Redirect URLs `subby://*`)
- [ ] Add `eas.json` `submit` for both stores:
  ```json
  "submit": {
    "production": {
      "ios": { "appleId": "…", "ascAppId": "…", "appleTeamId": "…" },
      "android": { "serviceAccountKeyPath": "./pc-api-xxx.json", "track": "internal" }
    }
  }
  ```
- [ ] **Create developer accounts (owner: none yet):** Apple Developer Program ($99/yr, needs Apple ID + DUNS if organization, Team ID appears after enrollment) + Google Play Console ($25 one-time, needs Google account + ID verification). Create both *before* `eas credentials` — free to browse, paid to publish. Use `georgesuarezdev@gmail.com` (current `owner` + privacy contact) or a shared team email? Enrollment: Apple `developer.apple.com` → Program → Individual (1–2 days); Play Console `play.google.com/console` → verification (1–3 days). Without these, `eas submit` blocks.
- [ ] Generate/store credentials **(owner: let EAS manage remotely):** `eas credentials` with `credentialsSource: "remote"` (default) → let EAS generate/manage iOS Distribution cert + Provisioning Profile + Push key and Android keystore remotely (no local `*.jks`/`*.p8` check-in). Verify in `https://expo.dev/accounts/gjsuarezdev/credentials` and keep EAS dashboard as source of truth; no 1Password backup needed for v1
- [ ] Switch `production.android.buildType` from `apk` → `app-bundle` (AAB required for Play), keep `preview` as `apk` for sideload

### Phase 2 — Compliance & Content (P0 for review)
- [ ] Host privacy/support on Cloudflare: create Cloudflare Pages project `subby` (or Worker) on `georgejsuarez.com` zone → DNS `subby` → `subby.georgejsuarez.com`, deploy `docs/privacy-policy.md` to `/privacy`, add `/support` (`georgesuarezdev@gmail.com` + link) and `/terms` (use Apple Standard EULA `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/` if no custom terms) and `/delete` (instructions: Settings → Delete account). Verify HTTPS, add URLs to `app.json` `expo.ios.config` + Play Console → App Content → Privacy Policy + App Store Connect → App Privacy → Privacy Policy URL. Keep in-app Settings → Delete already implemented for Data Safety deletion declaration
- [ ] Complete **Play Data Safety** (v1 = no tracking): declare `email` (account), `subscriptions` + `prefs` (app activity), no location, no `AD_ID`, no ads, **Data collection: No** for tracking, encryption in transit (Supabase TLS), data deletion via in-app Settings → Delete + `https://subby.georgejsuarez.com/delete` + email `georgesuarezdev@gmail.com`. Permissions: **only `POST_NOTIFICATIONS`** (justification: "User-enabled renewal reminders, day before at 09:00 ±15 min, local only"); `SCHEDULE_EXACT_ALARM` **removed** per owner decision, so no exact-alarm justification needed (already inexact via `Notifications.scheduleNotificationAsync` without exact flag)
- [ ] Complete **App Store App Privacy** (v1 = no tracking): `email` → Linked to User / App Functionality, `subscriptions` + `prefs` → Linked to User / App Functionality, `notification_map` → Not Linked / On Device only, **Tracking = No**, no `NSUserTrackingUsageDescription` needed. Fill **Encryption Export Compliance**: "HTTPS only via Supabase, no custom crypto" → exempt (or set `expo.ios.config.usesNonExemptEncryption: false` in `app.json`)
- [ ] Fill **Content Rating**: Play Console questionnaire (no gambling, no user-gen, PEGI 3 / Everyone), App Store Age Rating (4+)
- [ ] Verify `app.json` `ios.infoPlist.NSCameraUsageDescription` — if no camera code, remove permission; if kept for future `receipt scanning`, keep string but mention in review notes ("v1 does not invoke camera")
- [ ] Add `expo.ios.config.usesNonExemptEncryption: false` (or answer in App Store Connect)

### Phase 3 — Store Listings & Assets (P0)
- [ ] Prepare listings (copy from README features): Title `Subby - Subscription Tracker` (30 chars Play / iOS), Subtitle `Track renewals, stay under budget`, Short description (80 chars), Full description (4000 chars Play, 4000 iOS), Keywords (iOS 100 chars comma-separated), Category `Finance` / `Productivity`, Support URL, Marketing URL (`docs/demo/index.html` or `subby.app`)
- [ ] Generate screenshots: iPhone 6.7" (1290x2796), 6.5" (1284x2778), iPad 12.9" if `supportsTablet:true` (2048x2732), Android phone 16:9 (1080x1920 min) ×2, optional tablet + feature graphic 1024x500 + hi-res icon 512x512. Use `docs/screenshots/*.png` as base, add device frames via `fastlane frameit` or Figma, capture from `preview` build not Expo Go
- [ ] Verify icons: `icon.png` 1024x1024 no alpha (App Store rejects alpha), `android-icon-*` adaptive 432x432, `monochrome` for Android 13 themed icon, `splash` centered
- [ ] Record preview video (≤30s Play, 15-30s App Store) — reuse `docs/demo/*.mp4` but add captions, no third-party trademarks

### Phase 4 — Production Hardening (P0/P1)
- [ ] **Auth in prod**: test sign-up → email confirm → sign-in → forgot → OTP reset → `subby://reset-password` deep link on real iOS + Android (Mailpit replaced by Supabase SMTP in prod — configure `auth.email` in `supabase/config.toml` or Supabase Dashboard → Auth → Email Templates → confirm `{{ .ConfirmationURL }}` uses `https://subby.app` / `subby://`). Verify `supabase/functions/delete-account` deployed + `auth.users` delete cascades
- [ ] **RLS & data**: `npm run test:rls` locally, then `supabase link --project-ref wiungqhmzgavfpvvlkmj && supabase db push` + `supabase db test` against hosted; verify `EXPO_PUBLIC_SUPABASE_ANON_KEY` read-only, service role never shipped
- [ ] **Offline**: airplane-mode queue test on prod bundle (add/edit/archive while offline → banner pending count → reconnect → `flushPendingOps` no dup/loss) — already covered by Maestro `offline` flow for `preview`
- [ ] **Notifications**: real-device test on prod bundle (allow `POST_NOTIFICATIONS` on Android 13+, verify `renewals` channel created, schedule → cancel → reschedule, reboot persistence) — best-effort, never blocks mutation (already `try/catch` in `notifications.ts`)
- [ ] **Demo data**: ensure `ENABLE_DEMO_DATA` + `scripts/seed` off in prod (`APP_VARIANT=production` + `__DEV__===false`), `Settings → Demo Data` hidden
- [ ] **Perf & a11y**: FlashList `keyExtractor`, `initialNumToRender`, `onEndReached` already fine; run Xcode Organizer + Android Vitals check, VoiceOver/TalkBack pass on Dashboard → Subscriptions → Detail → Add
- [ ] **Updates only (no Sentry v1)**: add `expo-updates` (EAS Update channel `production`) and test rollback via `eas update --channel production`; **skip Sentry/analytics for v1** per owner (no tracking disclosure needed). Revisit post-launch if crash volume warrants

### Phase 5 — Builds & Submission (P0)
- [ ] **Create demo review account (owner: yes):** create `app-review@subby.georgejsuarez.com` (or `app-review@subby.app` alias) in hosted Supabase via `supabase auth` + seed `Netflix`, `Spotify`, `iCloud+` + prefs via existing `src/db/seed-data.ts` / `scripts/seed`; document email + password (`SubbyReview2026!` or 1Password) for both App Store *App Review Information* and Play *App Access* (instructions: "Sign in with this account, subscriptions + renewals pre-populated"). Ensure account not flagged as `seeded` filter issue ( visible in `preview`/`production`)
- [ ] `eas build --profile production --platform ios` (IPA) + `--platform android` (AAB) on clean CI, `eas build:view` logs green, download artifacts to `build/` (gitignored) for local `eas submit --latest` dry-run
- [ ] **TestFlight**: `eas submit --profile production --platform ios --latest` → App Store Connect → add demo credentials `app-review@subby.georgejsuarez.com` in *App Review Information* + *Notes* for `POST_NOTIFICATIONS` ("User can toggle Settings → Reminders, notification fires day before at ~09:00 local"), distribute to Internal testers, verify on TestFlight
- [ ] **Play Internal Track**: `eas submit --profile production --platform android --latest` → Play Console Internal Track, complete *App Content* (Data Safety, Ads=No, Target audience, Content rating, Encryption), grant `app-review@subby.georgejsuarez.com` as tester (Closed → Internal list), verify on Play Internal
- [ ] Promote: TestFlight → External Beta → Production (phased 10% → 50% → 100%); Play Internal → Closed → Production (staged rollout). Tag `v1.0.1 (build 2)` → `git tag v1.0.1 && git push --tags`

### Phase 6 — Post-Launch (P1)
- [ ] Monitoring (no Sentry v1): EAS Update `emergency` channel, Supabase `auth.users` + `subscriptions` row count dashboards, Play Vitals + App Store Analytics + Xcode Organizer crashes only; revisit Sentry post-launch if needed
- [ ] Legal: annual re-host privacy policy, respond to Play Data Safety reviews within 14 days
- [ ] Ops: document `docs/release.md` — how to bump `expo.version`, rotate Asc API key / keystore, hotfix via `eas update`

## Verification

**Static / config gates (must pass before any `eas build --profile production`):**
```bash
npx expo install --check
npm run doctor          # 20/20, no SDK 57 patch drift
npm run lint && npm run format:check
npm run typecheck       # tsc --noEmit → 0
npm test && npm run test:rls  # Jest 246 + pgTAP RLS
npx expo config --json --type public | jq .expo.android.permissions,.expo.ios.bundleIdentifier
npx expo prebuild --clean && ls android/app/build.gradle ios/Subby.xcodeproj  # then rm -rf android ios
```

**Preview (prod-like, before store binaries):**
```bash
npm run build:preview:android && npm run build:preview:ios  # AAB/APK vs IPA
# Install on Pixel Android 15 + iPhone 15 sim: cold launch, splash, auth (sign-up/confirm/reset), tabs, add/edit/archive/delete, date picker (iOS spinner + Android calendar), keyboard/back, offline queue replay, notifications channel
```

**Store binaries:**
```bash
eas build --profile production --platform all --non-interactive --no-wait
eas build:view  # logs green, artifacts AAB + IPA
eas submit --profile production --platform ios --latest --verbose   # dry-run TestFlight
eas submit --profile production --platform android --latest --verbose # dry-run Play Internal
```

**Live store checks:**
* Play Console: Data Safety ✅, Content Rating ✅, App Content ✅, Internal Track tester install succeeds, `POST_NOTIFICATIONS` rationale accepted (`SCHEDULE_EXACT_ALARM` already removed)
* App Store Connect: App Privacy ✅, Encryption ✅, TestFlight internal build installs, Review → `Approved`

## Decisions (resolved with owner 2026-08-21)

* **Support URL / hosting:** Use `georgejsuarez.com` (Cloudflare) → `https://subby.georgejsuarez.com/privacy`, `/support`, `/terms`, `/delete` via Cloudflare Pages/Workers on the same zone. *Remaining action:* create `subby` DNS + Pages project and point App Store / Play privacy URLs there.
* **Developer accounts:** **None yet.** Create both before first production build — Apple Developer Program ($99/yr) + Google Play Console ($25 one-time). Recommend using `georgesuarezdev@gmail.com` (current EAS `owner` + privacy contact) as owner; enrollment takes 1–3 days and blocks `eas submit`.
* **Pricing & regions — owner wants monetizing ideas, ship v1 free:** **Recommendation (deferred to post-v1):** ship **Free, no IAP for v1** (simplifies Data Safety/App Privacy = no financial data). For v1.1 consider: (a) **Freemium** — free ≤5 subscriptions, $2.99/mo or $19.99/yr Pro for unlimited + CSV export + advanced insights; (b) **Tip jar** — one-time $4.99 "Support Subby"; (c) **No ads ever** (fits Finance trust). Any IAP requires StoreKit/Play Billing + `expo-in-app-purchases` or RevenueCat, plus updated Data Safety (Purchases) — defer until retention proven. Launch regions: **all available** except sanctioned (default in both consoles).
* **Credentials strategy:** **Let EAS manage remotely** (`credentialsSource: "remote"`) — no local `*.jks`/`*.p8` vault. Verify at `expo.dev/accounts/gjsuarezdev/credentials`.
* **Demo account for review:** **Yes** — create `app-review@subby.georgejsuarez.com` with seeded `Netflix`/`Spotify`/etc., include in App Store *App Review Information* + Play *App Access*.
* **Sentry / analytics:** **Ship v1 with no tracking** — skip Sentry/Amplitude; keep only `expo-updates` + store vitals. No tracking disclosure needed.
* **exact-alarm fallback:** **Drop exact timing claim** — remove `SCHEDULE_EXACT_ALARM` from `app.json`/`android.permissions` and rely on inexact (`POST_NOTIFICATIONS` only). Post-launch, if users complain about drift, re-evaluate exact vs user-education.

*No open blockers — all 7 decisions captured. Next step is Phase 0 audit.*

## Out of Scope / Deferred

* Web (`expo-sqlite` WASM Metro loader) — mobile-only per `.opencode/AGENTS.md`
* Custom native `android/` + `ios/` check-in — stay config-plugin driven unless `prebuild` exposes a required native fix
* Monetization (subscriptions IAP, paywall) — needs StoreKit/Play Billing + server entitlements
* Localization (only 6 currencies + English copy now)
