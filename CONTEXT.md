# Subby — Domain Glossary

Terms the codebase speaks. Keep this current: new modules that name a domain
concept get an entry; fuzzy terms get sharpened here.

## Core

- **Subscription** — a recurring expense the user tracks (name, amount,
  currency, billing cycle, next renewal, category, icon, notes, trial end).
  The core domain object; owned by a user and synced via Supabase.
- **Dashboard** — the home tab: monthly spend hero, quick stats, upcoming
  renewals (next 30 days), category breakdown.
- **Archived** — a subscription soft-deleted: it stops charging (reminder
  cancelled) and leaves the active list.

## Sync & offline

- **Sync coordinator** — `src/db/offline.ts`; the single module owning the
  mutation pipeline (reachability → write-or-enqueue → notification
  side-effects → cache → re-read → error classification) and the FIFO write
  queue flush.
- **Queued change** — a mutation made offline, waiting in the sync queue;
  queue-invisible by design (local state only ever shows synced rows).
- **Sidecar** — `notification_map`, the device-local table mapping a
  subscription to its scheduled renewal-reminder notification id.

## Auth & password flows

- **Recovery session** — the session granted by verifying a reset code/link
  (`recoveryPending`); it skips the current-password check.
- **Reset flow** — the signed-out journey: forgot-password → 6-digit code
  (Mailpit locally) or pasted link → recovery session → new password.
- **Change flow** — the signed-in journey: verify current password →
  `?from=settings&verified=1` handoff → new password form. The handoff is a
  URL contract because the app reloads mid-flow in Expo Go.
- **Gatekeeping** — `src/features/auth/auth-flow.ts`; the pure state machine
  deciding which form the reset screen shows (`entry | recovery | change |
verify`) and whether a visitor is redirected to the verify step.
- **Verify step** — the current-password screen signed-in users pass through
  before the change form.

## Demo data

- **Demo data / test account** — `test@subby.app`; dev-only seeded
  subscriptions and the Settings sections that manage them
  (`ENABLE_DEMO_DATA`).
