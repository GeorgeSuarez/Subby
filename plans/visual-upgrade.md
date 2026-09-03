# Plan — Visual Upgrade: Quiet Ledger Rebrand

> Status: DRAFT — grilled 2026-05-13, ready for Phase 0.
> Scope: **whole app · rebrand (not polish) · multi-phase design-system upgrade**
> Audience: consumer + portfolio (both) · validated via light+dark screenshots + ad-hoc build per phase

## 1. Shared understanding (grill outcomes)

| Q   | Decision                                                                                                                         | Consequence                                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Whole app upgrade                                                                                                                | Phases must cover every route: Dashboard, Subscriptions list, Detail, Add/Edit, Settings (9 sections), Trials, Auth/Onboarding/Welcome — nothing orphaned |
| Q2  | Shift identity — rebrand                                                                                                         | Token-level work required; not a prop tweak. New palette + type + elevation language                                                                      |
| Q3  | Hard constraints: **b,d,e,f** kept — single-source `tokens.ts`, light+dark both ship, FlashList rows primitive-only, Expo SDK 57 | No styling engine (NativeWind/Tamagui), no token forks per screen, no heavy rows                                                                          |
| Q4  | Both audiences                                                                                                                   | Screenshots must wow at thumb-speed _and_ interaction polish must survive hiring-manager scrutiny (motion/haptics/a11y)                                   |
| Q5  | Multi-phase                                                                                                                      | Plan is phased, each phase mergeable + validatable alone; no big-bang branch                                                                              |
| Q6  | No refs — surprise me                                                                                                            | Anchored to Linear (density/type discipline) + Barefoot (peer) internally; explicit direction chosen below                                                |
| Q7  | **Quiet Ledger**                                                                                                                 | Ink + paper, editorial precision, tabular numbers, hairlines over shadows. Differentiated from current cyan-tech and generic gradient fintech             |
| Q8  | **One display font**                                                                                                             | Custom serif/ink for `display`/`stat`/`title` only; system for `body`/`caption`. 80% distinctiveness, 20% cost                                            |
| Q9  | **Light-first / paper**                                                                                                          | Light is hero (`#FDFCF9`-family warm paper); dark re-tinted to matching warm ink, not current cool `#0B0F14`                                              |
| Q10 | **Tighter + flatter**                                                                                                            | Reduce row/card padding `16→12`, hairline borders > shadows in dark, `sm/md` shadows only in light                                                        |
| Q11 | **Tokens → Dashboard vertical slice → List/Detail → Add/Edit → Chrome → Icon**                                                   | Vertical slice is the abort/steer gate; cheapest real feedback                                                                                            |
| Q12 | App icon/splash in-scope for plan, deferred execution                                                                            | Spec direction now, generate after palette/type lock to avoid redo                                                                                        |
| Q13 | Dark = **Ink ledger (a) + light-weighted (c)**                                                                                   | Dark is warm ink lineage of paper, not dimmed clone; polish 70/30 light/dark                                                                              |
| Q14 | **Quieter motion, softer haptics**                                                                                               | `timingBase 200→160`, spring `damping 14→18`, count-up kept but faster; `selection` stays, `impact` → `light`                                             |
| Q15 | **Tonal viz + desaturated semantics**                                                                                            | Pie = ink/navy/stone tonal, accent pop on #1 slice; `positive`/`negative`/`warning` desaturated 15-20% for paper calm                                     |
| Q16 | **Screenshots + ad-hoc build gate**                                                                                              | No Figma detour; light+dark Dashboard screenshots (empty/populated/budget edge) + TestFlight/Dev Client swipe                                             |
| Q17 | **Single doc** (`plans/visual-upgrade.md`)                                                                                       | This file; split later if it grows unwieldy                                                                                                               |

---

## 2. Direction: Quiet Ledger (light-first)

### Personality

A ledger you want to open. Warm paper, warm ink, one deep accent, tabular numbers, generous whitespace but tighter components. Trust over flash. Think: bank statement meets editorial — not a neon dashboard.

### What changes vs. today

- **Today**: dark-first (`surface #0B0F14`), cool blue-tinted surfaces, electric cyan `#22D3EE`/`#0891B2`, system font only, `md/lg` shadows, `16dp` card padding.
- **After**: light-first warm paper, warm-ink text, deep ink-teal accent, one display serif for numbers/headlines, hairline borders primary / shadows secondary, `12dp` row padding, quieter motion.

