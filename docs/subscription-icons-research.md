# Subscription brand icons — research

> Researched 2026-09-03. Question: which subscriptions to cover first, and the
> most efficient way to get their icons into Subby (Expo SDK 57, offline-first,
> `expo-image` only, no styling/native-module additions without approval).

## Recommendation (TL;DR)

**Hybrid, in this order:**

1. **Bundle a curated set of Simple Icons SVGs/PNGs** (~30 slugs, pinned
   `simple-icons@v16`) for the brands it covers. Zero runtime cost, works
   offline, no API key. Serve via the existing `Avatar(source)` path
   (`expo-image` renders the SVG/PNG).
2. **Remote fallback: Google `faviconV2`** (`https://t3.gstatic.com/faviconV2?...&size=128`)
   resolved from a name→domain map for brands Simple Icons *doesn't* carry
   (Disney+, Hulu, Peacock, Prime Video, Xbox, Nintendo…). Free, no key, cache
   via `expo-image`.
3. **Existing Ionicon + brand-color tile stays** as the final fallback
   (unknown/custom entries) — today's `brandBackground`/`brandIconColor`
   behavior, unchanged.

Skip Clearbit entirely (sunset Dec 2025). Reach for logo.dev only if favicon
quality proves inadequate — it's the official Clearbit successor but needs an
API key and a network dependency for every logo.

## Popular subscriptions to cover first

Ranked by 2026 subscriber scale (music figures: MIDiA/IFPI via Axis
Intelligence & Chartlex; video:/parlance — Disney+/Netflix/Max/Hulu/Prime
Video/Apple TV+/Paramount+/Peacock are the US top tier). The **Slug** column
was verified live against the pinned CDN on 2026-09-03
(`https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/<slug>.svg` → HTTP 200);
**gap** = 404, use the favicon fallback.

### Video / streaming

| Service | Domain | Slug / gap | Notes |
|---|---|---|---|
| Netflix | netflix.com | `netflix` ✅ | In `brand.ts` already |
| YouTube Premium | youtube.com | `youtube` ✅ | |
| Max | max.com | `max` ✅ | Generic "max" mark — confirm recognizability |
| Paramount+ | paramountplus.com | `paramountplus` ✅ | |
| Crunchyroll | crunchyroll.com | `crunchyroll` ✅ | |
| Disney+ | disneyplus.com | **gap** ❌ | No Disney entry in slugs.md at all |
| Hulu | hulu.com | **gap** ❌ | |
| Prime Video | primevideo.com | **gap** ❌ | Only Prime*Faces*/NG/React/Vue (unrelated UI kits) |
| Peacock | peacocktv.com | **gap** ❌ | |
| Apple TV | tv.apple.com | `appletv` ✅ | Title is "Apple TV" (not TV+) in slugs.md |

### Music

| Service | Domain | Slug / gap | Notes |
|---|---|---|---|
| Spotify | spotify.com | `spotify` ✅ | ~300M paid subs (Q2 2026) — largest |
| Apple Music | music.apple.com | `applemusic` ✅ | ~100M est. |
| YouTube Music | music.youtube.com | `youtubemusic` ✅ | ~114M est., bundled w/ Premium |
| Tidal | tidal.com | `tidal` ✅ | |
| Deezer | deezer.com | `deezer` ✅ | 8.9M (H1 2026, public filing) |
| SoundCloud | soundcloud.com | `soundcloud` ✅ | Go+ tier |
| Pandora | pandora.com | `pandora` ✅ | US-only |
| Amazon Music | music.amazon.com | **gap** ❌ | No Amazon Music entry |

### Cloud / productivity / dev

| Service | Domain | Slug / gap | Notes |
|---|---|---|---|
| iCloud+ | icloud.com | `icloud` ✅ | |
| Google Drive / One | drive.google.com | `googledrive` ✅ | No dedicated Google One slug; Drive mark reads fine |
| Dropbox | dropbox.com | `dropbox` ✅ | |
| Notion | notion.so | `notion` ✅ | |
| Figma | figma.com | `figma` ✅ | In seed data already |
| GitHub | github.com | `github` ✅ | In seed data already |
| 1Password | 1password.com | `1password` ✅ | |
| Todoist | todoist.com | `todoist` ✅ | |
| Evernote | evernote.com | `evernote` ✅ | |
| Discord | discord.com | `discord` ✅ | Nitro subs |
| Adobe CC | adobe.com | **gap** ❌ | No Adobe entry at all |
| Microsoft 365 | microsoft365.com | **gap** ❌ | No Microsoft entry at all |
| ChatGPT Plus | chatgpt.com | **gap** ❌ | Only unrelated `openaigym` |

### Gaming

| Service | Domain | Slug / gap | Notes |
|---|---|---|---|
| PlayStation Plus | playstation.com | `playstation` ✅ | |
| Steam | steampowered.com | `steam` ✅ | Wallet/sub adjacent |
| Epic Games | epicgames.com | `epicgames` ✅ | Fortnite Crew |
| Xbox Game Pass | xbox.com | **gap** ❌ | No Xbox entry |
| Nintendo Switch Online | nintendo.com | **gap** ❌ | No Nintendo entry |

### News / wellness / other

| Service | Domain | Slug / gap | Notes |
|---|---|---|---|
| New York Times | nytimes.com | `newyorktimes` ✅ | In seed data already |
| Washington Post | washingtonpost.com | `thewashingtonpost` ✅ | |
| Strava | strava.com | `strava` ✅ | Summit subs |
| Peloton | onepeloton.com | `peloton` ✅ | |
| Fitbit Premium | fitbit.com | `fitbit` ✅ | |
| Patreon | patreon.com | `patreon` ✅ | Many small recurring charges |
| Audible | audible.com | `audible` ✅ | |
| Headspace | headspace.com | `headspace` ✅ | |
| Duolingo | duolingo.com | `duolingo` ✅ | Super tier |
| Calm | calm.com | **gap** ❌ | No Calm entry |

