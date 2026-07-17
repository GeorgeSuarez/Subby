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
- **DB**: `expo-sqlite` only. Schema lives in `src/db/schema.ts`; queries in `src/db/queries.ts`.
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
  never call `db/queries.ts` directly inside a component (the store re-reads from DB
  after each mutation and updates the cache).
- The active theme is resolved by combining the persisted user preference with the
  device color scheme. Use `useTheme()` for a full palette or `useThemeColor(name)`
  inside a memoized row to re-render only when that color's hex actually changes.
- Refer to the React Native skills guide for full rationale on each rule.