### Non-goals

- No illustration system in v1 (keep `EmptyState` geometric; add paper-texture/line-art later if needed).
- No navigation reshuffle (native tabs stay 3 + center Add; `formSheet` modals stay).
- No data-model changes.

---

## 3. Token draft (proposed diff to `src/design/tokens.ts`)

> Draft hexes — final after Dashboard slice eyeball. All names stay; values shift. Single source preserved.

### 3.1 Palette — light (hero)

```ts
// Warm paper hero
lightPalette = {
  surface: '#FDFCF9', // was #F7F9FC — warm paper
  surfaceElevated: '#FFFFFF',
  surfaceHigher: '#FFFFFF',
  surfaceOverlay: 'rgba(253, 252, 249, 0.84)',

  border: '#E8E2D9', // was #E5E9EF — warm stone border
  borderSubtle: '#F0EBE3',

  textPrimary: '#1C1A17', // was #0B0F14 — warm ink
  textSecondary: '#78716C', // was #5E6B7E — stone
  textTertiary: '#A8A29E', // was #93A1B5
  textOnAccent: '#FFFFFF',

  accent: '#0E4A5C', // was #0891B2 — deep ink-teal (trust)
  accentMuted: '#15566B',
  accentSoft: 'rgba(14, 74, 92, 0.08)',
  accentSoftStrong: 'rgba(14, 74, 92, 0.14)',

  positive: '#0D7A5A', // was #059669 — desaturated for paper calm
  positiveSoft: 'rgba(13, 122, 90, 0.10)',
  negative: '#BE123C', // was #DC2626 — deeper, less neon
  negativeSoft: 'rgba(190, 18, 60, 0.08)',
  warning: '#92400E', // was #D97706 — burnt amber
  warningSoft: 'rgba(146, 64, 14, 0.08)',

  scrim: 'rgba(28, 26, 23, 0.40)',
  hairline: 'rgba(28, 26, 23, 0.06)', // was rgba(11,15,20,0.06)
};
lightShadows = {
  sm: '0 1px 2px rgba(28, 26, 23, 0.06)',
  md: '0 4px 12px rgba(28, 26, 23, 0.07)',
  lg: '0 8px 24px rgba(28, 26, 23, 0.08)',
  xl: '0 18px 48px rgba(28, 26, 23, 0.10)',
  glowAccent: '0 0 14px rgba(14, 74, 92, 0.18)', // subtler
  glowPositive: '0 0 14px rgba(13, 122, 90, 0.16)',
};
```

### 3.2 Palette — dark (ink ledger, warm lineage)

```ts
darkPalette = {
  surface: '#0F1113', // was #0B0F14 — warm ink (not blue)
  surfaceElevated: '#1A1E20', // was #131920
  surfaceHigher: '#23282B', // was #1B232E

  border: '#2A3033', // was #1F2A36
  borderSubtle: '#1E2326', // was #16202B

  textPrimary: '#F5F1EB', // was #F4F7FB — warm paper on ink
  textSecondary: '#A8A29E', // was #93A1B5
  textTertiary: '#78716C', // was #5E6B7E
  textOnAccent: '#FFFFFF',

  accent: '#22A0BF', // was #22D3EE — deeper, less neon for ink
  accentMuted: '#0E4A5C',
  accentSoft: 'rgba(34, 160, 191, 0.12)',
  accentSoftStrong: 'rgba(34, 160, 191, 0.20)',

  positive: '#2FB88A',
  positiveSoft: 'rgba(47, 184, 138, 0.14)',
  negative: '#F07178',
  negativeSoft: 'rgba(240, 113, 120, 0.14)',
  warning: '#E8A838',
  warningSoft: 'rgba(232, 168, 56, 0.14)',

  scrim: 'rgba(0, 0, 0, 0.60)',
  hairline: 'rgba(245, 241, 235, 0.06)',
};
darkShadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.28)',
  md: '0 4px 12px rgba(0, 0, 0, 0.32)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.38)',
  xl: '0 18px 48px rgba(0, 0, 0, 0.46)',
  glowAccent: '0 0 16px rgba(34, 160, 191, 0.22)',
  glowPositive: '0 0 14px rgba(47, 184, 138, 0.20)',
};
```

