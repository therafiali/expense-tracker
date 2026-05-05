/**
 * Generates app icon and splash image from design tokens (requires sharp).
 * Run: node scripts/generate-brand-assets.cjs
 */
const sharp = require('sharp');
const path = require('path');

const primary = '#A5E8FD';
const fg = '#2A6174';

const iconSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" rx="230" fill="${primary}"/>
  <circle cx="512" cy="520" r="220" fill="${fg}" opacity="0.18"/>
  <path d="M420 420h184q52 0 88 36t36 88v20q0 52-36 88t-88 36H420q-28 0-48-20t-20-48V468q0-28 20-48t48-20z"
        fill="none" stroke="${fg}" stroke-width="40" stroke-linejoin="round"/>
  <path d="M420 520h208M532 440v160" stroke="${fg}" stroke-width="36" stroke-linecap="round"/>
</svg>`;

const splashSvg = `
<svg width="1284" height="2778" viewBox="0 0 1284 2778" xmlns="http://www.w3.org/2000/svg">
  <rect width="1284" height="2778" fill="${primary}"/>
  <g transform="translate(642,1200)">
    <circle r="180" fill="${fg}" opacity="0.2"/>
    <path d="M-120-80h240q48 0 82 34t34 82v16q0 48-34 82t-82 34h-240q-24 0-41-17t-17-41v-192q0-24 17-41t41-17z"
          fill="none" stroke="${fg}" stroke-width="32" stroke-linejoin="round"/>
    <path d="M-120 32h272M0-56v176" stroke="${fg}" stroke-width="28" stroke-linecap="round"/>
  </g>
</svg>`;

async function main() {
  const outDir = path.join(__dirname, '..', 'assets', 'images');
  await sharp(Buffer.from(iconSvg)).png().toFile(path.join(outDir, 'icon.png'));
  await sharp(Buffer.from(splashSvg)).png().toFile(path.join(outDir, 'splash-icon.png'));
  console.log('Wrote assets/images/icon.png and splash-icon.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
