# Plan: Monetizing Subby

> `PLAN.md` — monetization strategy + implementation blueprint for turning Subby from a free portfolio app into a sustainable paid product.

---

## 1. Context

### Why monetize

Subby is a polished, offline-first, Supabase-backed subscription tracker — a category where users already expect to pay (competitors like **Barefoot**, **Subly**, **Rocket Money**, **One Sec** charge $12–$40/yr). The app currently has **zero monetization**: no IAP config, no entitlements, no paywall, no ads, no affiliate links. The codebase is portfolio-grade but not revenue-grade.

### What success looks like

- App Store + Play Store approve and list a paid tier without policy violations.
- Free tier is genuinely useful (retention funnel), Pro tier is compelling enough to convert 2–5% of MAU.
- Recurring revenue via auto-renewable subscriptions (not just one-time purchase) so the product can fund ongoing costs (Supabase, push infra, future receipt-scanning).
- No regression to offline-first, RLS, or animation quality gates.

### Constraints from codebase exploration

- **Stack**: Expo SDK 57, `expo-router` native tabs/stack, Zustand, `expo-sqlite` (device-local cache/queue), Supabase (subscriptions + user_prefs), `expo-notifications`. See `.opencode/AGENTS.md` and `src/db/schema.ts`.
- **Platforms**: iOS + Android only — web intentionally unsupported. Monetization must use native IAP (StoreKit 2 / Google Play Billing), not Stripe web checkout.
- **Auth**: Supabase Auth (email/password + confirm + OTP recovery). Entitlements must be per-`user_id`, RLS-scoped — not per-device.
- **Offline**: Every mutation funnels through `src/db/offline.ts` (`applyMutation` → cache → re-read). Entitlement checks must work offline (cached) but be verified server-side to prevent spoofing.
- **UX brand**: dark-first, minimal, cyan accent, no ad real-estate in design tokens (`src/design/tokens.ts`).
- **EAS**: `eas.json` has build profiles + placeholder submit creds. No `react-native-purchases` / RevenueCat / `expo-iap` installed today (`package.json`).

---

## 2. Approach — Recommended Model: **Freemium with Auto-Renewable Pro Subscription**

### Why this model (and not alternatives)

| Option                                  | Verdict                   | Reason                                                                                                                      |
| --------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Freemium subscription (recommended)** | **Primary**               | Fits category norms, funds ongoing Supabase/hosting, App Store expects it. Higher LTV than one-time.                        |
| Lifetime one-time purchase              | Offer as secondary option | Captures price-sensitive users; Apple/Google allow "lifetime" IAP alongside subscriptions. Include but don't default to it. |
| Ads (AdMob)                             | **Reject**                | Breaks minimal dark brand, low eCPM for utility app, privacy/permissions regression, App Store "ad spam" risk.              |
| Affiliate / cashback on cancel          | Defer to Phase 3          | Interesting later (e.g., "cancel Netflix — try ...") but needs partnerships & compliance review first.                      |
| Tip / donation                          | Too weak                  | Portfolio apps see <0.2% conversion.                                                                                        |

### Pricing recommendation — APPROVED (with 7-day free trial)

| Product                  | Price                       | Notes                                                                                                                                            |
| ------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Subby Free**           | $0                          | Up to 5 subscriptions, core tracking usable — upgrade for unlimited                                                                              |
| **Subby Pro — Monthly**  | **$2.99 / mo**              | Low-friction entry; competitor median ~$3–5                                                                                                      |
| **Subby Pro — Yearly**   | **$19.99 / yr** (~$1.67/mo) | **Hero offer — 40–45% savings vs monthly, pushes yearly on paywall. Includes 7-day free trial (StoreKit introductory offer / Play free trial).** |
| **Subby Pro — Lifetime** | **$49.99 one-time**         | **First-class alongside subscriptions** (not hidden) — captures price-sensitive users. Shown as third option on paywall + Settings → Upgrade.    |

> Prices in parity via App Store Connect / Play Console pricing templates. Yearly trial is a StoreKit `introductoryOffer` (free trial 7 days) and Play `freeTrial` — monthly has no trial.

### Free vs Pro feature matrix — REVISED per feedback (5 free subscriptions, gate power features)

Principles: Free allows the **full core loop for up to five subscriptions** (track → see spend → get value) so the app retains & refers. Pro unlocks **unlimited tracking** and gates insights/reminders — power features heavy users hit naturally.

