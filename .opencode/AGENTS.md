# Subby — Agent Guide

A minimalistic React Native subscription dashboard built with Expo SDK 57,
expo-router (native stack + native tabs), Zustand, and expo-sqlite.

## Commands

Run these from the project root before considering any task complete:

| Task                | Command                          |
| ------------------- | -------------------------------- |
| Install deps        | `npm install`                    |
| Start dev ( Expo )  | `npm run start`                  |
| Start iOS           | `npm run ios`                    |
| Start Android       | `npm run android`                |
| Lint                | `npm run lint`                   |
| Lint + autofix      | `npm run lint:fix`               |
| Typecheck           | `npm run typecheck`              |
| Unit tests          | `npm run test`                   |
| Watch tests         | `npm run test:watch`             |
| Doctor (dep audit)  | `npm run doctor`                 |
| Regenerate icons    | `npm run icons`                  |
| Prebuild iOS        | `npm run prebuild:ios`           |
| Prebuild Android    | `npm run prebuild:android`       |
| Build dev ( iOS )   | `npm run build:dev:ios`         |
| Build dev ( Android)| `npm run build:dev:android`     |
| Build preview ( iOS)| `npm run build:preview:ios`     |
| Build preview ( Droid) | `npm run build:preview:android` |
| Build production iOS| `npm run build:production:ios`  |
| Build prod ( Android)| `npm run build:production:android` |
| Submit to App Store | `npm run submit:ios`             |
| Submit to Play Store| `npm run submit:android`         |

## Local Supabase stack

- Stack lives in `supabase/` (CLI v2.113.0). Start with `supabase start`, stop
  with `supabase stop`. Requires Docker Desktop running.
- Emails (confirmation links, password resets) land in **Mailpit** at
  http://127.0.0.1:54324 — there is no real SMTP in local dev.
- Other URLs: Studio http://127.0.0.1:54323, API http://127.0.0.1:54321
  (publishable key `sb_publishable_...` printed by `supabase start`).
- `.env.local` points the app at the local stack and overrides `.env` (hosted
  project) in dev. `.env` is the hosted `wiungqhmzgavfpvvlkmj` project — do not
  edit it for local work. iOS simulator reaches the host via `127.0.0.1`;
  Android emulator needs `10.0.2.2`; physical devices need the Mac's LAN IP.
- Email confirmation is ON (`enable_confirmations = true` in `supabase/config.toml`).
- `supabase/migrations/` holds the schema: `subscriptions` and `user_prefs`
  with RLS (all policies `(select auth.uid()) = user_id` — keep the
  `(select …)` initplan wrapper and the explicit `grant` on new tables;
  PostgREST also refuses filter-less `delete`, so wipes use `gte(created_at, 0)`).
- Schema workflow: imperative migrations — create with `supabase migration new <name>`,
  iterate with `supabase db query` / `supabase db diff`, commit with
  `supabase db pull <descriptive-name> --local --yes`.
- Restart after `config.toml` changes: `supabase stop && supabase start` (there
  is no `supabase restart` command).