## Icon sources evaluated

### A. Simple Icons (recommended primary)

- **What:** 3,400+ brand SVGs, one per slug, pinned via jsDelivr/unpkg or the
  `simple-icons` npm package.
  (`https://github.com/simple-icons/simple-icons` — "Over 3400 SVG icons for
  popular brands")
- **Usage:** `<img src="https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/[SLUG].svg">`,
  or the color CDN `https://cdn.simpleicons.org/[SLUG]` (brand hex by default,
  optional `/[COLOR]` and dark-mode color segments).
  (`https://github.com/simple-icons/simple-icons` README, "CDN Usage" / "CDN with colors")
- **Efficiency for Subby:** vendor only the ~30 slugs above at build time
  (a `scripts/fetch-brand-icons.mjs` mirroring `scripts/generate-icons.mjs` —
  repo convention is generated assets, never hand-edited PNGs). Pinned `@v16`
  avoids surprise removals; the README warns `@latest` 404s when an icon is
  removed.
- **Caveats:** entertainment gaps (table above) — brands do get removed on
  request; re-verify slugs when bumping versions. Trademark policy below.

### B. Google faviconV2 (recommended fallback)

- **What:** `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=<url>&size=128`
  (legacy `https://www.google.com/s2/favicons?domain=<domain>&sz=128` still works
  at small sizes).
  (`https://www.logo.dev/docs/google-favicon-api`, "Base endpoint" / "Parameters";
  `https://www.how7o.com/js-get-favicon-url/`)
- **Efficiency:** no key, no signup, PNG out, `size=` up to 128–256. One URL
  template + the domain map — ~5 lines.
- **Caveats:** undocumented/internal service — "don't build mission-critical
  features on it" (`how7o`, "Is Google's favicon service still working in
  2026?"); returns a generic globe when the site is unreachable; quality varies
  (favicons ≠ brand marks). Fine as a *fallback* behind bundled icons, with the
  Ionicon tile as final fallback. `expo-image` caching + `fallback=monogram`-style
  handling should mirror logo.dev's never-break pattern.

### C. logo.dev (upgrade path if B disappoints)

- **What:** Clearbit's officially recommended successor. `GET https://img.logo.dev/:domain?token=pk_…`
  with `size` (max 800), `format` (jpg/png/webp; svg on Enterprise), `theme`
  (light/dark), `retina`, `fallback=monogram|404`.
  (`https://www.logo.dev/docs/logo-images/introduction`; `https://www.logo.dev/docs/api-reference/introduction`)
- **Pricing:** Community plan is free, no card: 500k logo displays + 500k brand
  searches/mo, 100 brand-profile retrievals/mo.
  (`https://www.logo.dev/pricing`)
- **Why not first:** needs signup + a shipped API key (secret handling in an
  OSS Expo client), every logo is a network dependency (fights the offline-first
  architecture in `src/db/offline.ts`), and free-tier caps are a hard stop
  (requests stop until reset).
  (`https://www.logo.dev/docs/platform/rate-limits`)
- **Also useful:** Search API (name → domain autocomplete for the Add form) and
  Brand API (full brand profile incl. colors — could feed `brandBackground`
  automatically). Both REST on `api.logo.dev`.

### D. Clearbit Logo API — DO NOT USE

- Sunset: deprecated March 2025, **shut down Dec 8, 2025** — "requests to
  logo.clearbit.com will fail to connect and no logos will be returned."
  (`https://developers.hubspot.com/changelog/upcoming-sunset-of-clearbits-free-logo-api`;
  `https://clearbit.com/changelog`, "December 8: Clearbit Logo API Sunset")
- Any tutorial still recommending `logo.clearbit.com/<domain>` is stale.

## Legal note (read before shipping)

- Simple Icons itself is CC0-1.0, **but that does not put the brand marks in
  the public domain**: "No trademark or patent rights held by Affirmer are
  waived…" and each icon carries its own `license` entry where known.
  (`https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md` §4;
  `https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md`,
  "Licenses, Copyrights & Trademarks")
- The project asks users to check each brand's own guidelines via the `source`
  / `guidelines` fields and to re-check on updates; brands can request removal.
  Same disclaimer applies to favicon/logo.dev fetching — using a logo to
  *identify the user's own subscription* (nominative use inside a personal
  dashboard row) is the lowest-risk shape; don't restyle marks or use them in
  marketing surfaces (`site/`, App Store screenshots) without checking.
  (`DISCLAIMER.md`, "Brand Guidelines")

## Suggested implementation (not started)

1. `scripts/fetch-brand-icons.mjs` — fetch the ✅ slugs above from pinned
   `simple-icons@v16` into `assets/brand-icons/<slug>.png` (via
   `https://cdn.simpleicons.org/<slug>` for brand-color rasters, or raw SVGs
   through sharp like `generate-icons.mjs` does).
2. `src/utils/brand.ts` — add `brandIconSource(name): { slug } | null` mapping
   the ~40 names above (reuse the `BRAND_BY_NAME` fuzzy-match pattern); extend
   with `brandDomain(name)` for the ❌ gaps.
3. `RenewalsList` / `SubscriptionsScreen` / `TrialsCard` — pass
   `avatarSource={resolved local asset ?? faviconV2 URL}`; `Avatar` already
   supports `source` with icon fallback, so no component changes needed.
4. Measure: ~40 PNGs at 96px ≈ tens of KB total — negligible vs the 70KB
   Fraunces pair.