| Feature                            | Free                                      | Pro                                         |
| ---------------------------------- | ----------------------------------------- | ------------------------------------------- |
| Active subscriptions               | **Up to 5**                               | Unlimited                                   |
| Currencies                         | 1 default (user's pick)                   | All 6 + future                              |
| Dashboard hero / upcoming renewals | ✅                                        | ✅                                          |
| **Category breakdown / pie chart** | ❌ (teaser/blur + "Unlock with Pro" pill) | ✅                                          |
| Monthly ↔ yearly effective cost    | ✅ basic                                  | ✅ + weekly/daily breakdown                 |
| **Trials tracking (`trialEnds`)**  | ✅ basic list only                        | ✅ + push nudges / dedicated trials insight |
| **Renewal push reminders**         | ✅ (day-of only)                          | ✅ (1d / 3d / 7d before + customizable)     |
| Search / sort / filter             | ✅                                        | ✅                                          |
| Archive / notes / colors           | ✅                                        | ✅                                          |
| **Budget & forecast (month keys)** | ❌ (teaser)                               | ✅                                          |
| Multi-device sync                  | ✅                                        | ✅ (no gating — sync is core)               |
| Themes (system/light/dark)         | ✅                                        | ✅                                          |
| Receipt scanning / bank import     | —                                         | **Future Pro** placeholder                  |

### Monetization infrastructure — REVISED: direct StoreKit / Google Play Billing via `expo-iap`

```
Device                         Store                    Supabase
 ─────                         ─────                    ────────
 Purchase ─────────────→  StoreKit 2 / Play Billing
    │  transaction                │
    │  verify ─────────────→  Edge Function (verify receipt/JWS) → user_entitlements table (RLS)
    │                         │  App Store Server Notifications V2 / Play Developer Notifications (webhook)
    │  entitlement ←────────  Edge Function ─────────────────────────────→ user_entitlements
    │                         │
 Entitlement ←───────────  expo-iap (getAvailablePurchases + local JWS) ←─ (fallback read of entitlements for offline)
```

- **IAP SDK**: **`expo-iap`** (Expo SDK 57 native module, successor to `expo-in-app-purchases`) — direct StoreKit 2 + Google Play Billing Library 5. No RevenueCat vendor lock-in or fee. Handles `getProducts` / `requestPurchase` / `finishTransaction` / `getAvailablePurchases`. See https://docs.expo.dev/versions/v57.0.0/sdk/in-app-purchases/ for API.
- **Entitlements source of truth**: Supabase `user_entitlements` written by **Supabase Edge Function(s)** that (a) verify the on-device transaction receipt/JWS server-side on purchase, and (b) handle **App Store Server Notifications V2** + **Google Play Developer Notifications (RTDN)** webhooks for renewals/cancellations/expirations/billing issues. Client never writes `is_pro` directly (RLS denies client insert/update).
- **Client guard**: `useEntitlementStore` (Zustand) mirrors `expo-iap` `getAvailablePurchases()` / purchase listener + Supabase row; offline it serves last-cached value from SQLite KV (`sync_cache` pattern) with `expires_at` check. `finishTransaction` only after server confirms entitlement.

### Paywall UX — REVISED (five-subscription free tier; feature-gated triggers)

- **Triggers**: (1) tapping blurred Pro feature (pie chart, budget, forecast), (2) tapping advanced reminders (1d/3d/7d), (3) reaching the five-subscription free limit, (4) explicit "Go Pro" CTA in Settings + Dashboard insight strip.
- **Design**: native modal (`subscription/paywall` route group, `presentation: 'formSheet'` like add/edit), single screen: hero benefit bullets ("Unlimited tracking", "Category insights", "Budget & forecast", "Advanced reminders"), **three-way toggle Monthly / Yearly (hero, pre-selected, "Save 44% + 7-day free trial" badge) / Lifetime ($49.99)**, CTA, restore link, Terms/Privacy links, `×` dismiss. Follow App Store Guideline 3.1.2 — clearly state price, billing period, trial, auto-renewal.
- **Copy compliance**: price + period + trial terms shown per product; links to Privacy Policy + Terms of Use (see §5 3.1a — hosted required before App Review, local `docs/legal/*` fallback until hosted).
- **No dark pattern**: dismissible, not blocking launch; free tier remains usable within its five-subscription limit.

---

## 3. Files to Modify / Create

### App code (new)

| Path                                     | Purpose                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/store/useEntitlementStore.ts`       | Zustand store: `isPro`, `isLoadingEntitlements`, `entitlementSource` (`iap`/`supabase`/`cache`), `productId`, `expiresAt`, `hydrateEntitlements()`, selectors. Caches to SQLite `sync_cache` (`entitlement:<userId>`) + `expires_at` check offline.                                                     |
| `src/lib/purchases.ts`                   | **`expo-iap` wrapper**: `initIAP()`, `getProducts([monthly,yearly,lifetime])`, `requestPurchase(productId)`, `restorePurchases()` (`getAvailablePurchases` + verify), `finishTransaction(purchase)`, `addPurchaseListener()`. Guards on `Platform.OS !== 'web'`. Re-exports `Product`/`Purchase` types. |
| `src/lib/entitlements.ts`                | Supabase read helper for `user_entitlements`; RLS query (`select is_pro, product_id, expires_at`).                                                                                                                                                                                                      |
| `src/app/subscription/paywall.tsx`       | Paywall route (modal group).                                                                                                                                                                                                                                                                            |
| `src/features/paywall/PaywallScreen.tsx` | Paywall UI — 3-way toggle (Monthly/Yearly/Lifetime), feature bullets, CTA, restore, TOS/privacy links.                                                                                                                                                                                                  |
| `src/features/paywall/components/*`      | `PlanToggle`, `FeatureBullet`, `PaywallCTA`, `LifetimeOption`                                                                                                                                                                                                                                           |
| `src/features/paywall/usePaywall.ts`     | Hook: loads products via `getProducts`, handles `requestPurchase` → server verify → `finishTransaction`, restore, error mapping. No analytics in v1 (deferred).                                                                                                                                         |
| `src/db/schema.ts`                       | **Migration 7**: extend `sync_cache` usage for entitlements (`entitlement:<userId>`); no new SQLite table required.                                                                                                                                                                                     |
| `src/design/tokens.ts`                   | Optional: `paywall` semantic tokens if needed (likely reuse existing accent/positive).                                                                                                                                                                                                                  |
| `src/utils/limits.ts`                    | `PRO_FEATURES` (`'pieChart' \| 'budget' \| 'advancedReminders'`), `FREE_SUB_LIMIT = 5`, `canAddSubscription()`, `isProFeature(key)`, and `canUseFeature()`. Pure, Jest-tested.                                                                                                                          |

### App code (modify)

| Path                                                                           | What changes                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/_layout.tsx`                                                          | Init `expo-iap` on mount (`initConnection()`), hydrate entitlements alongside `hydrate()`/`hydratePrefs()`, subscribe to `purchaseUpdatedListener` + `purchaseErrorListener`, verify receipt server-side → `finishTransaction` on success. On sign-out reset store. |
| `src/app/subscription/_layout.tsx` (or create `src/app/(paywall)/_layout.tsx`) | Register paywall modal route (`presentation: 'formSheet'`, `headerShown: false`).                                                                                                                                                                                   |
| `src/features/dashboard/DashboardScreen.tsx`                                   | Blur/gate CategoryBreakdown, PieChart, InsightStrip budget forecast for free tier; inject "Go Pro" pill → paywall. No layout shift.                                                                                                                                 |
| `src/features/add-subscription/AddEditScreen.tsx`                              | Enforce the five-subscription free limit; Pro unlocks unlimited tracking.                                                                                                                                                                                           |
| `src/features/subscription-detail/DetailScreen.tsx`                            | Gate advanced cost breakdown rows behind `isProFeature()`.                                                                                                                                                                                                          |
| `src/features/settings/SettingsScreen.tsx`                                     | Add `ProSection` / `UpgradeCard` above `ThemeSection`; when `!isPro` show benefits + Go Pro CTA; when `isPro` show "Pro ✓ — Manage" (links to `https://apps.apple.com/account/subscriptions` / Play subscriptions) + Restore.                                       |
| `src/features/settings/components/*`                                           | New `ProSection.tsx` (or `UpgradeSection.tsx`).                                                                                                                                                                                                                     |
| `src/app/(tabs)/_layout.tsx`                                                   | Optional: Pro badge on Settings tab — keep clean for v1.                                                                                                                                                                                                            |
| `app.json`                                                                     | Add `expo-iap` plugin config if required (check SDK 57 docs), keep `usesCleartextTraffic`, `ITSAppUsesNonExemptEncryption = false`.                                                                                                                                 |
| `eas.json`                                                                     | No RevenueCat env needed. Ensure `com.subby.app` bundle identifiers. Add `APP_STORE_SERVER_NOTIFICATIONS_URL` / `PLAY_RTDN_URL` secrets for webhooks (server-only, not in client env).                                                                              |
| `.env` / `.env.local`                                                          | No client IAP secrets. Server secrets (`APP_STORE_SHARED_SECRET` / `PLAY_SERVICE_ACCOUNT_JSON`) live in Supabase secrets only.                                                                                                                                      |

### Supabase (new)

| Path                                                                     | Purpose                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/<ts>_add_user_entitlements.sql`                     | `user_entitlements` table: `user_id pk fk auth.users, is_pro bool default false, product_id text, expires_at bigint, entitlement_source text ('app_store'\|'play_store'\|'lifetime'), updated_at bigint`, RLS (`select` own only, no client insert/update — `service_role` via edge functions), grants to `authenticated` (select only). |
| `supabase/functions/verify-purchase/index.ts`                            | Deno Edge Function: verifies `expo-iap` purchase receipt/JWS server-side (App Store Server API / Play Developer API), upserts `user_entitlements`. Called by client after `requestPurchase`.                                                                                                                                             |
| `supabase/functions/iap-webhook/index.ts`                                | Deno Edge Function: handles **App Store Server Notifications V2** (signed JWS) + **Google Play RTDN** (Pub/Sub push → webhook). Validates signature, upserts `user_entitlements` for `DID_RENEW`, `EXPIRED`, `DID_FAIL_TO_RENEW`, `REFUND`, `REVOKE`.                                                                                    |
| `supabase/functions/iap-webhook/README.md` + `verify-purchase/README.md` | Local testing: `supabase functions serve iap-webhook` / `verify-purchase`.                                                                                                                                                                                                                                                               |
| `supabase/db/tests/rls.sql`                                              | Append pgTAP tests for `user_entitlements` RLS (anon denied, auth read own, auth cannot insert/update, service_role can upsert).                                                                                                                                                                                                         |

### Docs / config

| Path                           | Purpose                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `docs/monetization.md`         | Post-implementation: pricing, offering IDs, product IDs, webhook setup.                                 |
| `README.md`                    | Mention Pro tier (short).                                                                               |
| `scripts/maestro/paywall.yaml` | Optional: Maestro flow covering paywall triggers (mocked in dev via `ENABLE_DEMO_DATA`-style env flag). |

---

## 4. Reuse — Existing Code to Build On

| Existing                     | Path                                                                                                                        | How to reuse                                                                                                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zustand pattern              | `src/store/useSubscriptionsStore.ts`, `src/store/useUIStore.ts`                                                             | Clone selector + `create()` shape for `useEntitlementStore`; follow `react-state-minimize` (no derived state) and `useShallow` for collections.                                                 |
| Sync coordinator             | `src/db/offline.ts` (`applyMutation`, `readCache`/`writeCache`, `sync_cache`/`sync_queue`)                                  | Reuse cache helpers for entitlement caching (key `entitlement:<userId>`). Do **not** queue entitlement writes — they're server-driven via `verify-purchase` / `iap-webhook`.                    |
| Auth store + session         | `src/store/useAuthStore.ts`, `src/lib/supabase.ts`                                                                          | Supabase `userId` is passed as `appAccountToken` / `obfuscatedAccountId` on `requestPurchase` so server can map Store transaction → Supabase user. No RevenueCat `appUserID`.                   |
| Network layer                | `src/db/network.ts`                                                                                                         | Hydrate entitlements online, serve cache when `reachable === false` — same pattern as `hydratePrefs()`.                                                                                         |
| RLS migration pattern        | `supabase/migrations/20260812224817_add_subscriptions_and_user_prefs.sql`                                                   | Copy policy/grants shape for `user_entitlements` — `(select auth.uid()) = user_id`, explicit `grant` to `authenticated` (select only), no client insert/update.                                 |
| Edge Function precedent      | `supabase/functions/delete-account/index.ts`                                                                                | Same Deno + `supabase-js` + `serve` shape for `verify-purchase` + `iap-webhook`. Local serve via `supabase functions serve`.                                                                    |
| Design tokens + components   | `src/design/tokens.ts`, `src/design/components/*` (`Card`, `Button`, `Badge`, `Surface`)                                    | Build paywall with existing `Button`, `Card`, `Text`, `Badge`, `Surface`; reuse `accent`/`positive`/`warning` + `radius`/`spacing`/`motion`. No new color primitives.                           |
| Navigation                   | `src/app/_layout.tsx` (`Stack.Protected`), `src/app/(tabs)/_layout.tsx` (native-tabs)                                       | Paywall is a `Stack.Screen` with `presentation: 'formSheet'` in the same `Stack.Protected` guard (signed-in only). Keep `app.json` `expo-router` plugin.                                        |
| Feature folder convention    | `src/features/<area>/` (thin `app/` re-exports)                                                                             | New `src/features/paywall/` mirrors `dashboard/`/`settings/` layout; `src/app/subscription/paywall.tsx` is a one-liner re-export.                                                               |
| Formatting & billing helpers | `src/utils/format.ts` (`formatCurrency`, `formatCurrencyCompact`), `src/utils/billing.ts` (`parseDate`, `nextRenewalAfter`) | Use for paywall pricing display (`formatCurrency(19.99, currency)`), trial countdown.                                                                                                           |
| Haptics                      | `src/utils/haptics.ts`                                                                                                      | Selection tick on plan toggle, success chime on purchase.                                                                                                                                       |
| Constants / env              | `src/utils/constants.ts`, `src/utils/environment.ts` (`ENABLE_DEMO_DATA` gate)                                              | Add `PRO_PRODUCT_IDS` (`subby_pro_monthly`, `subby_pro_yearly`, `subby_pro_lifetime`), `PRO_FEATURES` enum, `FREE_SUB_LIMIT = 5`, and `ENABLE_PAYWALL_MOCK` dev flag similar to demo-data gate. |
| Quality gates                | `.opencode/AGENTS.md` Mandatory Quality Gates (`lint`, `typecheck`, `test`, `format:check`)                                 | Run after each phase; add Jest tests for `limits.ts` + `usePaywall` state machine (like `auth-flow.ts`).                                                                                        |

---

## 5. Steps — Implementation Checklist

### Phase 0 — Validate & prep (no code, decisions) — PRE-LAUNCH BLOCKER

- [x] **0.1 Pricing research**: **APPROVED** — $2.99/mo · $19.99/yr (~$1.67/mo, hero, 40–45% savings) · $49.99 lifetime. Verify StoreKit pricing tier maps correctly across top 5 locales before creating products.
- [x] **0.2 Trial**: **APPROVED** — **Yearly includes 7-day free trial** via StoreKit `introductoryOffer` + Play `freeTrial`; monthly has no trial; lifetime has no trial.
- [ ] **0.3 IAP product config (no RevenueCat)**: create StoreKit products + Google Play products directly: `subby_pro_monthly` (auto-renewable), `subby_pro_yearly` (auto-renewable + 7-day intro), `subby_pro_lifetime` (non-consumable). No RevenueCat project needed.
- [ ] **0.4 App Store Connect + Play Console**: set pricing, subscription group ("Subby Pro"), localization, review notes/screenshot placeholder for paywall. Configure **App Store Server Notifications V2 URL** and **Play RTDN Pub/Sub → webhook URL** to point at `iap-webhook` edge function.
- [ ] **0.5 Privacy**: update App Privacy — IAP collects `purchase history`; add to `app.json` `privacyManifests` if needed. Ensure `ITSAppUsesNonExemptEncryption = false` stays set.

### Phase 1 — Infrastructure (IAP SDK + entitlements) — via `expo-iap` direct

- [ ] **1.1 Install SDK**: `npm add expo-iap` (Expo SDK 57 compat). Run `npx expo prebuild` sanity check (no commit of `ios/`/`android/`). Verify `expo-iap` exposes `initConnection`, `getProducts`, `requestPurchase`, `finishTransaction`, `getAvailablePurchases`, `purchaseUpdatedListener`, `purchaseErrorListener` per https://docs.expo.dev/versions/v57.0.0/sdk/in-app-purchases/.
- [ ] **1.2 `src/lib/purchases.ts`**: implement `initIAP()`, `getProducts(skus)`, `requestPurchase(sku, { appAccountToken: userId })`, `restorePurchases()` (→ `getAvailablePurchases` + server verify), `finishTransaction(purchase)`, listener helpers. Guard `Platform.OS !== 'web'`. Unit-testable by injecting mock `expo-iap`. Must pass `appAccountToken` (iOS) / `obfuscatedAccountId` (Android) so server can map transaction → Supabase user.
- [ ] **1.3 `src/store/useEntitlementStore.ts`**: Zustand store with `isPro`, `entitlementSource` (`iap`/`supabase`/`cache`), `productId`, `expiresAt`, `hydrateEntitlements()`. Cache to `sync_cache` (`entitlement:<userId>`) with `expires_at`; check expiry even offline.
- [ ] **1.4 Supabase migration**: `user_entitlements` table + RLS (select own only, no client write) + grants (select to `authenticated`). Add pgTAP tests in `supabase/db/tests/rls.sql`. Test locally with `supabase db reset` + `npm run test:rls`.
- [ ] **1.5 Edge Functions**: (a) `verify-purchase` — verifies receipt/JWS via App Store Server API / Play Developer API, upserts `user_entitlements`; (b) `iap-webhook` — validates App Store Server Notifications V2 (JWS) + Play RTDN signature, upserts on `DID_RENEW`/`EXPIRED`/`REFUND`/etc. Deploy with `--no-verify-jwt`, store secrets via `supabase secrets set APP_STORE_* PLAY_*`.
- [ ] **1.6 Wire `_layout.tsx`**: on mount `initConnection()`; on `isSignedIn`/`userId` change hydrate entitlements; subscribe to `purchaseUpdatedListener` → call `verify-purchase` → `finishTransaction` on success; `purchaseErrorListener` → surface error. On sign-out reset store. Offline: serve `sync_cache`.
- [ ] **1.7 Dev mock**: `EXPO_PUBLIC_ENABLE_PAYWALL_MOCK` flag (like `ENABLE_DEMO_DATA`) that stubs `isPro: false` + fake `getProducts` so paywall can be QA'd without real purchases/sandbox.

### Phase 2 — Gating & paywall UI — 5-sub free tier, feature-gated Pro

- [ ] **2.1 `src/utils/limits.ts`**: export `PRO_FEATURES`, `FREE_SUB_LIMIT = 5`, `canAddSubscription()`, and `isProFeature(key)` — pure, Jest-tested.
- [ ] **2.2 `src/features/paywall/*` + `src/app/subscription/paywall.tsx`**: build paywall per §2 (3-way toggle Monthly/Yearly/Lifetime, Yearly pre-selected + "Save 44% + 7-day free trial" badge). Use `Card`/`Button`/`Badge`/`Surface`, `tokens.*`, `formatCurrency`. States: loading (ActivityIndicator), error, restore. CTA calls `requestPurchase` → `verify-purchase` → `finishTransaction`. Follow Guideline 3.1.2 copy.
- [ ] **2.3 `AddEditScreen`**: gate the sixth free subscription behind the paywall; Pro users remain unlimited.
- [ ] **2.4 Gate dashboard**: blur/teaser for `CategoryBreakdown`/`PieChart`/`InsightStrip` budget forecast when `!isPro` — show "Unlock with Pro" pill → paywall. No layout shift.
- [ ] **2.5 Gate advanced features**: `RemindersSection` (1d/3d/7d options), `BudgetSection` → `if (!isPro) router.push('/subscription/paywall')` with warning haptic. Day-of reminder + basic trials list stay free.
- [ ] **2.6 `SettingsScreen` ProSection**: when `!isPro` show upgrade card (benefits + "Go Pro" CTA → paywall); when `isPro` show "Pro ✓ — Manage" (links to `https://apps.apple.com/account/subscriptions` / Play subscriptions) + Restore. Order: `ProSection` above `ThemeSection`.
- [ ] **2.7 Analytics: DEFERRED per feedback** — no PostHog/Amplitude in v1. Keep only `__DEV__` `console.log` for `paywall_viewed`/`purchase_*` during QA; revisit post-launch.

### Phase 3 — Polish, compliance, launch prep — PRE-LAUNCH BLOCKER

- [ ] **3.1 App Store compliance**: paywall copy states price + period + auto-renewal + trial terms; includes links to [Privacy Policy] + [Terms of Use]; Restore Purchases button works; subscription group in App Store Connect configured. **3.1a Legal pages — BLOCKING**: no hosted Privacy/Terms yet — create `docs/legal/privacy.md` + `terms.md`, host them (e.g., `https://subby.app/privacy` + `/terms` or Supabase-hosted), add URLs to paywall. Until hosted, render local markdown in-app via `expo-web-browser` fallback. App Review **requires** these links on any subscription paywall.
- [ ] **3.2 Entitlement verification hardening**: server-side `verify-purchase` is primary; `iap-webhook` handles renewals/expirations. Add cron/edge-function belt-and-suspenders: `expires_at < now` → `is_pro = false`. Handle `REFUND`/`REVOKE` → revoke Pro.
- [ ] **3.3 Offline entitlement**: verify `readCache('entitlement', userId)` survives airplane mode and **does not** grant Pro after `expires_at`. Add test (cache expiry check).
- [ ] **3.4 QA matrix**: test (1) fresh install (free) → add 5 subs, sixth opens the paywall; (2) tap a gated insight/budget/reminder feature → paywall; (3) sandbox purchase Yearly with trial → `isPro` true, gates and unlimited tracking unlock without restart; (4) purchase Lifetime → `is_pro` with no expiry; (5) restore on second device (same Supabase login, same Store account) → Pro restored via `getAvailablePurchases`; (6) cross-account (same Store, different Supabase) → Pro **not** leaked (entitlement is per-Supabase `user_id` via `appAccountToken` mapping). Document in FAQ.
- [ ] **3.5 Pricing change ready**: structure `limits.ts` so price display comes from `getProducts()` (store-driven) — no app update needed for price change; only copy change needs update.
- [ ] **3.6 Screenshots + review notes**: update App Store screenshots to show paywall (Apple requires IAP screenshot), write review notes explaining the five-subscription free tier, unlimited Pro tracking, trial terms, and restore flow.
- [ ] **3.7 Post-launch backlog** (not blocking): receipt scanning (future Pro+ tier), bank import (higher tier), family sharing, affiliate cancel-flow.

---

## 6. Verification

### Automated

```bash
# After any code change (per .opencode/AGENTS.md gates)
npm run lint
npm run typecheck
npm test -- --passWithNoTests
npm run format:check

# RLS (after migration)
npm run test:rls
# or: supabase db test --local

# Supabase local stack
supabase start
supabase functions serve verify-purchase --debug   # test receipt verification
supabase functions serve iap-webhook --debug       # test App Store / Play webhooks
supabase db reset  # verify migration 7 applies cleanly
```

- **Unit tests** (new):
  - `src/utils/limits.test.ts` — `isProFeature` matrix for each `PRO_FEATURES` key (free vs Pro); no sub-limit tests.
  - `src/lib/purchases.test.ts` — mock `expo-iap`, verify `getProducts` returns SKUs, `requestPurchase` → verify → `finishTransaction` flow, `restorePurchases` sets `isPro`, error mapping.
  - `src/store/useEntitlementStore.test.ts` — hydrate from cache, from `getAvailablePurchases`/server verify, expiration handling (`expires_at` check offline; lifetime has no expiry).
  - `supabase/db/tests/rls.sql` — `user_entitlements` pgTAP: anon denied, auth read own, auth cannot insert/update, service_role can upsert.
- **Edge function tests**:
  - `curl -H "Authorization: Bearer <anon>" -d '{"purchaseToken":"...","productId":"subby_pro_yearly","userId":"..."}' http://127.0.0.1:54321/functions/v1/verify-purchase` → verify row in `user_entitlements`.
  - Simulate App Store Server Notification V2 JWS + Play RTDN push to `iap-webhook` → verify `DID_RENEW`/`EXPIRED`/`REFUND` updates.

### Manual

- [ ] **Free user** fresh install → add 5 subs, sixth attempt shows the paywall; gated features (pie, budget, forecast, advanced reminders) show teaser/blur + "Unlock with Pro" pill → paywall on tap, dismiss returns to functional free app.
- [ ] **Paywall** toggle Monthly/Yearly/Lifetime → price updates via `formatCurrency` from `getProducts()`, Yearly badge shows "Save 44% + 7-day free trial".
- [ ] **Purchase flow** (sandbox): Yearly with trial → success haptic, `isPro` flips true after `verify-purchase` + `finishTransaction`, previously gated features and subscription tracking beyond five unlock without restart.
- [ ] **Purchase Lifetime**: sandbox buy `subby_pro_lifetime` → `is_pro` true with `expires_at` null (no expiry).
- [ ] **Restore**: delete app, reinstall, sign in same Supabase account → `getProducts` + `getAvailablePurchases` → tap Restore → Pro restored (server re-verifies).
- [ ] **Offline**: airplane mode → gated features stay gated (free) or Pro stays Pro if cached & `expires_at` not passed; Lifetime stays Pro indefinitely. Tapping gate shows paywall from cache (no network needed for UI, purchase blocked offline).
- [ ] **Account switch**: sign out → entitlement resets; sign in different Supabase account → correct Pro state for that account (no leak via `appAccountToken` mapping).
- [ ] **Maestro**: `scripts/maestro/paywall-gate.yaml` — add a sub (free, should succeed), tap pie chart teaser, assert paywall visible, dismiss; `paywall-purchase-mock.yaml` with `ENABLE_PAYWALL_MOCK=1`. Run `maestro test scripts/maestro/paywall-gate.yaml` against `exp://127.0.0.1:8081` on simulator.
- [ ] **Store review**: submit TestFlight build with sandbox tester, verify App Store Connect shows 3 products "Ready to Submit", subscription group configured, paywall shows privacy/terms links, restore works, trial terms displayed.

### Success metrics (post-launch — manual / Store Connect until analytics added)

- Paywall view → purchase conversion (target 2–5% of MAU, 10–15% of viewers) — measure via Store Connect + `verify-purchase` counts until analytics provider chosen.
- Free → Pro yearly share (target >60% of purchases) vs lifetime mix.
- Trial → paid conversion (target 30–45% for Yearly 7-day trial).
- Churn at 1/3/6 months; refund rate <2%.

---

## 7. Decisions — RESOLVED (from review feedback)

1. **Pricing & trial — APPROVED**: $2.99/mo · $19.99/yr (hero, 7-day free trial) · $49.99 lifetime. Locked.
2. **Primary limiter — RESOLVED: five free subscriptions**. Free tier supports up to five active subscriptions; Pro unlocks unlimited tracking and gates `pieChart`/`budget`/`advancedReminders`.
3. **Lifetime — APPROVED first-class** alongside subscriptions (3-way toggle on paywall + Settings).
4. **IAP provider — RESOLVED: direct StoreKit/Google Billing via `expo-iap`**, not RevenueCat (avoid vendor lock-in). App owns receipt/JWS verification via Edge Functions.
5. **Timeline — PRE-LAUNCH BLOCKER**: Phase 1+2 ship together before App Store submission; no feature-flag split.
6. **Legal pages — BLOCKING, not yet hosted**: create `docs/legal/privacy.md` + `terms.md` and host (e.g., `https://subby.app/privacy`); local in-app fallback until hosted. Required for Guideline 3.1.2.
7. **Analytics — DEFERRED**: no provider in v1; keep `__DEV__` logs only. Revisit post-launch.

---

## 8. Risks & Mitigations — REVISED for `expo-iap` + five-subscription-free tier

| Risk                                                    | Mitigation                                                                                                                                                                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App Review rejection (Guideline 3.1.1/3.1.2 — IAP copy) | Paywall states price/period/trial/auto-renewal per product, includes Privacy + Terms links (hosted — see 3.1a), Restore button, subscription group configured. Test with sandbox reviewer + review notes.                    |
| Entitlement spoofing (client-only check)                | `verify-purchase` verifies receipt/JWS server-side against App Store Server API / Play Developer API; `iap-webhook` verifies V2/RTDN signatures. Client cache is read-only; RLS denies client writes to `user_entitlements`. |
| Offline Pro bypass                                      | Cache stores `expires_at`; check expiry even offline (Lifetime `null` = no expiry). Grace period 24h max for renewals.                                                                                                       |
| Store webhook delay / `verify-purchase` failure         | Client retries verification; `getAvailablePurchases` reconciles on next launch/restore. Webhook is not sole path — `verify-purchase` on purchase is primary.                                                                 |
| Price increase backlash                                 | App Store price-change consent flow for existing subscribers; grandfather where possible. Price display is store-driven via `getProducts()` so no app update needed for price tweak.                                         |
| Paywall copy confusion (3 options + trial)              | Yearly pre-selected with clear "7-day free, then $19.99/yr" copy; test copy with sandbox + TestFlight external testers.                                                                                                      |
| Legal pages not hosted at review time                   | Ship `docs/legal/*` local fallback and link to hosted URL placeholder — but do not submit until hosted URLs are live (blocking).                                                                                             |

---

## 9. Future Monetization Backlog (not in v1 scope)

- **Pro+ tier**: receipt OCR (camera), bank-statement import (Plaid) — $39.99/yr.
- **Team / family sharing**: 5 seats for $29.99/yr (needs Supabase org model).
- **Smart cancellation**: affiliate revenue when user archives a sub (partner offers).
- **Annual spend report PDF**: deferred paid report with charts (shareable).
- **Re-engagement**: winback offer via StoreKit `offer` (50% off 1 month after cancel) — no RevenueCat needed.

---

_Scope locked per feedback (five-subscription-free + `expo-iap` + lifetime + pre-launch). Ready for `plannotator_submit_plan`._