- Auth emails redirect to `site_url` (http://127.0.0.1:3000) after the token is
  consumed. Serve the confirmation page with `npm run auth:confirm-page`
  (scripts/serve-auth-confirm.mjs) so clicks land on a real page instead of a
  dead connection. Tokens are single-use — a second click on the same link
  always shows "invalid or expired".
- Password reset: `forgot-password` (auth group) → `resetPasswordForEmail` with
  `redirectTo`. A custom recovery template (`supabase/templates/email/recovery.html`,
  wired in `config.toml` under `[auth.email.template.recovery]`) renders BOTH
  `{{ .Token }}` (a 6-digit code) and `{{ .ConfirmationURL }}` (the verify
  link) — the available mailer vars are `Token`, `TokenHash`, `ConfirmationURL`,
  `SiteURL`, `RedirectTo`, `Email` (NOT `TokenURL`, which renders empty). The
  reset screen
  (`/reset-password`, router root) takes the code via
  `verifyOtp({ email, token, type: 'recovery' })` (store `verifyRecoveryCode`),
  with a paste-link fallback (`verifyRecoveryLink` / `handleAuthUrl` → `setSession`;
  supabase-js's `detectSessionInUrl` is a no-op on RN). `handleAuthUrl` never
  feeds stale link tokens into `setSession` over a live session — a failed
  `_getUser` ("Auth session missing") makes supabase-js wipe the stored
  session, so same-user links just set `recoveryPending` and cross-account
  links are ignored. The new-password form uses `updateUser({ password })`. Settings → Account → Reset password lands on
  `/verify-password` first (current-password check via `verifyCurrentPassword`,
  i.e. `signInWithPassword`), then `/reset-password?from=settings&verified=1`;
  any other signed-in visit to the reset screen is redirected through the same
  verify step.

## Build & Ship Config

- `eas.json` defines three profiles: **development** (internal simulator/APK for
  dev), **preview** (internal TestFlight/APK for QA), **production** (App Store
  + Play Store submission).
- `app.json` configures the Subby bundle identifier `com.subby.app` and the
  iOS `.icon` asset catalog (`assets/expo.icon`) for the new Apple Icon
  Composer format (dark gradient fill + cyan recurring-arrow layer).
- `assets/images/` is regenerated by `npm run icons` (Node + sharp). Do not
  hand-edit those PNGs — edit `scripts/generate-icons.mjs` source SVGs instead.
- Before the first EAS build, run `npx eas init --id=<project-id>` (or create a
  new project with `npx eas init`) and paste the project id into the `extra.eas.projectId`
  field in `app.json`. The project id ties local builds to the cloud EAS project.
- `submit.production.appleId`, `ascAppId`, `appleTeamId`, and
  `serviceAccountKeyPath` in `eas.json` are placeholder values. Replace them
  with the real Apple/Google credentials before submitting — or rely on
  interactive `eas submit` prompts which let you fill them on first run.
- Production builds auto-increment the build number via `autoIncrement: true`.
- Artifacts go to `build/Subby.ipa` (iOS) and `build/Subby.apk` (Android).

## Mandatory Quality Gates

After **any** code change, run these and resolve all errors before stopping:

```bash
npm run lint
npm run typecheck
npm test -- --passWithNoTests
```

## Tech Stack (do not change without user approval)

- **Framework**: Expo SDK 57, React 19, React Native 0.86, React Compiler ON
- **Navigation**: `expo-router` with `unstable-native-tabs` (native stack + native tabs).
  Never swap to JS-based `@react-navigation/stack` or `bottom-tabs`.
- **State**: `zustand` with selectors (NO React Context for shared app state).
  UI prefs persist via `zustand/middleware` (MMKV/AsyncStorage).
- **DB**: Supabase (Postgres) is the source of truth for subscriptions and
  account prefs — RLS-scoped per user. `expo-sqlite` remains only for
  device-local bookkeeping (the `notification_map` sidecar and KV prefs).
  SQLite schema lives in `src/db/schema.ts`; Supabase queries in
  `src/db/queries.ts` (same API as before, so stores are unchanged).
- **Lists**: `@shopify/flash-list` for every scrollable collection — never `ScrollView` + `.map`.
- **Images**: `expo-image` only (never `react-native`'s `Image`).
- **Animations**: Reanimated + gesture-handler. Animate **transform/opacity only**.
- **Styling**: `StyleSheet.create` + tokens in `src/design/tokens.ts`. No NativeWind.

## Code style rules (auto-enforced where possible)

These come from the React Native skills guide and must be followed:

1. **No `&&` for conditional rendering** — use ternary or `!!value`. ESLint rule
   `react/jsx-no-leaked-render` is enabled to catch this.
2. **All strings inside `<Text>`** — never as a direct child of `<View>`.
3. **List items receive only primitive props** — no inline objects, no inline styles,
   no inline callbacks in `renderItem`. Wrap items in `memo()` (or rely on React Compiler).
4. **Hoist callbacks at the list root** — single function instance passed to each item.
5. **State is ground truth** — derive visual values (scales, opacities, totals) from it,
   never store derived state in `useState`/`useEffect`.
6. **Use `.get()`/`.set()` on Reanimated shared values** (React Compiler compatibility).
7. **Pressable, not Touchable** — never `TouchableOpacity`/`TouchableHighlight`.
8. **Native modals & menus** — prefer `expo-router` modal routes / native context menus.
9. **No `measure()` for layout** — use `onLayout` (+ `useLayoutEffect` for initial size).
10. **`boxShadow` CSS string syntax for shadows** — not the legacy shadow* props.
11. **`borderCurve: 'continuous'` with `borderRadius`** — smooth corners.
12. **`gap` for spacing between siblings** — not margin on children.
13. **Hoist Intl formatters** to module scope (don't `new Intl.NumberFormat()` in render).

## Path aliases

- `@/*` → `./src/*`
- `@/assets/*` → `./assets/*`

## Project layout (target)

```
src/
  app/                       expo-router file-based routes (srcDir convention)
    _layout.tsx              Root providers
    (tabs)/_layout.tsx       Native tabs: Dashboard / Subscriptions / Settings
    (tabs)/index.tsx         Dashboard
    (tabs)/subscriptions.tsx Subscriptions list
    (tabs)/settings.tsx      Settings
    subscription/[id].tsx    Detail
    subscription/add.tsx     Add / edit (native modal)
  design/tokens.ts           Colors (cool dark + cyan), spacing, radii, type, shadows
  design/components/         Card, Button, Text, Badge, Avatar, ListRow, Stat, ...
  db/schema.ts, client.ts, queries.ts
  store/useSubscriptionsStore.ts, useUIStore.ts
  features/<area>/           Screen-scoped code (DashboardScreen, components, ...)
  utils/billing.ts, format.ts, constants.ts
  types/                     Subscription, Category, Cycle, Currency
```

## Brand / Visual identity

- **Theme**: dark-first.  Surface `#0B0F14`, elevated `#131920`, border `#1F2A36`.
- **Text**: primary `#F4F7FB`, secondary `#93A1B5`.
- **Accent**: cyan `#22D3EE` (muted `#0E7490`).
- **Typography**: system-ui with limited sizes (vary weight/color, not many sizes).
- **Shadows**: CSS `box-shadow` syntax, kept subtle.

## Notes for agents

- React Compiler is ON — no need for manual `useMemo`/`useCallback`/`memo()` for most
  cases. Still avoid inline object/style references passed into list items.
- Do not install `@testing-library/jest-native` — it has a stale peer dep on
  `react-test-renderer`. Use `@testing-library/react-native` for future component tests.
- **Web is intentionally unsupported**. `expo-sqlite` requires a `wa-sqlite.wasm` asset
  loader configured in Metro for web, which we haven't wired because Subby is
  mobile-only (iOS + Android). Don't try `npx expo export -p web` until web is in scope.
- Run `npx expo prebuild` will produce a native iOS/Android project; the native export
  bundle requires Xcode/Android SDK so we typically rely on typecheck + lint + test
  for scaffold validation between Steps.
- Subscribe to subscription updates ONLY through the Zustand store's selectors —
  never call `db/queries.ts` directly inside a component (the store re-reads from
  Supabase after each mutation and updates the cache).
- Account prefs (`currency`, `budget`, `remindersEnabled`) sync to `user_prefs`
  via `useUIStore` setters + `hydratePrefs()` (called from the root layout on
  account change); `sort`/`filter`/theme stay device-local. Notification ids
  are device-local only (`notification_map` sidecar) — never send them to
  Supabase.
- The active theme is resolved by combining the persisted user preference with the
  device color scheme. Use `useTheme()` for a full palette or `useThemeColor(name)`
  inside a memoized row to re-render only when that color's hex actually changes.
- Refer to the React Native skills guide for full rationale on each rule.