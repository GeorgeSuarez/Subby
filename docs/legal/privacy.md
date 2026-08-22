# Privacy Policy — Subby

_Last updated: August 2026_ — pending hosted publication at `https://subby.app/privacy`

## Overview

Subby ("the App") helps you track recurring subscriptions. This policy explains what data we collect and how we use it.

## Data we collect

- **Account data**: email + password hash (via Supabase Auth). We never see your plaintext password.
- **Subscriptions**: records you create (name, amount, currency, billing cycle, renewal date, category, notes).
- **Preferences**: currency, monthly budget, reminder setting, theme — synced per-account.
- **Purchase history**: if you upgrade to Subby Pro, Apple/Google share purchase receipts (product, expiry, transaction ID) so we can verify your entitlement. Receipts are verified server-side and stored as `is_pro` + `expires_at` in our database. We do not see your payment card details.
- **Device-local data**: scheduled reminder notification IDs live only on your device.

## How data is used

Solely to provide the App: showing subscriptions, computing totals, scheduling reminders, and unlocking Pro features after verification. We do not sell data, show ads, or use data beyond running the App.

## Storage

Data is stored with Supabase (US infrastructure) and on your device. Purchase verification uses App Store Server API / Google Play Developer API.

## Deletion

Delete your account anytime: Settings → Account → Delete account. This removes your account, subscriptions, preferences, and entitlements from our servers. Device-local data is removed with the app.

## Offline use

While offline, the App shows a locally cached copy and queues changes; they sync when connectivity returns. Entitlements are cached locally and checked for expiry even offline.

## Subscriptions & auto-renewal

Subby Pro subscriptions auto-renew via Apple App Store / Google Play. You can manage or cancel anytime in the App Store / Play Store subscription settings. Free trials (Yearly: 7-day) convert to paid unless canceled before the trial ends. See Terms of Use for renewal, cancellation, and refund details.

## Contact

georgesuarezdev@gmail.com