### 3.3 Type — one display font

```ts
// Add one serif for display/stat/title, system for body/caption
// Chosen: Fraunces (35KB regular + 35KB 600, latin subset) — soft editorial, portfolio-distinctive.
// Load via expo-font in _layout.tsx; fallback to system if load fails. Previous candidates
// (Instrument Serif, Newsreader) kept in assets/fonts/ for one-line rollback.

typeScale unchanged (34/22/18/16/13/44) — hierarchy still via weight/color.
fontFamily = {
  display: 'Fraunces-Regular',     // display/stat/title 400
  displaySemibold: 'Fraunces-SemiBold', // display/stat/title 600
  system: 'System',
}
// Text.tsx: variant→fontFamily mapping (display/stat/title → serif, body/caption → system)
// Numbers: tabular-nums via fontVariant: ['tabular-nums'] on display/stat
```

### 3.4 Spacing / radius / motion

```ts
spacing unchanged in value; usage tightened:
  - Card default padding 16→12 on list rows (keep 16 on hero/detail)
  - screenPaddingH 16→16 (keep), but internal card gaps sm→xs where ledger wants precision
radius unchanged (borderCurve: 'continuous' stays)
layout.cardRadius: 16 (keep), rows tighter via padding not radius
motion = {
  timingFast: 100,  // was 120
  timingBase: 160,  // was 200
  timingSlow: 280,  // was 320
  spring: { damping: 18, stiffness: 200, mass: 0.9 }, // was 14/180/0.9 — less bounce
}
```

### 3.5 Default preference note

`theme-resolve.ts` currently defaults to dark-first when system is `null`/`unspecified`. Light-first rebrand should flip that: `return system === 'dark' ? 'dark' : 'light'` (light is the new hero). Explicit user choice still respected.

---

## 4. Phases — what ships, in order

### Phase 0 — Audit & token draft (no visuals, ~0.5 day)

- [x] Inventory `src/design/components/*` (14 primitives) + all `features/*/components/*` for token drift (hardcoded colors/spacing/shadows).
- [x] Measure current bundle impact of one font (Fraunces 70KB total) + verify `expo-font` loading + fallback.
- [x] Write token draft diff (section 3 above) as code comments in `tokens.ts` (not applied).
- **Exit**: draft approved; font candidate chosen → **Fraunces** locked 2026-05-13.

### Phase 1 — Tokens + primitives (visual foundation, ~1-2 days)

- [x] Apply `tokens.ts` + `theme-resolve.ts` default-flip + `lightShadows`/`darkShadows` (warm lineage).
- [x] Update primitives to Quiet Ledger language:
  - `Text.tsx` — Fraunces for `display`/`stat`/`title`, `tabular-nums` on numbers, system for rest.
  - `Card.tsx` — tighter padding variant (`compact` 12 vs `default` 16), hairline border primary in dark, `sm` shadow only in light; keep `elevation` prop but map to subtler shadows.
  - `Surface.tsx`, `ListRow.tsx`, `Button.tsx`, `Chip.tsx`, `Badge.tsx`, `Sheet.tsx` — border/shadow/motion tuning per tokens; Button `primary` uses new accent + hairline, not glow.
  - `EmptyState.tsx`, `Stat.tsx`, `SegmentedControl.tsx` — tabular numbers, muted semantics.
- [x] Load display font in `src/app/_layout.tsx` via `expo-font` (`useFonts` + splash hold), fallback to system → **Fraunces 70KB**.
- [x] No screen-level changes yet — primitives only. Validate with a throwaway screen or Storybook if present.
- **Gate**: light+dark primitive screenshots; typecheck/lint/format green — **DONE** (typecheck clean, 291/291 tests pass).

### Phase 2 — Dashboard vertical slice (proof of identity, ~1-2 days)

- [x] `DashboardHero` — warm paper card, Fraunces tabular spend, quieter count-up (`timingBase 160`), hairline over glow (`elevation high→low`, track `borderSubtle`), budget/trial variants in muted semantics.
- [x] `QuickStats` / `RenewalsList` / `InsightStrip` / `TrialsCard` — tighter row padding (12→10, rows 64→56), tonal semantics, `InsightStrip` `lg→md`, `RenewalsList` `lg→md` horizontal.
- [x] `DashboardScreen.tsx` ScrollView — gap `lg→md`, `devBanner` re-tinted to ink-teal soft, `FadeIn 280→160`.
- **Gate (Q16)**: **light+dark screenshots** of Dashboard in 3 states (empty / 1 sub / populated + budget edge) + one ad-hoc Dev Client/TestFlight build. You eyeball; abort/steer before rolling out. This is the identity decision point. → **DONE** (typecheck/lint/tests green, ready for screenshots).

