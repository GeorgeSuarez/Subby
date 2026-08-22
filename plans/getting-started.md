# Plan — Getting Started workflow for first-time accounts

> Status: IMPLEMENTED — all five steps complete; typecheck/lint/format green,
> 268/268 tests pass (incl. the new 22-test onboarding suite). Manual
> on-device passes in Verification remain for the next dev run.

## Context

New users who create an account land on an empty Dashboard with a generic
"No subscriptions yet" empty state (`DashboardScreen.tsx`). There is no
guided first-run experience: no welcome, no currency/budget setup, no pointer
to the Add flow. A Getting Started workflow should make the first session
productive and teach the app's core loop (add a subscription → see spend
insights) right after sign-up.

## Decisions (recommended defaults — override any of these)

1. **Shape: full-screen onboarding wizard**, shown once immediately after the
   first signed-in session with zero subscriptions. (Not a dashboard
   checklist — that's a separate ongoing feature; can be added later.)
2. **Steps**: Welcome → Pick currency → Set monthly budget (optional) →
   Renewal reminders toggle → Done screen with "Add your first subscription"
   CTA. No sample-data step in v1 (the demo-data seeder is gated to the dev
   test account; noted as a future enhancement).
3. **Persistence: device-only, keyed per user id** via the existing zustand
   `persist` infra in `useUIStore`. No Supabase migration, no new sync op.
   Tradeoff (accepted): reinstalling the app re-shows the wizard once.
4. **Skippable & upgrade-safe**: "Skip" is available on every step and skips
   to Done. Show-gate = `isSignedIn && subs.length === 0 && !completed[userId]`.
   Existing users with data never see it; an existing user with an empty
   account sees it exactly once (acceptable, arguably useful).

## Approach

A single new route `src/app/onboarding.tsx`, protected by `isSignedIn`
(same `Stack.Protected` pattern as `(tabs)`). The Dashboard redirects into it
when `shouldShowOnboarding()` is true. The step sequence lives in a pure,
Jest-tested state machine (`onboarding-flow.ts`) mirroring the existing
`auth-flow.ts` pattern: steps are data, transitions are pure functions, and
each step commits through an existing store action (`setCurrency`,
`setBudget`, `setRemindersEnabled`) which already syncs to Supabase
`user_prefs` via `syncAccountPrefs`. Completing/skipping records the flag per
userId and `router.replace('/(tabs)')`.

## Files to modify

| File                                                    | Change                                                                                                                                                                |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/onboarding.tsx`                                | **New** route (thin re-export, per module rules)                                                                                                                      |
| `src/app/_layout.tsx`                                   | Register `<Stack.Screen name="onboarding" />` inside the `guard={isSignedIn}` block                                                                                   |
| `src/features/onboarding/OnboardingScreen.tsx`          | **New** wizard UI (Reanimated entrances, design-system primitives only)                                                                                               |
| `src/features/onboarding/onboarding-flow.ts`            | **New** pure step machine: step list, `nextStep/prevStep/skipToDone`, draft state (currency/budget/reminders), `validateBudget`                                       |
| `src/features/onboarding/index.ts`                      | **New** barrel export                                                                                                                                                 |
| `src/store/useUIStore.ts`                               | Add `completedOnboardingUserIds: string[]` + `completeOnboarding(userId)` / `hasCompletedOnboarding(userId)` selector; extend `partialize` so it persists device-side |
| `src/features/dashboard/DashboardScreen.tsx`            | Early-return `<Redirect href="/onboarding" />` when `shouldShowOnboarding(...)` is true                                                                               |
| `__tests__/features/onboarding/onboarding-flow.test.ts` | **New** Jest suite for the pure machine                                                                                                                               |

## Reuse (found in exploration)

- `syncAccountPrefs` + `setCurrency/setBudget/setRemindersEnabled` —
  `src/store/useUIStore.ts`: currency/budget/reminders writes already flow to
  Supabase `user_prefs` best-effort through the sync coordinator. The wizard
  just calls these setters at commit time.
- `CURRENCIES`, `DEFAULT_CURRENCY` — `src/utils/constants.ts`: currency
  picker options.
- Design primitives — `src/design/components/`: `Button`, `Text`, `Surface`,
  `Chip`/`SegmentedControl`, `Sheet`; spacing/layout tokens from
  `@/design/tokens`.
- Entrance animation pattern — `EmptyState` uses ZoomIn/FadeInDown; theme
  cross-fade precedent in `_layout.tsx` (opacity-only, GPU-accelerated).
- Pure-machine precedent — `src/features/auth/auth-flow.ts` + its Jest suite
  `__tests__/features/auth/auth-flow.test.ts`.
- Gate precedent — `Stack.Protected guard={isSignedIn}` in `src/app/_layout.tsx`;
  `useAuthStore` exposes `userId` for keying the completion flag.
- Route-as-thin-reexport convention — every file under `src/app/`.

## Steps

- [x] 1. Pure machine first (TDD): `onboarding-flow.ts` — ordered steps
      (`welcome | currency | budget | reminders`), `nextStep/prevStep`,
      `validateBudget`, `draftFromPrefs`, `shouldShowOnboarding`. 22-test
      Jest suite written first (red → green).
- [x] 2. Store flag: `useUIStore.completedOnboardingUserIds` + idempotent
      `completeOnboarding(userId)` + `useCompletedOnboardingUserIds()`
      selector; persisted device-side via `partialize`. Also added
      `hasHydrated` to the subscriptions store so the gate can’t fire before
      the first read settles.
- [x] 3. Route + gate: `src/app/onboarding.tsx` registered in `_layout.tsx`
      behind `guard={isSignedIn}` (fade animation, swipe-dismiss disabled);
      `<Redirect href="/onboarding" />` from `DashboardScreen` gated by
      `hasHydrated && shouldShowOnboarding(...)`; typed-routes declaration
      patched to match what Expo’s generator will emit.
- [x] 4. Wizard UI: `OnboardingScreen.tsx` — progress dots, per-step icon
      ring, keyed FadeInDown step transitions, currency chips, budget field
      with validation error state, reminders switch (Settings’ track/thumb
      colors), Skip always reachable. Commit calls the three pref setters
      (Supabase-synced) then `completeOnboarding(userId)` then
      `router.replace('/(tabs)')`.
- [x] 5. Polish: tokenized palettes only (`negative` for errors), haptics
      (`impactLight` steps / `selection()` chips / `notifySuccess` finish),
      safe-area insets top+bottom, skip-always-reachable satisfies the
      no-strand edge.
