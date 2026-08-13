# Subby — Architecture

How Subby fits together. This doc covers the data flow, theme resolution, list rendering, animation pipeline, navigation structure, and testing strategy. For the full skill rules and command reference, see [`.opencode/AGENTS.md`](../.opencode/AGENTS.md).

---

## Layer diagram

```
┌─────────────────────────────────────────────────────────┐
│  UI  (src/features/<screen>/)                           │
│  Components read via Zustand selectors — never call     │
│  db/queries.ts directly inside a component.             │
└───────────────────────┬─────────────────────────────────┘
                        │  useActiveSubscriptions()
                        │  useSubscriptionById(id)
                        │  useCurrency() / useSort() / useFilter()
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Store  (src/store/)                                   │
│  useSubscriptionsStore — read-through cache of the DB.  │
│  useUIStore — persisted UI prefs (currency/sort/filter).│
│                                                         │
│  Every mutation: call DB → re-read ALL rows → setState. │
│  The store NEVER locally patches arrays — avoids stale  │
│  cache bugs at the cost of one extra query per write.   │
└───────────────────────┬─────────────────────────────────┘
                        │  insertSubscription(draft)
                        │  updateSubscription(id, patch)
                        │  deleteSubscription(id)
                        ▼
┌─────────────────────────────────────────────────────────┐
│  DB Layer  (src/db/queries.ts)                          │
│  Typed CRUD. Converts snake_case SQLite rows to/from    │
│  the domain Subscription type via rowToSubscription()   │
│  and subscriptionToRow(). The rest of the app never     │
│  sees SQLite column names.                              │
└───────────────────────┬─────────────────────────────────┘
                        │  openDatabaseAsync() + runMigrations()
                        ▼
┌─────────────────────────────────────────────────────────┐
│  SQLite  (expo-sqlite)                                  │
│  subby.db — single table with 3 indexes (archived,      │
│  next_renewal, category). Versioned migrations via      │
│  __meta table. Schema in src/db/schema.ts.              │
└─────────────────────────────────────────────────────────┘
```

**Key invariant:** the store is a read-through cache, not a write-through one. Mutations go through the DB query layer, which writes to SQLite, then the store re-reads all rows and updates its cache. This means the UI always reflects what's in the database — there's no risk of the cache drifting out of sync.

---

## Theme resolution flow

```
User preference (Zustand store, persisted)     System color scheme (RN useColorScheme)
         │                                              │
         │  'system' | 'light' | 'dark'                 │  'light' | 'dark' | null
         │  (undefined = user hasn't chosen yet)        │
         ▼                                              ▼
    ┌─────────────────────────────────────────────────────────┐
    │  resolveScheme(pref, system)                             │
    │  (src/design/theme-resolve.ts — pure, RN-free)           │
    │                                                          │
    │  pref === 'system' → follow system, fall back to dark    │
    │  pref === 'light'/'dark' → explicit override wins        │
    └──────────────────────┬────────────────────────────────────┘
                           │  'light' | 'dark'
                           ▼
    ┌─────────────────────────────────────────────────────────┐
    │  buildTheme(scheme)                                      │
    │  Returns { scheme, colors: Palette, shadow: (n) => str } │
    │                                                          │
    │  Palette = darkPalette or lightPalette from tokens.ts    │
    └──────────────────────┬────────────────────────────────────┘
                           │
              ┌────────────┴─────────────┐
              ▼                          ▼
    useTheme() — full palette    useThemeColor(name) — single color string
    (used by Card, Button,      (used by memoized ListRow — re-renders only
     Text, etc.)                 when that specific color's hex changes)
```

**Dark-first identity:** when the system scheme is unknown (`'unspecified'` / `null` / `undefined`), the resolver defaults to dark. This matches the cool dark-first + cyan visual identity.

**Cross-fade transition:** the root layout (`src/app/_layout.tsx`) wraps the route tree in an `Animated.View` keyed by `colorMode`. When the resolved scheme flips, React remounts the surface and Reanimated's `FadeIn.duration(280)` drives the cross-fade — only `opacity` is animated (GPU-accelerated).

---

## List rendering pipeline

