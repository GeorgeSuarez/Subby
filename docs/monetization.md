# Subby Monetization — Pro Tier (expo-iap, direct StoreKit / Play Billing)

> Source of truth for product IDs, pricing, entitlements, and store configuration.
> See `PLAN.md` §2–§5 for implementation blueprint.

## Products

| SKU                  | Store type                  | Price                               | Trial                                                              | App Store Group |
| -------------------- | --------------------------- | ----------------------------------- | ------------------------------------------------------------------ | --------------- |
| `subby_pro_monthly`  | Auto-renewable subscription | $2.99 / month                       | —                                                                  | Subby Pro       |
| `subby_pro_yearly`   | Auto-renewable subscription | $19.99 / year (~$1.67/mo, Save 44%) | 7-day free trial (StoreKit `introductoryOffer` + Play `freeTrial`) | Subby Pro       |
| `subby_pro_lifetime` | Non-consumable (one-time)   | $49.99                              | —                                                                  | —               |

- Bundle ID: `com.subby.app` (iOS + Android, see `app.json`).
- Subscription group name: **Subby Pro** (App Store Connect) — contains monthly + yearly.
- Localization: at least `en-US` for v1; pricing parity via App Store pricing templates + Play pricing templates.

## Free vs Pro gating

- **Free**: up to 5 subscriptions, 1 currency, hero/renewals, basic trials list, day-of reminder, search/sort/filter, archive/notes/colors, themes, multi-device sync.
- **Pro gates**: unlimited subscription tracking, `pieChart` (CategoryBreakdown + PieChart), `budget` + `forecast`, `advancedReminders` (1d/3d/7d), `trialsNudge` (push nudges).
- Free accounts can track up to 5 subscriptions; Pro unlocks unlimited tracking.

The five-subscription limit and Pro feature keys live in `src/utils/limits.ts`.

## Store configuration — App Store Connect (iOS)

1. Create subscription group **Subby Pro** under `com.subby.app`.
2. Create products `subby_pro_monthly` + `subby_pro_yearly` inside the group. For `subby_pro_yearly`, add introductory offer: free trial 7 days, 1 per user.
3. Create non-consumable `subby_pro_lifetime` (outside the group).
4. Add localization (display name, description) — paywall copy must match: price, period, renewal, trial terms.
5. Set **App Store Server Notifications V2 URL** to `https://<project>.supabase.co/functions/v1/iap-webhook` (Edge Function `iap-webhook`, `--no-verify-jwt`). Configure with Apple Developer → App Store Server Notifications.
6. Add screenshot of paywall for App Review (required for IAP).
7. Review notes: explain the free tier supports up to 5 subscriptions, trial terms (7-day free then $19.99/yr, auto-renew), Restore Purchases exists.

## Store configuration — Google Play Console (Android)

1. Create products `subby_pro_monthly` + `subby_pro_yearly` as subscriptions (base plans), `subby_pro_lifetime` as one-time product.
2. For yearly, add free trial 7 days (base plan offer).
3. Configure **Real-time developer notifications (RTDN)**: create Pub/Sub topic → push subscription → webhook `https://<project>.supabase.co/functions/v1/iap-webhook`. Give Play service account `pubsub.publisher` + grant.
4. Add paywall screenshot, subscription benefits text.
5. Review notes mirror iOS.

## Client — expo-iap

- Package: `expo-iap` 5.3.1+ (Expo SDK 57, `expo: *`, `react: *`, `react-native: *` peerDeps).
- API: `initConnection()`, `getProducts({ skus })`, `requestPurchase({ sku, appAccountToken })`, `finishTransaction({ purchase, isConsumable: false })`, `getAvailablePurchases()`, `purchaseUpdatedListener`, `purchaseErrorListener`.
- On `requestPurchase`, pass `appAccountToken: supabaseUserId` (iOS) / `obfuscatedAccountId` so server can map Store transaction → Supabase `user_entitlements.user_id`.
- Entitlements cached locally in `sync_cache` key `entitlement:<userId>` with `expires_at`; `isPro` checks expiry even offline (lifetime `expires_at: null` never expires).
- See `src/lib/purchases.ts` + `src/store/useEntitlementStore.ts` + `src/app/_layout.tsx` wiring.

## Server — Supabase entitlements

### Table

`user_entitlements` (`user_id` PK FK `auth.users`, `is_pro bool`, `product_id text`, `expires_at bigint nullable`, `entitlement_source text` (`app_store`|`play_store`|`lifetime`), `updated_at bigint`).

RLS: `select` own rows only (`(select auth.uid()) = user_id`), no client insert/update/delete (only `service_role` via Edge Functions). Grants: `select` to `authenticated`.

Migration: `supabase/migrations/<ts>_add_user_entitlements.sql` (see `PLAN.md` §3).

### Edge Functions

- **`verify-purchase`** (`supabase/functions/verify-purchase/index.ts`): called by client after `requestPurchase` / `getAvailablePurchases`. Verifies receipt/JWS against App Store Server API / Play Developer API, upserts `user_entitlements`. Returns `{ isPro, expiresAt }`.
- **`iap-webhook`** (`supabase/functions/iap-webhook/index.ts`): receives App Store Server Notifications V2 (signed JWS) + Play RTDN pushes. Validates signature, upserts on `DID_RENEW` / `EXPIRED` / `DID_FAIL_TO_RENEW` / `REFUND` / `REVOKE`.

Both deployed `--no-verify-jwt`; secrets via `supabase secrets set APPLE_* GOOGLE_*`.

## Paywall UX

- Route: `src/app/subscription/paywall.tsx` → `src/features/paywall/PaywallScreen.tsx` (`presentation: 'formSheet'`).
- Triggers: tap on blurred Pro feature (pie/budget/forecast/advanced reminders), reaching the five-subscription free limit, Settings → Go Pro, or the Dashboard insight strip. Add remains free until the limit is reached.
- Design: 3-way toggle Monthly / Yearly (hero, pre-selected, Save 44% + trial badge) / Lifetime, benefit bullets, CTA, Restore, Privacy/Terms links, `×` dismiss. Prices from `getProducts()` via `formatCurrency`.
- Compliance: Guideline 3.1.2 copy (price + period + renewal + trial), Restore button, hosted Privacy/Terms (`https://subby.app/privacy` + `/terms`, local `docs/legal/*` fallback).
- Dev mock: `EXPO_PUBLIC_ENABLE_PAYWALL_MOCK=1` stubs `isPro: false` + fake `getProducts`.

## Verification

- `npm run test:rls` for `user_entitlements` pgTAP.
- Manual: free add 6+ OK, gate teaser → paywall, sandbox buy yearly (trial) → gates unlock without restart, buy lifetime → `expires_at` null, restore on second device, offline cache expiry, cross-account no-leak.
- Maestro: `scripts/maestro/paywall-gate.yaml` etc.
