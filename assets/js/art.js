/* art.js — deterministic procedural box-art for a ROM.
 *
 * Takes a ROM record and returns an inline SVG string. Same input →
 * same art, so a game always looks the same even if the ID changes.
 */

function hash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hsl(h, s, l) { return `hsl(${h}, ${s}%, ${l}%)`; }

const CONSOLE_PALETTES = {
  wii:      [{ hue: 210, sat: 35, light: 70 }, { hue: 200, sat: 45, light: 50 }],
  gamecube: [{ hue: 265, sat: 55, light: 55 }, { hue: 250, sat: 65, light: 35 }],
  wiiu:     [{ hue: 195, sat: 60, light: 55 }, { hue: 215, sat: 70, light: 35 }],
  switch:   [{ hue: 350, sat: 70, light: 55 }, { hue: 215, sat: 80, light: 45 }],
  n64:      [{ hue: 45,  sat: 70, light: 55 }, { hue: 10,  sat: 70, light: 40 }],
  snes:     [{ hue: 275, sat: 50, light: 55 }, { hue: 320, sat: 60, light: 40 }],
  nes:      [{ hue: 0,   sat: 70, light: 50 }, { hue: 0,   sat: 10, light: 20 }],
  gb:       [{ hue: 75,  sat: 50, light: 55 }, { hue: 80,  sat: 40, light: 30 }],
  gba:      [{ hue: 265, sat: 70, light: 50 }, { hue: 275, sat: 60, light: 30 }],
  genesis:  [{ hue: 0,   sat: 80, light: 50 }, { hue: 0,   sat: 0,  light: 10 }],
  ps1:      [{ hue: 215, sat: 50, light: 45 }, { hue: 215, sat: 20, light: 15 }],
};

function cleanTitle(name) {
  return String(name)
    .replace(/\.[a-z0-9]{2,5}$/i, '')          // strip extension
    .replace(/\[[^\]]*\]/g, '')                // strip [bracket tags]
    .replace(/\([^)]*\)/g, '')                 // strip (bracket tags)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function initials(name) {
  const words = cleanTitle(name).split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words[0]) return words[0].slice(0, 2).toUpperCase();
  return '??';
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' }[c]));
}

/* Box art — portrait, with grainy stripe + title stripe */
export function boxArt(rom, { w = 220, h = 300 } = {}) {
  const palette = CONSOLE_PALETTES[rom.console] || CONSOLE_PALETTES.ps1;
  const h1 = hash(rom.name);
  const h2 = hash(rom.name.split('').reverse().join(''));
  const hueShift = h1 % 20 - 10;
  const bg1 = hsl((palette[0].hue + hueShift + 360) % 360, palette[0].sat, palette[0].light);
  const bg2 = hsl((palette[1].hue + hueShift + 360) % 360, palette[1].sat, palette[1].light);
  const accent = hsl((palette[0].hue + 180 + hueShift + 360) % 360, 70, 65);
  const title = cleanTitle(rom.name).slice(0, 26);
  const inits = initials(rom.name);
  const gradId = `g-${h1.toString(36)}`;
  const console = (rom.console || '').toUpperCase();

  // Pseudo-random geometric shapes
  const shapes = [];
  const rng = (n) => ((hash(rom.name + ':' + n) % 1000) / 1000);
  for (let i = 0; i < 5; i++) {
    const cx = rng(i * 2) * w;
    const cy = 60 + rng(i * 2 + 1) * (h - 160);
    const r  = 10 + rng(i * 3) * 50;
    const opacity = 0.1 + rng(i * 5) * 0.2;
    shapes.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${accent}" opacity="${opacity.toFixed(2)}"/>`);
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="${gradId}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${bg1}"/>
      <stop offset="1" stop-color="${bg2}"/>
    </linearGradient>
    <clipPath id="c-${gradId}">
      <rect width="${w}" height="${h}" rx="6"/>
    </clipPath>
  </defs>
  <g clip-path="url(#c-${gradId})">
    <rect width="${w}" height="${h}" fill="url(#${gradId})"/>
    ${shapes.join('')}
    <rect x="0" y="${h - 90}" width="${w}" height="90" fill="rgba(0,0,0,0.5)"/>
    <text x="${w/2}" y="${h/2 - 20}" font-family="-apple-system, system-ui, sans-serif" font-size="56" font-weight="900"
          text-anchor="middle" fill="white" opacity="0.95" letter-spacing="-2">${inits}</text>
    <text x="12" y="${h - 56}" font-family="-apple-system, system-ui, sans-serif" font-size="13" font-weight="700"
          fill="white">${escapeXml(title)}</text>
    <text x="12" y="${h - 36}" font-family="-apple-system, system-ui, sans-serif" font-size="10"
          fill="rgba(255,255,255,0.7)" letter-spacing="2">${console}</text>
    <rect x="12" y="${h - 22}" width="40" height="3" fill="${accent}"/>
  </g>
</svg>`;
}

/* Smaller square variant for grid tiles */
export function boxTile(rom, { size = 160 } = {}) {
  const palette = CONSOLE_PALETTES[rom.console] || CONSOLE_PALETTES.ps1;
  const h1 = hash(rom.name);
  const hueShift = h1 % 20 - 10;
  const bg1 = hsl((palette[0].hue + hueShift + 360) % 360, palette[0].sat, palette[0].light);
  const bg2 = hsl((palette[1].hue + hueShift + 360) % 360, palette[1].sat, palette[1].light);
  const accent = hsl((palette[0].hue + 120 + hueShift + 360) % 360, 65, 60);
  const inits = initials(rom.name);
  const gradId = `t-${h1.toString(36)}`;

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="${gradId}" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${bg1}"/>
      <stop offset="1" stop-color="${bg2}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="6" fill="url(#${gradId})"/>
  <circle cx="${size * 0.8}" cy="${size * 0.25}" r="${size * 0.3}" fill="${accent}" opacity="0.4"/>
  <text x="${size/2}" y="${size/2 + 18}" font-family="-apple-system, system-ui, sans-serif"
        font-size="${size * 0.44}" font-weight="900" text-anchor="middle" fill="white" letter-spacing="-2">${inits}</text>
</svg>`;
}
