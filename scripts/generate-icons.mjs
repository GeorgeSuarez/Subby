/**
 * Generate Subby app icons, splash glyph, adaptive icons, favicon, and the
 * selected Ledger Stack logo preview.
 *
 * Brand direction: Quiet Ledger — recurring subscription rows on warm paper.
 * Light-first: paper canvas (#FDFCF9→#F0EBE3) with deep ink-teal mark
 * (#0E4A5C). The three staggered bars represent the user's recurring
 * expenses; the dots make each bar read as an individual service or billing record.
 *
 * Run: node scripts/generate-icons.mjs
 *
 * Canonical outputs (under assets/images/):
 *   icon.png                          1024×1024  iOS app icon
 *   ledger-stack-splash.png            200×200    Splash glyph (transparent bg)
 *   favicon.png                       48×48      Web favicon
 *   android-icon-foreground.png       432×432    Adaptive icon foreground
 *   android-icon-background.png       432×432    Adaptive icon background
 *   android-icon-monochrome.png       432×432    Android 13+ themed icon
 *
 * The selected logo preview is generated at assets/logo-options/ledger-stack.*.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

// Quiet Ledger palette — light-first paper hero, deep ink-teal accent (no neon).
const PAPER = '#FDFCF9';
const PAPER_DEEP = '#F0EBE3';
const ACCENT_DEEP = '#0E4A5C';
const ACCENT = '#22A0BF';
const ICON_DIR = 'assets/images';
const OPTIONS_DIR = 'assets/logo-options';

function iconBackground({ width = 1024, height = 1024 } = {}) {
  const radius = Math.round(Math.min(width, height) * 0.219);
  return `
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${PAPER}"/>
        <stop offset="100%" stop-color="${PAPER_DEEP}"/>
      </linearGradient>
      <linearGradient id="mark" x1="0.08" y1="0" x2="0.92" y2="1">
        <stop offset="0%" stop-color="${ACCENT}"/>
        <stop offset="100%" stop-color="${ACCENT_DEEP}"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" rx="${radius}" fill="url(#background)"/>
  `;
}

/** Three staggered recurring-expense rows with a cadence dot on each row. */
function ledgerMarkSVG({ fill = 'url(#mark)', dots = PAPER } = {}) {
  return `
    <g fill="${fill}">
      <rect x="118" y="142" width="276" height="66" rx="33"/>
      <rect x="164" y="223" width="276" height="66" rx="33" opacity="0.78"/>
      <rect x="118" y="304" width="276" height="66" rx="33" opacity="0.56"/>
    </g>
    <g fill="${dots}" opacity="0.72">
      <circle cx="152" cy="175" r="10"/>
      <circle cx="198" cy="256" r="10"/>
      <circle cx="152" cy="337" r="10"/>
    </g>
  `;
}

/** Selected app icon: the Ledger Stack mark on warm paper (light-first). */
function appIconSVG() {
  return `
    <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      ${iconBackground()}
      <g transform="scale(2)">
        ${ledgerMarkSVG()}
      </g>
    </svg>
  `;
}

/** Transparent glyph used for the splash screen and auth lockup. */
function glyphSVG() {
  return `
    <svg width="200" height="200" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mark" x1="0.08" y1="0" x2="0.92" y2="1">
          <stop offset="0%" stop-color="${ACCENT}"/>
          <stop offset="100%" stop-color="${ACCENT_DEEP}"/>
        </linearGradient>
      </defs>
      ${ledgerMarkSVG()}
    </svg>
  `;
}

/** Android adaptive background — warm paper behind the foreground (light-first). */
function adaptiveBackgroundSVG() {
  return `
    <svg width="432" height="432" viewBox="0 0 432 432" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${PAPER}"/>
          <stop offset="100%" stop-color="${PAPER_DEEP}"/>
        </linearGradient>
      </defs>
      <rect width="432" height="432" fill="url(#background)"/>
    </svg>
  `;
}

/** Android adaptive foreground — centered inside the adaptive safe zone. */
function adaptiveForegroundSVG() {
  return `
    <svg width="432" height="432" viewBox="0 0 432 432" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mark" x1="0.08" y1="0" x2="0.92" y2="1">
          <stop offset="0%" stop-color="${ACCENT}"/>
          <stop offset="100%" stop-color="${ACCENT_DEEP}"/>
        </linearGradient>
      </defs>
      <g transform="scale(0.844)">
        ${ledgerMarkSVG()}
      </g>
    </svg>
  `;
}

/** Android 13+ monochrome icon — a solid white Ledger Stack mark. */
function monochromeSVG() {
  return `
    <svg width="432" height="432" viewBox="0 0 432 432" xmlns="http://www.w3.org/2000/svg">
      <g transform="scale(0.844)">
        ${ledgerMarkSVG({ fill: '#FFFFFF', dots: '#FFFFFF' })}
      </g>
    </svg>
  `;
}

const logoOptions = [
  { slug: 'ledger-stack', svg: appIconSVG(), selected: true },
];

async function generate() {
  await mkdir(ICON_DIR, { recursive: true });
  await mkdir(OPTIONS_DIR, { recursive: true });

  const tasks = [
    { svg: appIconSVG(), file: `${ICON_DIR}/icon.png`, w: 1024, h: 1024 },
    {
      svg: glyphSVG(),
      file: `${ICON_DIR}/ledger-stack-splash.png`,
      w: 200,
      h: 200,
    },
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

  for (const task of tasks) {
    await sharp(Buffer.from(task.svg))
      .resize(task.w, task.h)
      .png()
      .toFile(task.file);
    console.log(`  ✓ ${task.file} (${task.w}×${task.h})`);
  }

  for (const option of logoOptions) {
    await writeFile(
      `${OPTIONS_DIR}/${option.slug}.svg`,
      option.svg.trimStart(),
    );
    await sharp(Buffer.from(option.svg))
      .resize(512, 512)
      .png()
      .toFile(`${OPTIONS_DIR}/${option.slug}.png`);
    console.log(`  ✓ ${OPTIONS_DIR}/${option.slug}.png (selected app logo)`);
  }

  console.log('Done. The Ledger Stack mark is selected in app config.');
}

generate().catch((error) => {
  console.error(error);
  process.exit(1);
});
