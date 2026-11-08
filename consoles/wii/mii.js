/* Tiny Mii renderer + storage. Not Nintendo's engine — a stylised tribute. */

const DEFAULT = {
  face:  'round',       // round | oval | square
  skin:  '#f5d4b3',
  hair:  'short',       // short | long | bald | spike
  hairC: '#3a2a1a',
  eye:   'dot',         // dot | oval | line
  mouth: 'smile',       // smile | grin | line | frown
  name:  'Mii',
};

const SKINS  = ['#f5d4b3', '#e8b28f', '#c88b5f', '#8d5a2e', '#f8e3c7'];
const HAIRS  = ['#2a1a0a', '#6b3f1f', '#c9a267', '#d94747', '#4b5563'];

/* Render a Mii SVG — compact (viewBox 0 0 100 100). */
export function miiSvg(m = DEFAULT, { size = 100 } = {}) {
  const cfg = { ...DEFAULT, ...m };

  // Face shape
  let face = '';
  if (cfg.face === 'round')  face = `<circle cx="50" cy="52" r="34" fill="${cfg.skin}" stroke="#333" stroke-width="2"/>`;
  if (cfg.face === 'oval')   face = `<ellipse cx="50" cy="54" rx="28" ry="36" fill="${cfg.skin}" stroke="#333" stroke-width="2"/>`;
  if (cfg.face === 'square') face = `<rect x="18" y="20" width="64" height="66" rx="18" fill="${cfg.skin}" stroke="#333" stroke-width="2"/>`;

  // Hair
  let hair = '';
  if (cfg.hair === 'short') hair = `<path d="M 16 42 Q 20 10 50 10 Q 80 10 84 42 L 80 32 Q 70 24 50 24 Q 30 24 20 32 Z" fill="${cfg.hairC}"/>`;
  if (cfg.hair === 'long')  hair = `<path d="M 14 56 Q 14 10 50 8 Q 86 10 86 56 L 86 76 L 78 72 L 78 40 Q 70 28 50 28 Q 30 28 22 40 L 22 72 L 14 76 Z" fill="${cfg.hairC}"/>`;
  if (cfg.hair === 'spike') hair = `<path d="M 22 36 L 28 12 L 32 32 L 40 10 L 44 30 L 50 8 L 56 30 L 60 10 L 68 32 L 72 12 L 78 36 Q 80 40 76 44 Q 50 30 24 44 Q 20 40 22 36 Z" fill="${cfg.hairC}"/>`;
  if (cfg.hair === 'bald')  hair = '';

  // Eyes
  const ey = 50;
  let eyes = '';
  if (cfg.eye === 'dot')  eyes = `<circle cx="38" cy="${ey}" r="3.5" fill="#1a1a1a"/><circle cx="62" cy="${ey}" r="3.5" fill="#1a1a1a"/>`;
  if (cfg.eye === 'oval') eyes = `<ellipse cx="38" cy="${ey}" rx="3.5" ry="5" fill="#1a1a1a"/><ellipse cx="62" cy="${ey}" rx="3.5" ry="5" fill="#1a1a1a"/>`;
  if (cfg.eye === 'line') eyes = `<rect x="33" y="${ey-1}" width="10" height="2" fill="#1a1a1a"/><rect x="57" y="${ey-1}" width="10" height="2" fill="#1a1a1a"/>`;

  // Mouth
  let mouth = '';
  if (cfg.mouth === 'smile') mouth = `<path d="M 40 66 Q 50 74 60 66" fill="none" stroke="#1a1a1a" stroke-width="2.5" stroke-linecap="round"/>`;
  if (cfg.mouth === 'grin')  mouth = `<path d="M 36 64 Q 50 78 64 64 L 60 68 L 40 68 Z" fill="#8e2a60" stroke="#1a1a1a" stroke-width="1.5"/>`;
  if (cfg.mouth === 'line')  mouth = `<rect x="42" y="68" width="16" height="2" fill="#1a1a1a"/>`;
  if (cfg.mouth === 'frown') mouth = `<path d="M 40 72 Q 50 64 60 72" fill="none" stroke="#1a1a1a" stroke-width="2.5" stroke-linecap="round"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
    ${face}${hair}${eyes}${mouth}
  </svg>`;
}

/* Storage */
export function listMiis() {
  try { return JSON.parse(localStorage.getItem('miis') || '[]'); }
  catch { return []; }
}
export function saveMii(m) {
  const list = listMiis();
  const cfg = { ...m, id: Date.now() };
  list.push(cfg);
  localStorage.setItem('miis', JSON.stringify(list));
  return cfg;
}
export function removeMii(id) {
  const list = listMiis().filter(x => x.id !== id);
  localStorage.setItem('miis', JSON.stringify(list));
}

export { DEFAULT, SKINS, HAIRS };
