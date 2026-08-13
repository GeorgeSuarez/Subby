# Subby

A minimalistic subscription dashboard for tracking and managing monthly recurring expenses. Offline-first, native-feel, built with a design-system-first architecture.

**iOS + Android · React Native 0.86 · Expo SDK 57 · React Compiler ON**

---

## Overview

Subby is a personal subscription tracker. Add recurring expenses (Netflix, Spotify, iCloud+, etc.), see your monthly/yearly spend at a glance, get reminded of upcoming renewals, and archive or delete subscriptions you no longer use. Accounts sync across devices via Supabase; the app works offline with cached data and a write queue that replays changes on reconnect.

The project was built as a portfolio piece to demonstrate modern React Native engineering: native stack + native tab navigation (not JS-based), Zustand selectors over React Context, FlashList virtualization with memoized primitive-only rows, Reanimated 4 worklet-driven animations, and a custom design token system with dark-first theming.

## Features

- **Dashboard** — animated monthly spend headline with count-up, upcoming renewals list (next 30 days), quick stats strip (yearly total, active count, biggest subscription)
- **Subscriptions list** — sort by name/cost/renewal date, filter by active/archived/all, full-text search, long-press native action sheet (Edit / Archive / Delete with two-step delete confirm)
- **Subscription detail** — hero tile with brand color, renewal countdown with tone-themed badges, effective monthly/yearly cost breakdown, edit/archive/delete actions
- **Add/Edit modal** — form with name, amount, billing cycle, next renewal date, category chips, icon + color picker, notes; live validation with field-level errors shown after touch or submit
- **Settings** — theme toggle (System / Light / Dark) with cross-fade transition, currency picker (6 currencies), monthly budget, renewal-reminder toggle, password change with current-password verification, account deletion, and a dev-only demo-data section
- **Native tab bar** — three tabs (Dashboard, Subscriptions, Settings) plus a floating add button using platform-native `UITabBarController` / Material Bottom Navigation
- **Offline-first** — reads serve a per-user cache when offline; changes made offline are queued and sync automatically on reconnect (never dropped); an offline banner shows pending-change counts with a retry action
- **Haptics** — selection ticks on chips/segmented controls, impact feedback on row taps, warning notification before destructive actions, success chime after save/wipe
- **Animations** — FAB-less design (Add is a tab); count-up on dashboard stats; spring entrance on empty-state; theme cross-fade via remount-keyed `Animated.View`

## Tech Stack

| Concern    | Choice                                                                 |
| ---------- | ---------------------------------------------------------------------- |
| Framework  | Expo SDK 57, React 19, React Native 0.86, React Compiler ON            |
| Navigation | `expo-router` with `unstable-native-tabs` (native stack + native tabs) |
| State      | `zustand` with selectors (no React Context for shared state)           |
| Database   | Supabase (Postgres, RLS per user) + SQLite for offline cache/queue     |
| Auth       | Supabase Auth — email/password, email confirmation, OTP-code resets    |
| Offline    | Per-user snapshot cache + FIFO write queue, flushed on reconnect       |
| Lists      | `@shopify/flash-list` v2 (auto-sizing, no `estimatedItemSize` needed)  |
| Images     | `expo-image` exclusively (never RN `Image`)                            |
| Animations | `react-native-reanimated` 4 + `react-native-gesture-handler`           |
| Styling    | `StyleSheet.create` + design tokens (no NativeWind)                    |
| Haptics    | `expo-haptics`                                                         |
| Icons      | SF Symbols (iOS) + Material drawables (Android) via `NativeTabs`       |

## Architecture

```
src/
  app/                          expo-router routes (thin re-exports)
    _layout.tsx                 Root providers + theme cross-fade
    (tabs)/_layout.tsx          NativeTabs: 4 triggers incl. center Add
    (tabs)/index.tsx            → DashboardScreen
    (tabs)/subscriptions.tsx    → SubscriptionsScreen
    (tabs)/add.tsx              Transparent redirect to /subscription/add
    (tabs)/settings.tsx         → SettingsScreen
    subscription/_layout.tsx    formSheet modal group
    subscription/[id].tsx       → DetailScreen
    subscription/add.tsx        → AddEditScreen
  features/                     Screen logic (testable without expo-router)
    dashboard/                  HeroSpend, RenewalsList, QuickStats
    subscriptions/              SortFilterBar, filter helpers
    subscription-detail/        DetailHero, RenewalCountdown, EffectiveCost
    add-subscription/           FormField, AmountInput, CyclePicker, etc.
    settings/                   ThemeSection, CurrencySection, DangerZone
  design/                       Tokens, theme store, 14 primitive components
  db/                           Schema, client, queries, seed data
  store/                        Zustand stores (subscriptions + UI prefs)
  utils/                        billing math, formatters, constants, haptics
  types/                        Domain types (Subscription, Cycle, Currency)
```

Route files are one-liners that re-export from `features/<area>/` — this keeps expo-router out of feature modules so screen logic stays Jest-testable without mocking the router.

See [`docs/architecture.md`](docs/architecture.md) for a deeper walkthrough of the data flow, theme resolution, list rendering, and animation pipelines.