### Phase 3 — List + Detail + Add/Edit (~2-3 days)

- [x] **Subscriptions list** (`SubscriptionsScreen`, `ListRow`, `SwipeableRow`) — `ListRow` tighter (16→12 horizontal, 64→56 minHeight, gap md→sm), header gap md→sm, haptics `impactMedium→impactLight`, FlashList primitives untouched (perf guard).
- [x] **Detail** (`DetailScreen`, `DetailHero`) — hero tile glow removed (hairline over glow), scroll gap lg→md, Fraunces tabular via tokens, hairline separators already via tokens.
- [x] **Add/Edit** (`AddEditScreen`, `TextField`) — form stack gap lg→md, `TextField` bg `surfaceHigher→surfaceElevated` (paper subtle), validation still `negative` (desaturated but clear).
- **Gate**: light+dark screenshots of list (search+filter states) + detail (trial/budget variants) + add form (validation). → **DONE** (typecheck/lint/tests green, ready for screenshots).

### Phase 4 — Chrome (Settings, Trials, Auth, Onboarding, Welcome, Paywall) (~1-2 days)

- [x] `SettingsScreen` 9 sections — gap lg→md, paper/ink via tokens, demo-data stays dev-gated.
- [x] `PaywallScreen`, `OnboardingScreen` (`FadeInDown 280→160`), `AuthScreen` (form gap lg→md), `SignUpEmailSentScreen` (`280→160`), `BrandLockup` (glow removed, hairline ring only).
- [x] `UnverifiedEmailBanner` (`280→160`), `EmptyState` (durations 280/260→160, damping 14/16→18), `DashboardHero` cycleDot + `RenewalsList` timeline dot glow removed (flat).
- [x] `TrialsScreen` — no code change (ListRow tightening + tokens flow through); `Toast`/verify flows inherit muted semantics via tokens.
- **Gate**: full-app light+dark screenshot sweep (one pass). → **DONE** (typecheck/lint/tests green, ready for sweep).

### Phase 5 — Icon, splash, site & screenshot kit (deferred execution, ~1 day)

- [x] Regenerated `assets/images/icon.png` + `android-icon-*` + `ledger-stack-splash.png` + `favicon.png` + `logo-options/ledger-stack.*` in Quiet Ledger lineage (paper `#FDFCF9→#F0EBE3` canvas, ink-teal `#22A0BF→#0E4A5C` mark, no neon) via `scripts/generate-icons.mjs`.
- [x] Updated `app.json`: splash light `#FDFCF9` / dark `#0F1113`, adaptive bg `#FDFCF9`, notification accent `#0E4A5C`; updated `expo.icon/Assets/ledger-stack.svg` to ink-teal.
- [ ] Regenerate `docs/demo` videos/posters + `site` landing + `app-flow.html` if they embed palette (no hardcoded palette found — verify visually).
- [ ] Final screenshot kit for App Store (light hero preferred, dark variant included) — Dashboard light confirmed on device (Fraunces $97.13, paper cards, tighter stats).

---

## 5. Files to modify / create

### New

| Path                                                   | Purpose                                                           |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| `assets/fonts/InstrumentSerif-Regular.ttf` (or chosen) | Single display font file                                          |
| `__tests__/design/theme.test.ts` (extend)              | Assert new palette contrast, light-default behavior, tabular-nums |

### Modify (phased)