```
useActiveSubscriptions()          →  Subscription[]  (from Zustand store)
         │
         ▼
useMemo(
  () => filterAndSortSubs(subs, { query, sort, filter }),
  [subs, query, sort, filter]
)                                 →  visible[]  (new array, never mutates input)
         │
         │  filterAndSortSubs is pure (no RN imports, fully Jest-tested):
         │    applyFilter(subs, filter)     → shallow copy + filter by archived flag
         │    .filter(matchesQuery)         → multi-token AND match on name+category+notes
         │    applySort(filtered, sort)     → name (locale-aware numeric) | amount (desc) | nextRenewal (asc)
         ▼
<FlashList data={visible} ... />
         │
         ▼
renderItem={({ item }) => (
  <ListRow
    id={item.id}                         ← primitive (string)
    title={item.name}                    ← primitive (string)
    subtitle={formatMonthDay(...)}       ← primitive (string)
    trailingTitle={formatCurrency(...)}  ← primitive (string)
    trailingSubtitle={formatRenewalIn()} ← primitive (string)
    icon={item.icon}                     ← primitive (string)
    avatarBackground="surfaceHigher"    ← primitive (literal)
    onPressWithId={onRowPress}           ← stable callback (useCallback at screen root)
    onLongPressWithId={onRowLongPress}   ← stable callback (useCallback at screen root)
  />
)}
```

**Why this works:**

- `ListRow` is wrapped in `React.memo()`. Its props are _all_ primitives (strings, booleans) or stable callback references — `memo()`'s shallow comparison skips re-renders when values haven't changed.
- `onRowPress` is created once at the screen root via `useCallback`. It calls `router.push('/subscription/${id}')` — the closure captures `id` _inside_ the memoized row (via the `id` prop), not in the parent.
- `formatCurrency`, `formatMonthDay`, `formatRenewalIn` all use hoisted Intl formatter instances (created once at module scope in `utils/format.ts`), so no formatter allocation per render.
- No inline style objects are passed to `ListRow` — static styles live in `StyleSheet.create` at module scope inside the component file; dynamic colors come from the palette via `useTheme()` inside the row.

---

## Animation pipeline

All animations use Reanimated 4 worklets running on the UI thread. Only `transform` and `opacity` are animated (GPU-accelerated — skill rule §3.1).

### Pattern: shared value as ground truth

```
Shared value stores STATE (0 = idle, 1 = pressed)
    │
    ▼
useAnimatedStyle(() => ({
  transform: [{ scale: interpolate(pressed.get(), [0, 1], [1, 0.92]) }],
}))
```

`pressed` is the ground truth (skill §7.1). The visual `scale` is _derived_ from it — adding opacity or rotation later just needs another `interpolate` from the same value.

### FAB entrance (dashboard, pre-Add-tab refactor)

```
entrance = useSharedValue(0)
useEffect(() => {
  entrance.set(withDelay(140, withSpring(1, { damping: 12, stiffness: 200 })))
}, [])

final scale = interpolate(pressed, [0,1], [1, 0.92]) × entrance
final opacity = entrance
```

### Count-up (HeroSpend, QuickStats)

`AnimatedNumber` bridges a Reanimated shared value to React state for text display:

```
sv = useSharedValue(0)
sv.set(withDelay(delayMs, withTiming(value, { duration })))

useAnimatedReaction(
  () => sv.get(),
  (current, prev) => { if (current !== prev) runOnJS(setDisplay)(format(current)) }
)
```

`useAnimatedReaction` (skill §3.2) is the correct tool for side-effects. `useDerivedValue` is for derivations that produce a value — not for React state bridges.

### React Compiler compatibility

All worklet code uses `.get()` / `.set()` instead of `.value`:

```ts
// ❌ opts out of React Compiler
pressed.value = withTiming(1);

// ✅ compiler-safe
pressed.set(withTiming(1));
```

### Haptics

Haptic feedback fires via `runOnJS` from worklet callbacks — the gesture handler stays on the UI thread while the haptic invocation is a JS-thread side effect:

```ts
const tap = Gesture.Tap().onEnd(() => {
  runOnJS(onPress)();
  runOnJS(impactLight)();
});
```

---

## Navigation structure

```
RootLayout (src/app/_layout.tsx)
  ├── GestureHandlerRootView
  ├── ThemeProvider (expo-router DarkTheme/DefaultTheme)
  ├── StatusBar
  ├── Animated.View key={colorMode}  ← theme cross-fade via FadeIn
  │
  └── Slot → (tabs)/_layout.tsx
        │
        ├── NativeTabs (UITabBarController / Material Bottom Nav)
        │   ├── Trigger "index"        → DashboardScreen
        │   ├── Trigger "subscriptions"→ SubscriptionsScreen
        │   ├── Trigger "add"          → AddTabRedirect (transparent)
        │   │     └── on focus: push('/subscription/add')
        │   │     └── on modal dismiss: replace('/') → back to Dashboard
        │   └── Trigger "settings"    → SettingsScreen
        │
        └── Stack (subscription/_layout.tsx, presentation: 'formSheet')
            ├── [id].tsx   → DetailScreen (existing subscription)
            └── add.tsx    → AddEditScreen (new or edit via ?id= param)
```

