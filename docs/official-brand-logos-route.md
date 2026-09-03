# Using official brand logos — recommended route

> Researched 2026-09-03. Follow-up to `subscription-icons-research.md`
> (coverage) and `competitor-logo-handling-research.md` (aggregator model).
> Question: what is the best route if the logos must be *official*?

## TL;DR

**Fetch the brands' own declared icons at build time.** Every major
subscription homepage publishes official icon assets in its HTML (`<link
rel="apple-touch-icon">`, 180×180 PNG, plus sized `rel="icon"` PNGs) —
verified live below for Netflix, Spotify, Disney+, Hulu, and Max on
2026-09-03. A `scripts/fetch-brand-icons.mjs` (same convention as
`scripts/generate-icons.mjs`: generated assets, never hand-edited) that parses
these tags and vendors the PNGs into `assets/brand-icons/` gives you 100%
official, current, offline-safe logos with no API key, no third party, and no
per-brand negotiation. Press kits only for the handful of hero placements;
logo.dev only as a gap-filler.

## Why this beats the alternatives

| Route | Official? | Cost/effort | Verdict |
|---|---|---|---|
| Parse brands' own `<link rel="icon">` tags, vendor at build | Yes — served from the brand's domain/CDN | One script, rerun on demand | **Best route** |
| Brand press/media kits (Apple Newsroom, Spotify Design, Netflix Brand…) | Yes, highest fidelity (SVG, clearspace rules) | Manual per brand, terms vary | Use for top ~10 hero placements only |
| Google `faviconV2` | Yes, effectively — it proxies the same favicon files | ~5 lines, no key | Good runtime fallback, but undocumented service, quality varies |
| logo.dev Brand API | Aggregated, "official-ish" | Key + network + caps | Gap-filler if self-fetch fails |
| Simple Icons | Community-traced vectors, **not** official + entertainment gaps | Zero | Wrong tool when "official" is the requirement |
| Plaid/MX `logo_url` | Aggregator-licensed | Requires bank-sync product | The competitor route — unavailable to manual-entry Subby |

## Proof: what the brands declare (fetched 2026-09-03)

Homepage `<link>` tags (iPhone UA). Note the pattern: canonical 180×180
`apple-touch-icon` plus sized PNG `icon`s on brand CDNs.

- **Netflix** (`netflix.com`): `apple-touch-icon →
  https://assets.nflxext.com/us/ffe/siteui/common/icons/nficon2016.png`
- **Spotify** (`spotify.com`): `icon 32x32 →
  https://open.spotifycdn.com/cdn/images/favicon32.b64ecc03.png`
  (+ 16px PNG, `.ico`)
- **Disney+** (`disneyplus.com`): `apple-touch-icon 180x180 →
  https://static-assets.bamgrid.com/product/disneyplus/favicons/disPlus-favicon-180x180…png`
  (+ 48px PNG, SVG mask-icon)
- **Hulu** (`hulu.com`): `apple-touch-icon → /static/icons/apple-touch-icon.png`
  (+ `favicon.ico.png` on Akamai)
- **Max** (`max.com`): `apple-touch-icon 180x180 →
  /dotcom/img/hbomax/apple-touch-icon.png` (+ 32px PNG, `.ico`)

Caveats found while probing: `https://<domain>/apple-touch-icon.png` at the
root is **unreliable** (404 on Disney+, YouTube, Amazon, NYT, Dropbox, Notion,
Figma; 403 on Hulu/Max — bot protection). Always resolve via the page's
`<link>` tags, not the conventional path. Spotify's homepage exposes only
32px/16px icons (no 180px touch icon found) — acceptable at `Avatar sm`
(32px), upscale guard needed for larger placements. Apple and GitHub serve
root `apple-touch-icon.png` directly (verified `200 image/png`).

## Suggested implementation (not started)

1. `scripts/fetch-brand-icons.mjs` — for each domain in the coverage table
   (`subscription-icons-research.md`): fetch homepage with a browser UA, parse
   `<link rel="apple-touch-icon">` first (prefer `sizes≥180`), else largest
   `rel="icon" type="image/png"`, download to
   `assets/brand-icons/<slug>.png`, record URL + bytes in a manifest JSON.
   Failure for one brand must not fail the run (log + keep previous file).
2. `src/utils/brand.ts` — extend `BRAND_BY_NAME` entries with `iconAsset`
   (`require('@/assets/brand-icons/<slug>.png')` map; Metro needs static
   requires, same as the splash glyph in `BrandLockup`).
3. Rows pass `avatarSource={iconAsset ?? faviconV2 URL}`; `Avatar` already
   prefers `source` over the Ionicon tile — no component changes.
4. Re-run quarterly or when a logo looks stale; diff the manifest in the commit.

## Legal: how to stay on the right side

- This is **nominative use**: showing Netflix's own N-mark next to the user's
  own Netflix subscription to identify it. Competitors operate the same way
  via aggregator licenses; without an aggregator, self-fetched official
  favicons + nominative use is the standard indie approach.
- Respect what the guidelines universally require: **don't recolor, stretch,
  or redraw the mark; don't imply endorsement** ("Manage your Netflix" copy
  is fine; "Netflix-approved" is not). If a Quiet Ledger tile tints the mark's
  background, prefer a neutral/white tile with the untouched mark over
  recoloring to fit the palette.
- Keep the Simple Icons disclaimer habit: each brand's press-kit page states
  its own terms — check the top ~10 brands' pages when vendoring, and honor a
  takedown-style request the same day (the manifest makes removal a one-line
  diff that falls back to the Ionicon tile).
- Never use the marks in `site/` marketing or App Store screenshots beyond
  factual depiction of the app UI without checking terms — product UI and
  marketing are treated differently.