| Path                                                                                                     | Phase | What changes                                                                      |
| -------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------- |
| `src/design/tokens.ts`                                                                                   | 1     | Warm paper + ink palettes, shadows, motion (section 3)                            |
| `src/design/theme-resolve.ts`                                                                            | 1     | Flip `resolveScheme` dark-first → light-first default                             |
| `src/design/theme.ts`                                                                                    | 1     | No logic change; palette swap flows through `buildTheme`                          |
| `src/design/components/Text.tsx`                                                                         | 1     | Serif for display/stat/title + tabular-nums                                       |
| `src/design/components/Card.tsx`                                                                         | 1     | Compact padding variant, hairline-primary, subtler shadows                        |
| `src/design/components/Surface.tsx`                                                                      | 1     | Border/hairline tuning                                                            |
| `src/design/components/Button.tsx`                                                                       | 1     | Primary accent deep ink-teal, less glow                                           |
| `src/design/components/*` (Chip, Badge, ListRow, Sheet, Stat, SegmentedControl, EmptyState, SearchField) | 1     | Token consumption, no hardcoded colors                                            |
| `src/app/_layout.tsx`                                                                                    | 1     | `expo-font` load + splash hold + fallback                                         |
| `src/features/dashboard/**/*`                                                                            | 2     | Quiet Ledger dashboard (Hero, QuickStats, RenewalsList, InsightStrip, TrialsCard) |
| `src/features/subscriptions/**/*`                                                                        | 3     | Tighter rows, paper search/filter                                                 |
| `src/features/subscription-detail/**/*`                                                                  | 3     | Hero/cost/countdown paper lineage                                                 |
| `src/features/add-subscription/**/*`                                                                     | 3     | Paper form fields                                                                 |
| `src/features/settings/**/*`                                                                             | 4     | 9 sections paper-styled                                                           |
| `src/features/onboarding/*`, `src/features/auth/**/*`, `src/app/welcome.tsx`, `src/app/trials.tsx`       | 4     | Chrome refresh                                                                    |
| `src/features/trials/*`, `src/features/paywall/**/*`                                                     | 4     | If present                                                                        |
| `assets/images/*`, `assets/expo.icon/*`                                                                  | 5     | Icon/splash/tabIcons regeneration                                                 |
| `docs/demo/*`, `site/*`, `docs/app-flow.html`                                                            | 5     | Demo/site re-export if palette-embedded                                           |

---

## 6. Guardrails (from Q3 + earlier constraints)

- [ ] **No styling engine** — `StyleSheet.create` + tokens only; `borderCurve: 'continuous'` stays.
- [ ] **FlashList primitives** — rows keep primitive-only props (`Text`/`View`), no heavy composition.
- [ ] **Light+dark both ship** — every phase screenshots both schemes; dark is warm ink, not afterthought.
- [ ] **Expo SDK 57** — `expo-font` only new dep (already in Expo); no native module additions.
- [ ] **Typecheck/lint/format + 268+ tests green** per phase (existing gates in `AGENTS.md`).
- [ ] **A11y**: warm paper vs ink must hit 4.5:1 for `textSecondary` on `surfaceElevated`; verify with contrast check in `theme.test.ts`.

---

## 7. What was skipped (add when...)

- **Full type pair (custom body font)** — skipped; add when serif display alone feels insufficient on body-heavy screens (Settings) after Phase 4 eyeball.
- **Figma mockups** — skipped per Q16; add when screenshot gate fails to communicate (stakeholder needs) — but code is the source of truth.
- **Illustration system** — skipped; add when empty states feel too stark on warm paper (Phase 2 gate).
- **Motion overhaul (shared transitions)** — skipped beyond quieter timings; add when navigation feels mismatched after rebrand (Phase 4).

---

## 8. Risks & mitigations

| Risk                                               | Mitigation                                                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Light-first feels "too warm/not premium"           | Dashboard slice gate (Phase 2) — abort cost is 1-2 days, tokens revert cleanly (values only)               |
| Serif display hurts number legibility              | Tabular-nums + fallback to system for `stat` if serif fails legibility test; keep system as instant revert |
| Warm palette breaks existing demo screenshots/site | Phase 5 deferred — no rebuild until lock; old site stays coherent until re-export                          |
| Dark ink loses current brand fans                  | Dark is warm lineage, not abandonment; accent still cyan-family but deeper — migration, not erasure        |
| Tighter rows feel cramped on small devices         | Keep `16dp` hero padding, only compact list rows to `12dp`; validate on SE-sized simulator                 |

---

## 9. Immediate next step

**Phase 0 audit** — pick the display font (Instrument Serif vs Newsreader vs Fraunces — 3 quick device renders) and land the token draft diff. No visual change until you approve the draft.

> Ponytail note: plan is single-doc, phased, smallest diff per phase. No big-bang branch; each phase is shippable alone.