**Why native navigators (skill §5.1):** native stack and native tabs use `UINavigationController` / `UITabBarController` on iOS and Fragment/BottomNavigation on Android. Transitions, gestures, scroll-to-top, PiP avoidance, and safe-area insets all work via platform APIs — no JS reimplementation.

---

## Design system

14 primitive components in `src/design/components/`:

| Component                                | Purpose                                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `Text`                                   | Tokenized typography (6 variants, weight/align/color props)                         |
| `Surface`                                | Themed View with optional border                                                    |
| `Card` + `.Header` / `.Body` / `.Footer` | Compound container with elevation presets                                           |
| `Button`                                 | Pressable-based, 3 variants (primary/ghost/danger), 3 sizes                         |
| `IconButton`                             | Pressable with Ionicons glyph                                                       |
| `Badge`                                  | Status indicator (5 tones)                                                          |
| `Chip`                                   | Selectable category pill                                                            |
| `Avatar`                                 | `expo-image`-backed icon tile                                                       |
| `ListRow`                                | FlashList row — memoized, primitive-only props, `onPressWithId`/`onLongPressWithId` |
| `Stat`                                   | Metric block with optional delta badge                                              |
| `SegmentedControl`                       | N-segment selector with stable `onSelect`                                           |
| `SearchField`                            | Themed native `TextInput` with leading magnifier                                    |
| `EmptyState`                             | ZoomIn + FadeInDown entrance animation                                              |
| `Sheet`                                  | RN `Modal` wrapper (native platform modal, not JS bottom-sheet)                     |

All components import tokens from `@/design` (barrel file) — never reach into individual module paths. Tokens are consumed via `useTheme()` (full palette) or `useThemeColor(name)` (single color — for memoized rows).

---

## Testing strategy

Pure, RN-free helpers are fully unit-tested in plain Node Jest (no `jest-expo` preset needed):

| Suite                                                 | Tests   | What it covers                                                                                                                                                          |
| ----------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `utils/billing.test.ts`                               | 24      | Date math, month clamping, renewal walking, monthly/yearly equivalents, aggregates, renewalsWithin sorting                                                              |
| `utils/format.test.ts`                                | 14      | Currency formatting (USD/JPY), compact K-suffix, date format, humanized renewal windows                                                                                 |
| `utils/constants.test.ts`                             | 11      | Category slug/label/icon mapping, cycle month spans, currency fraction digits                                                                                           |
| `features/subscriptions/subscriptions-filter.test.ts` | 14      | matchesQuery (multi-token AND), applyFilter (active/archived/all + shallow-copy), applySort (name/amount/nextRenewal, no input mutation), filterAndSortSubs composition |
| `features/subscription-detail/detail-helpers.test.ts` | 12      | renewalToneFor (4 buckets), getRenewalStatus, getMonthlyCost/getYearlyCost                                                                                              |
| `features/add-subscription/form-helpers.test.ts`      | 21      | parseISO (valid/malformed/leap day), defaultDraft, draftFromSubscription, validateDraft (11 field rules), errorsByField                                                 |
| `design/theme.test.ts`                                | 18      | normalizeSystem, resolveScheme (undefined pref + system unknown → dark-first), resolveTheme across all combos                                                           |
| `db/seed.test.ts`                                     | 3       | Brand list, parseable dates, relative-to-today behavior                                                                                                                 |
| **Total**                                             | **117** | **8 suites**                                                                                                                                                            |

React component tests (rendering, interaction, accessibility) are deferred — they'd require `jest-expo` + `@testing-library/react-native`, which we'll add in a future iteration.

---

## Module boundaries

```
src/
  app/              ← expo-router routes (thin re-exports only)
  features/         ← screen logic (no expo-router imports)
  design/           ← tokens, theme, components (no feature imports)
  db/               ← schema, client, queries, seed (no React imports)
  store/            ← Zustand stores (imports from db/ and types/)
  utils/            ← pure helpers (no React/RN imports except haptics.ts)
  types/            ← domain types (no imports)
```

**Rule:** dependencies flow downward. `features/` can import from `design/`, `store/`, `utils/`, `db/`, `types/`. But `design/` cannot import from `features/`, and `db/` cannot import from `store/`. This keeps each layer testable in isolation.