## Getting Started

```bash
npm install
npm run start          # Metro bundler
# Press i for iOS simulator, a for Android emulator
```

> **Note:** Web is not supported — `expo-sqlite` requires a native runtime. Use the iOS simulator or an Android emulator/device.

Regenerate branded icons (cyan-on-dark recurring-arrow glyph):

```bash
npm run icons          # runs scripts/generate-icons.mjs (Node + sharp)
```

## Quality Gates

All four must pass before considering any change complete:

```bash
npm run typecheck      # tsc --noEmit        → 0 errors
npm run lint           # oxlint             → 0 errors, 0 warnings
npm test               # jest                → 117 tests across 8 suites
npx expo-doctor        # dependency audit    → 20/20 checks
```

Formatting is enforced with oxfmt: `npm run format` writes canonical formatting, `npm run format:check` verifies it in CI.

## Engineering Principles

Built following the [React Native skills guide](.opencode/AGENTS.md):

- **No `&&` for conditional rendering** — ternaries or `!!value` only (lint-enforced via `react/jsx-no-leaked-render`, run by oxlint)
- **Pressable, not Touchable** — never `TouchableOpacity`/`TouchableHighlight`
- **List rows receive primitive props only** — memoized rows with stable `onPressWithId(id)` callbacks, no inline objects or closures
- **State is ground truth** — derive visual values (totals, scales, opacities) during render, never store derived state in `useState`/`useEffect`
- **`.get()`/`.set()` on Reanimated shared values** — React Compiler compatibility
- **Native modals & menus** — `formSheet` presentation via expo-router; `Alert.alert` for destructive confirms (UIAlertController / material dialog)
- **CSS `boxShadow` string syntax** — not legacy `shadowColor`/`elevation` props
- **Hoisted Intl formatters** — created once at module scope, never inside render
- **`gap` for sibling spacing** — not margin on children
- **`borderCurve: 'continuous'`** — smooth rounded corners

## Build & Ship

EAS build profiles are defined in `eas.json`:

| Profile     | Distribution | iOS        | Android    |
| ----------- | ------------ | ---------- | ---------- |
| development | internal     | simulator  | APK        |
| preview     | internal     | TestFlight | APK        |
| production  | store        | App Store  | Play Store |

```bash
npm run build:preview:ios       # TestFlight QA build
npm run build:production:ios    # App Store submission build
npm run submit:ios              # submit latest production build to App Store
```

Before first submission, fill in `submit.production.appleId` and `appleTeamId` in `eas.json`, and run `npx eas init` to get a project ID for `app.json → extra.eas.projectId`.

## Visual Identity

- **Surface:** `#0B0F14` (dark) / `#F7F9FC` (light)
- **Accent:** `#22D3EE` (electric cyan)
- **Glyph:** ↻ recurring arrow — 75% ring with arrowhead, symbolizing cyclical billing
- **Typography:** System font, limited size scale — hierarchy via weight and color

Tokens live in `src/design/tokens.ts`. Icons generated from `scripts/generate-icons.mjs`.

## What I Learned

- **Native tabs are worth the API friction.** `expo-router/unstable-native-tabs` wraps `UITabBarController` / Material Bottom Navigation directly. The prop API differs from `@react-navigation/bottom-tabs` (e.g., `labelStyle: { default, selected }` instead of `tabBarActiveTintColor`), but the payoff is real native scroll-to-top, PiP avoidance, and platform-correct safe-area insets — all free.
- **React Compiler changes the idioms.** Manual `useMemo`/`useCallback`/`memo()` become noise in most cases. The one adjustment that matters: Reanimated shared values need `.get()`/`.set()` instead of `.value` — the compiler can't track property access on proxy objects.
- **Route files as thin re-exports.** Keeping expo-router imports out of `features/<area>/` means screen logic is Jest-testable in plain Node — no router mock needed. The route file is a one-liner: `export { DashboardScreen as default } from '@/features/dashboard'`.
- **Supabase as the source of truth with an offline queue.** Mutations run against the server when online and are enqueued in a FIFO SQLite queue when offline (queue-invisible — no temp ids or optimistic patching). The store re-reads after each mutation, keeping a single code path and eliminating stale-cache bugs at the cost of one extra query per mutation.

## What I'd Do Next

- **Push notifications for renewal reminders** — reminders are currently device-local (expo-notifications); cross-device reminders need Expo Push tokens + an Edge Function
- **Stats tab** — add a fifth tab with `victory-native-xl` charts: donut by category, monthly trend bar, top 5 most expensive (deferred during MVP scoping)
- **Export/import** — JSON + CSV export for data portability and backup
- **Offline write conflict resolution** — the FIFO queue replays in order (last-write-wins); explicit conflict handling would cover multi-device editing of the same row
- **Receipt scanning** — camera + Vision framework for auto-detecting amount/renewal date from a billing email screenshot (the `NSCameraUsageDescription` Info.plist entry is already in place)
- **EAS project wiring** — run `npx eas init`, paste the project ID into `app.json`, fill submit credentials, and ship the first TestFlight build

## License

See [LICENSE](LICENSE).
