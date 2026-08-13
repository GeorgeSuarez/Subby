/**
 * Generate branded app icons, splash glyph, adaptive icons, and favicon.
 *
 * Design language: cool dark-first + electric-cyan accent (#22D3EE on #0B0F14).
 * The glyph is a stylized circular arrow (↻) — the universal "recurring"
 * symbol — rendered as a partial ring with a gap and an arrowhead, evoking
 * the subscription/billing-cycle concept.
 *
 * Run: node scripts/generate-icons.mjs
 *
 * Produces (all under assets/images/):
 *   icon.png                          1024×1024  iOS app icon
 *   splash-icon.png                   200×200    Splash glyph (transparent bg)
 *   favicon.png                       48×48      Web favicon
 *   android-icon-foreground.png       432×432    Adaptive icon foreground
 *   android-icon-background.png       432×432    Adaptive icon background
 *   android-icon-monochrome.png       432×432    Android 13+ themed icon
 */

import sharp from 'sharp';

const DARK = '#0B0F14';
const ELEVATED = '#131920';
const CYAN = '#22D3EE';
const ICON_DIR = 'assets/images';

// ---------------------------------------------------------------------------
// SVG generators
// ---------------------------------------------------------------------------

/** Cyan recurring-arrow glyph on dark rounded square — the iOS icon */
function appIconSVG() {
  return `
    <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#131920"/>
          <stop offset="100%" stop-color="${DARK}"/>
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="12" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="1024" height="1024" rx="224" fill="url(#bg)"/>
      <!-- Recurring arrow: ~75% ring with arrowhead -->
      <g transform="translate(512, 512)" filter="url(#glow)">
        <!-- Ring arc (75% circle, gap at top) -->
        <path d="
          M 0,-230
          A 230,230 0 1,1 -219,71
        " fill="none" stroke="${CYAN}" stroke-width="72" stroke-linecap="round"/>
        <!-- Arrowhead at the end of the arc (bottom-left) -->
        <polygon points="-160,42 -272,108 -212,170" fill="${CYAN}"/>
      </g>
    </svg>
  `;
}

/** Glyph only — transparent background, used for splash + favicon */
function glyphSVG() {
  return `
    <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(100, 100)">
        <path d="
          M 0,-72
          A 72,72 0 1,1 -68,22
        " fill="none" stroke="${CYAN}" stroke-width="22" stroke-linecap="round"/>
        <polygon points="-50,13 -85,34 -67,53" fill="${CYAN}"/>
      </g>
    </svg>
  `;
}

/** Android adaptive background — solid dark with subtle gradient */
function adaptiveBackgroundSVG() {
  return `
    <svg width="432" height="432" viewBox="0 0 432 432" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${ELEVATED}"/>
          <stop offset="100%" stop-color="${DARK}"/>
        </linearGradient>
      </defs>
      <rect width="432" height="432" fill="url(#bg)"/>
    </svg>
  `;
}

/** Android adaptive foreground — glyph centered with padding for safe zone */
function adaptiveForegroundSVG() {
  return `
    <svg width="432" height="432" viewBox="0 0 432 432" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(216, 216)">
        <path d="
          M 0,-100
          A 100,100 0 1,1 -95,31
        " fill="none" stroke="${CYAN}" stroke-width="30" stroke-linecap="round"/>
        <polygon points="-68,18 -116,47 -91,73" fill="${CYAN}"/>
      </g>
    </svg>
  `;
}

/** Android 13+ monochrome icon — white glyph on transparent (system tints) */
function monochromeSVG() {
  return `
    <svg width="432" height="432" viewBox="0 0 432 432" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(216, 216)">
        <path d="
          M 0,-100
          A 100,100 0 1,1 -95,31
        " fill="none" stroke="#FFFFFF" stroke-width="30" stroke-linecap="round"/>
        <polygon points="-68,18 -116,47 -91,73" fill="#FFFFFF"/>
      </g>
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// Render + write
// ---------------------------------------------------------------------------

async function generate() {
  const tasks = [
    { svg: appIconSVG(), file: `${ICON_DIR}/icon.png`, w: 1024, h: 1024 },
    { svg: glyphSVG(), file: `${ICON_DIR}/splash-icon.png`, w: 200, h: 200 },
    { svg: glyphSVG(), file: `${ICON_DIR}/favicon.png`, w: 48, h: 48 },
    {
      svg: adaptiveBackgroundSVG(),
      file: `${ICON_DIR}/android-icon-background.png`,
      w: 432,
      h: 432,
    },
    {
      svg: adaptiveForegroundSVG(),
      file: `${ICON_DIR}/android-icon-foreground.png`,
      w: 432,
      h: 432,
    },
    {
      svg: monochromeSVG(),
      file: `${ICON_DIR}/android-icon-monochrome.png`,
      w: 432,
      h: 432,
    },
  ];

  for (const t of tasks) {
    await sharp(Buffer.from(t.svg)).resize(t.w, t.h).png().toFile(t.file);
    console.log(`  ✓ ${t.file} (${t.w}×${t.h})`);
  }
  console.log('Done.');
}

generate().catch((e) => {
  console.error(e);
  process.exit(1);
});
