import { benchmark, unlocked, tierFor, TIERS } from './hardware.js';
import { play, ctx as audioCtx } from './sound.js';
import { addRom, listRoms, removeRom, formatBytes, classifyFile } from './roms.js';
import { quota, sizes, isPersistent, requestPersistent,
         clearRoms, clearScreenshots, clearSaves, clearAchievements, clearEverything,
         ratioToLabel, ratioColor } from './storage.js';

/* ---------- Starfield ---------- */
function starfield(canvas) {
  const ctx = canvas.getContext('2d');
  let w, h, stars;
  function resize() {
    w = canvas.width = window.innerWidth * devicePixelRatio;
    h = canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    stars = Array.from({ length: Math.round((w * h) / 9000) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: Math.random() * 0.8 + 0.2,
      r: Math.random() * 1.2 + 0.3,
      tw: Math.random() * Math.PI * 2,
      twSpeed: Math.random() * 0.03 + 0.01,
    }));
  }
  resize();
  window.addEventListener('resize', resize);

  let mouseX = 0, mouseY = 0;
  window.addEventListener('mousemove', e => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  function frame() {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      s.tw += s.twSpeed;
      const px = s.x + mouseX * 20 * s.z * devicePixelRatio;
      const py = s.y + mouseY * 20 * s.z * devicePixelRatio;
      const a = 0.4 + Math.sin(s.tw) * 0.3;
      ctx.beginPath();
      ctx.arc(px, py, s.r * devicePixelRatio, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${200 + (1 - s.z) * 55}, ${220 + (1 - s.z) * 35}, 255, ${a * s.z})`;
      ctx.fill();
    }
    // slow drift
    for (const s of stars) {
      s.y += s.z * 0.15;
      if (s.y > h) { s.y = 0; s.x = Math.random() * w; }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ---------- Boot sequence ---------- */
function bootInto(consoleKey) {
  play('picker', 'boot');
  const out = document.getElementById('bootout');
  out.classList.add('on');
  setTimeout(() => {
    location.href = `consoles/${consoleKey}/index.html`;
  }, 1200);
}

/* ---------- Hardware UI ---------- */
function paintHardware(report) {
  document.getElementById('hw-cores').innerHTML = `CPU<b>${report.cores}c · ${report.micro.ms}ms</b>`;
  document.getElementById('hw-mem').innerHTML   = `RAM<b>${report.memGB} GB</b>`;
  document.getElementById('hw-gpu').innerHTML   = `GPU<b title="${report.gpu.renderer}">${shortGpu(report.gpu.renderer)}</b>`;
  const feats = [
    report.wasm.simd    ? 'SIMD'    : null,
    report.wasm.threads ? 'Threads' : null,
    report.wasm.bulkMemory ? 'Bulk' : null,
  ].filter(Boolean).join(' · ') || 'none';
  document.getElementById('hw-wasm').innerHTML = `WASM<b>${feats}</b>`;

  const ring = document.querySelector('.score-ring .fg');
  const circ = 2 * Math.PI * 34;
  ring.setAttribute('stroke-dasharray', circ);
  ring.setAttribute('stroke-dashoffset', circ);
  requestAnimationFrame(() => {
    ring.setAttribute('stroke-dashoffset', circ * (1 - report.total / 100));
  });

  document.getElementById('score-value').textContent = report.total;
  document.getElementById('score-label').textContent = `Tier ${report.tier} · ${report.tierName}`;
}

function shortGpu(r) {
  if (!r) return 'unknown';
  r = String(r);
  const m = r.match(/Apple M\d+\s*\w*/i) || r.match(/RTX\s*\d+\s*\w*/i)
          || r.match(/RX\s*\d+\s*\w*/i) || r.match(/GTX\s*\d+\s*\w*/i)
          || r.match(/Intel\s+\w+/i) || r.match(/Adreno\s+\d+/i)
          || r.match(/Mali-\w+/i);
  return m ? m[0] : (r.length > 24 ? r.slice(0, 22) + '…' : r);
}

/* ---------- Cards ---------- */
const CONSOLES = [
  { key: 'wii',      name: 'Wii',        sub: '2006',                  tier: 3 },
  { key: 'gamecube', name: 'GameCube',   sub: '2001',                  tier: 3 },
  { key: 'wiiu',     name: 'Wii U',      sub: '2012',                  tier: 4 },
  { key: 'switch',   name: 'Switch',     sub: '2017',                  tier: 4 },
  { key: 'n64',      name: 'N64',        sub: '1996',                  tier: 2 },
  { key: 'ps1',      name: 'PlayStation', sub: '1994',                 tier: 2 },
  { key: 'gba',      name: 'Game Boy Advance', sub: '2001',            tier: 1 },
  { key: 'gb',       name: 'Game Boy',   sub: '1989',                  tier: 1 },
  { key: 'snes',     name: 'SNES',       sub: '1990',                  tier: 1 },
  { key: 'genesis',  name: 'Genesis',    sub: '1988',                  tier: 1 },
  { key: 'nes',      name: 'NES',        sub: '1983',                  tier: 1 },
];

const SILHOUETTES = {
  wii: `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#eaf4ff"/><stop offset="1" stop-color="#6b8bd5"/></linearGradient></defs>
    <rect x="48" y="20" width="24" height="110" rx="4" fill="url(#g1)" stroke="#9ab6ea" stroke-width="1.2"/>
    <rect x="50" y="46" width="20" height="2.4" fill="#2a3b66"/>
    <circle cx="60" cy="38" r="2.4" fill="#2a3b66"/>
    <rect x="52" y="78" width="16" height="3" fill="#2a3b66" opacity="0.4"/>
    <rect x="52" y="82" width="16" height="2" fill="#2a3b66" opacity="0.4"/>
  </svg>`,
  gamecube: `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g2" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#a78bfa"/><stop offset="1" stop-color="#4c1d95"/></linearGradient></defs>
    <rect x="34" y="40" width="52" height="60" rx="5" fill="url(#g2)" stroke="#c4b5fd" stroke-width="1.2"/>
    <circle cx="60" cy="60" r="10" fill="none" stroke="#fff" stroke-opacity="0.6"/>
    <circle cx="60" cy="60" r="3" fill="#fff" fill-opacity="0.9"/>
    <rect x="50" y="85" width="20" height="4" rx="1" fill="#2a1860"/>
    <rect x="30" y="100" width="60" height="6" fill="#2a1860" opacity="0.55"/>
  </svg>`,
  wiiu: `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g3" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#e2e8f0"/><stop offset="1" stop-color="#64748b"/></linearGradient></defs>
    <rect x="20" y="52" width="80" height="48" rx="7" fill="url(#g3)" stroke="#94a3b8" stroke-width="1"/>
    <rect x="30" y="60" width="60" height="32" rx="3" fill="#0f172a"/>
    <circle cx="26" cy="76" r="3" fill="#0f172a"/>
    <circle cx="94" cy="76" r="3" fill="#0f172a"/>
  </svg>`,
  switch: `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
    <rect x="22" y="40" width="76" height="80" rx="8" fill="#0f172a" stroke="#1e293b" stroke-width="1.5"/>
    <rect x="30" y="48" width="60" height="64" rx="3" fill="#1e293b"/>
    <rect x="22" y="40" width="16" height="80" rx="8" fill="#e11d48" opacity="0.9"/>
    <rect x="82" y="40" width="16" height="80" rx="8" fill="#2563eb" opacity="0.9"/>
    <circle cx="30" cy="60" r="2" fill="#f9fafb"/>
    <circle cx="90" cy="100" r="2" fill="#f9fafb"/>
  </svg>`,
  n64: `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
    <path d="M 60 40 L 92 60 L 92 100 L 60 120 L 28 100 L 28 60 Z"
          fill="#4b5563" stroke="#9ca3af" stroke-width="1.4"/>
    <circle cx="60" cy="80" r="8" fill="#111827" stroke="#9ca3af" stroke-width="1"/>
    <path d="M 60 80 L 60 70 M 60 80 L 68 84 M 60 80 L 52 84" stroke="#fde68a" stroke-width="1.6" fill="none"/>
    <rect x="46" y="58" width="28" height="3" fill="#111827"/>
  </svg>`,
  snes: `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
    <rect x="18" y="58" width="84" height="40" rx="4" fill="#9ca3af" stroke="#d1d5db" stroke-width="1"/>
    <rect x="18" y="50" width="84" height="12" rx="3" fill="#6b7280"/>
    <circle cx="36" cy="80" r="3" fill="#dc2626"/>
    <circle cx="50" cy="80" r="3" fill="#2563eb"/>
    <circle cx="70" cy="80" r="3" fill="#eab308"/>
    <circle cx="84" cy="80" r="3" fill="#16a34a"/>
    <rect x="36" y="100" width="48" height="4" rx="1" fill="#6b7280"/>
  </svg>`,
  gb: `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
    <rect x="30" y="18" width="60" height="124" rx="6" fill="#d9e3a7" stroke="#6b7a3a" stroke-width="1.5"/>
    <rect x="36" y="30" width="48" height="36" rx="2" fill="#4a5a28"/>
    <rect x="40" y="34" width="40" height="28" fill="#8fa663"/>
    <circle cx="45" cy="82" r="6" fill="#4a3030"/>
    <circle cx="45" cy="82" r="3" fill="#2a1a1a"/>
    <circle cx="68" cy="82" r="3" fill="#8e2a60"/>
    <circle cx="78" cy="82" r="3" fill="#8e2a60"/>
    <rect x="48" y="110" width="24" height="3" rx="1" fill="#6b7a3a"/>
    <rect x="48" y="118" width="24" height="3" rx="1" fill="#6b7a3a"/>
  </svg>`,
  gba: `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="50" width="100" height="56" rx="12" fill="#6b21a8" stroke="#a855f7" stroke-width="1.5"/>
    <rect x="34" y="58" width="52" height="38" rx="3" fill="#1e1b4b"/>
    <rect x="37" y="61" width="46" height="32" fill="#4c1d95"/>
    <circle cx="22" cy="70" r="3" fill="#1e1b4b"/>
    <circle cx="22" cy="86" r="3" fill="#1e1b4b"/>
    <circle cx="96" cy="72" r="3" fill="#dc2626"/>
    <circle cx="104" cy="82" r="3" fill="#16a34a"/>
    <rect x="16" y="78" width="4" height="4" fill="#1e1b4b"/>
  </svg>`,
  genesis: `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
    <rect x="16" y="56" width="88" height="48" rx="3" fill="#1a1a1a" stroke="#dc2626" stroke-width="1.5"/>
    <rect x="22" y="62" width="76" height="4" rx="1" fill="#dc2626"/>
    <circle cx="50" cy="84" r="8" fill="#0a0a0a" stroke="#dc2626"/>
    <rect x="66" y="80" width="28" height="8" rx="1" fill="#2a2a2a"/>
    <rect x="22" y="104" width="76" height="4" fill="#dc2626" opacity="0.6"/>
  </svg>`,
  ps1: `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
    <rect x="14" y="52" width="92" height="56" rx="2" fill="#d4d4d4" stroke="#737373" stroke-width="1.2"/>
    <circle cx="60" cy="80" r="22" fill="#525252" stroke="#737373" stroke-width="1"/>
    <circle cx="60" cy="80" r="6" fill="#171717"/>
    <rect x="22" y="100" width="12" height="4" fill="#525252"/>
    <rect x="42" y="100" width="12" height="4" fill="#dc2626"/>
    <rect x="62" y="100" width="12" height="4" fill="#eab308"/>
    <rect x="82" y="100" width="12" height="4" fill="#16a34a"/>
  </svg>`,
  nes: `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
    <rect x="12" y="60" width="96" height="40" rx="2" fill="#d1d5db" stroke="#9ca3af" stroke-width="1"/>
    <rect x="18" y="66" width="60" height="18" rx="1" fill="#f3f4f6"/>
    <rect x="86" y="66" width="18" height="4" rx="1" fill="#dc2626"/>
    <rect x="86" y="74" width="18" height="4" rx="1" fill="#dc2626"/>
    <rect x="28" y="86" width="20" height="4" fill="#9ca3af"/>
    <rect x="54" y="86" width="20" height="4" fill="#9ca3af"/>
    <rect x="12" y="100" width="96" height="4" fill="#6b7280"/>
  </svg>`,
};

function card(c, report) {
  const isUnlocked = unlocked(report, c.key);
  const el = document.createElement('div');
  el.className = 'card' + (isUnlocked ? '' : ' locked');
  el.dataset.console = c.key;
  el.innerHTML = `
    <span class="tier"><span class="dot"></span>Tier ${c.tier}</span>
    <div class="silhouette">${SILHOUETTES[c.key]}</div>
    <div class="name">${c.name}</div>
    <div class="sub">${c.sub}</div>
    <div class="status">${isUnlocked ? 'Ready to boot' : 'Hardware insufficient'}</div>
  `;
  el.addEventListener('mouseenter', () => {
    if (isUnlocked) play('picker', 'hover');
  });
  el.addEventListener('click', () => {
    if (!isUnlocked) { play('picker', 'locked'); el.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }],
      { duration: 240, easing: 'ease-out' }
    ); return; }
    play('picker', 'select');
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.1)', boxShadow: '0 0 90px rgba(96,165,250,0.9)' }],
      { duration: 500, fill: 'forwards' });
    setTimeout(() => bootInto(c.key), 450);
  });
  return el;
}

/* ---------- ROM library ---------- */
async function openLibrary() {
  const m = document.getElementById('library-modal');
  m.classList.add('open');
  refreshLibrary();
}
async function refreshLibrary() {
  const list = document.getElementById('rom-list');
  const roms = await listRoms();
  if (!roms.length) {
    list.innerHTML = `<div class="rom-item" style="opacity:0.6;grid-template-columns:1fr;text-align:center">No ROMs yet — drop files below.</div>`;
    return;
  }
  list.innerHTML = roms.sort((a,b) => b.added - a.added).map(r => `
    <div class="rom-item" data-id="${r.id}">
      <span class="badge">${r.console}</span>
      <span class="name">${r.name}</span>
      <span class="size">${formatBytes(r.size)}</span>
      <span class="size">${new Date(r.added).toLocaleDateString()}</span>
      <button class="del" data-del="${r.id}" title="Remove">✕</button>
    </div>
  `).join('');
  list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async e => {
    await removeRom(+e.target.dataset.del);
    refreshLibrary();
  }));
}
async function ingestFiles(files) {
  const warnings = [];
  for (const f of files) {
    try {
      const meta = classifyFile(f.name);
      if (!meta) { warnings.push(`${f.name}: unknown extension`); continue; }
      await addRom(f);
    } catch (e) {
      warnings.push(`${f.name}: ${e.message}`);
    }
  }
  if (warnings.length) alert('Some files skipped:\n\n' + warnings.join('\n'));
  refreshLibrary();
}

/* ---------- Init ---------- */
async function init() {
  starfield(document.getElementById('stars-canvas'));

  // Unlock audio on first interaction
  const unlock = () => { try { audioCtx(); } catch {} document.removeEventListener('pointerdown', unlock); };
  document.addEventListener('pointerdown', unlock);

  // Benchmark & paint
  const report = await benchmark();
  paintHardware(report);

  // Cards
  const ring = document.getElementById('ring');
  CONSOLES.forEach((c, i) => {
    const el = card(c, report);
    el.style.animationDelay = `${0.15 + i * 0.08}s`;
    ring.appendChild(el);
  });

  // Keyboard + gamepad nav
  setupInputs(ring);

  // Library
  document.getElementById('open-library').addEventListener('click', openLibrary);
  document.getElementById('close-library').addEventListener('click', () => {
    document.getElementById('library-modal').classList.remove('open');
  });
  const dz = document.getElementById('drop-zone');
  dz.addEventListener('click', () => document.getElementById('rom-input').click());
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('hot'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('hot'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('hot');
    ingestFiles([...e.dataTransfer.files]);
  });
  document.getElementById('rom-input').addEventListener('change', e => ingestFiles([...e.target.files]));

  // Info modal
  document.getElementById('open-info').addEventListener('click', () => {
    document.getElementById('info-modal').classList.add('open');
  });
  document.getElementById('close-info').addEventListener('click', () => {
    document.getElementById('info-modal').classList.remove('open');
  });

  // Storage
  await paintStorage();
  document.getElementById('hw-disk').addEventListener('click', openStorage);
  document.getElementById('close-storage').addEventListener('click', () => {
    document.getElementById('storage-modal').classList.remove('open');
  });
  // Re-paint storage after adds/removes
  window.addEventListener('rom:added', paintStorage);
}

/* ---------- Storage ---------- */

async function paintStorage() {
  const q = await quota();
  const pill = document.getElementById('hw-disk');
  const fill = pill.querySelector('.fill');
  const bold = pill.querySelector('b');
  if (q.unknown) {
    bold.textContent = 'n/a';
    fill.style.width = '0%';
    return;
  }
  const pct = Math.round(q.ratio * 100);
  bold.textContent = `${pct}%`;
  bold.style.color = ratioColor(q.ratio);
  fill.style.width = `${pct}%`;
  fill.style.background = ratioColor(q.ratio);
}

async function openStorage() {
  const m = document.getElementById('storage-modal');
  m.classList.add('open');
  await refreshStorage();

  // Wire clear buttons once
  if (!m.dataset.wired) {
    m.dataset.wired = '1';
    m.querySelectorAll('[data-clear]').forEach(b => b.onclick = async () => {
      const t = b.dataset.clear;
      const confirms = {
        roms:     'Delete every ROM in every console library?',
        shots:    'Delete every screenshot?',
        saves:    'Delete every save state?',
        trophies: 'Reset every trophy you have unlocked?',
        all:      'Delete every ROM, screenshot, save state and playtime record? (Trophies kept.)',
      };
      if (!window.confirm(confirms[t])) return;
      if      (t === 'roms')     await clearRoms();
      else if (t === 'shots')    await clearScreenshots();
      else if (t === 'saves')    await clearSaves();
      else if (t === 'trophies') await clearAchievements();
      else if (t === 'all')      await clearEverything();
      await refreshStorage();
      await paintStorage();
      window.dispatchEvent(new CustomEvent('rom:added')); // trigger redraws
    });
    document.getElementById('btn-persist').onclick = async () => {
      const ok = await requestPersistent();
      alert(ok ? 'Persistent storage granted — your browser won\'t silently evict Nin64 data.'
               : 'Your browser declined persistent storage. Data may be evicted under pressure.');
      refreshStorage();
    };
  }
}

async function refreshStorage() {
  const q = await quota();
  const s = await sizes();
  document.getElementById('storage-usage').textContent = q.unknown ? 'unknown' : formatBytes(q.usage);
  document.getElementById('storage-quota').textContent = q.unknown ? 'unknown' : formatBytes(q.quota);
  document.getElementById('storage-label').textContent = q.unknown ? 'Browser doesn\'t expose quota.' : `${ratioToLabel(q.ratio)} — ${(q.ratio*100).toFixed(1)}% of your Nin64 cap in this browser.`;

  const ring = document.getElementById('storage-ring');
  const circ = 2 * Math.PI * 50;
  ring.setAttribute('stroke-dasharray', circ);
  ring.setAttribute('stroke-dashoffset', circ * (1 - (q.ratio || 0)));
  ring.setAttribute('stroke', ratioColor(q.ratio || 0));
  document.getElementById('storage-pct').textContent = q.unknown ? '—' : `${Math.round(q.ratio * 100)}%`;
  document.getElementById('storage-pct').style.color = ratioColor(q.ratio || 0);

  const persisted = await isPersistent();
  const per = document.getElementById('storage-persisted');
  per.textContent = persisted ? 'granted' : 'not granted';
  per.style.color = persisted ? 'var(--accent-3)' : 'var(--locked)';
  document.getElementById('btn-persist').style.display = persisted ? 'none' : '';

  document.getElementById('st-roms').textContent    = formatBytes(s.roms);
  document.getElementById('st-roms-sub').textContent = `${s.counts.roms} file${s.counts.roms === 1 ? '' : 's'}`;
  document.getElementById('st-shots').textContent   = formatBytes(s.screenshots);
  document.getElementById('st-shots-sub').textContent = `${s.counts.screenshots} image${s.counts.screenshots === 1 ? '' : 's'}`;
  document.getElementById('st-saves').textContent   = formatBytes(s.saves);
  document.getElementById('st-saves-sub').textContent = `${s.counts.saves} state${s.counts.saves === 1 ? '' : 's'}`;
  document.getElementById('st-other').textContent   = formatBytes(Math.max(0, (q.usage || 0) - s.total));

  document.getElementById('cr-roms').textContent  = `${s.counts.roms} file${s.counts.roms === 1 ? '' : 's'} · ${formatBytes(s.roms)}`;
  document.getElementById('cr-shots').textContent = `${s.counts.screenshots} · ${formatBytes(s.screenshots)}`;
  document.getElementById('cr-saves').textContent = `${s.counts.saves} · ${formatBytes(s.saves)}`;
}

/* ---------- Input: keyboard + gamepad ---------- */

function setupInputs(ring) {
  const cards = () => [...ring.querySelectorAll('.card')];
  let focusIdx = 0;
  function focus(i) {
    const cs = cards();
    if (!cs.length) return;
    focusIdx = ((i % cs.length) + cs.length) % cs.length;
    cs.forEach((el, j) => el.classList.toggle('focus', j === focusIdx));
    cs[focusIdx].scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    play('picker', 'hover');
  }
  function activate() {
    const cs = cards();
    cs[focusIdx]?.click();
  }

  // Grid-aware nav: use bounding rects to find the best neighbour in a direction.
  function go(dir) {
    const cs = cards();
    const current = cs[focusIdx];
    if (!current) { focus(0); return; }
    const r = current.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best = -1, bestScore = Infinity;
    cs.forEach((el, i) => {
      if (i === focusIdx) return;
      const rr = el.getBoundingClientRect();
      const ex = rr.left + rr.width / 2, ey = rr.top + rr.height / 2;
      const dx = ex - cx, dy = ey - cy;
      const inDir =
        (dir === 'right' && dx > 10) ||
        (dir === 'left'  && dx < -10) ||
        (dir === 'down'  && dy > 10) ||
        (dir === 'up'    && dy < -10);
      if (!inDir) return;
      const prim = (dir === 'left' || dir === 'right') ? Math.abs(dx) : Math.abs(dy);
      const perp = (dir === 'left' || dir === 'right') ? Math.abs(dy) : Math.abs(dx);
      const score = prim + perp * 3; // penalise off-axis
      if (score < bestScore) { bestScore = score; best = i; }
    });
    if (best >= 0) focus(best);
  }

  window.addEventListener('keydown', e => {
    const open = document.querySelector('.modal.open');
    if (open) {
      if (e.key === 'Escape') { open.classList.remove('open'); e.preventDefault(); }
      return;
    }
    switch (e.key) {
      case 'ArrowRight': go('right'); e.preventDefault(); break;
      case 'ArrowLeft':  go('left');  e.preventDefault(); break;
      case 'ArrowUp':    go('up');    e.preventDefault(); break;
      case 'ArrowDown':  go('down');  e.preventDefault(); break;
      case 'Enter':
      case ' ':          activate();  e.preventDefault(); break;
      case 'l': case 'L': document.getElementById('open-library').click(); e.preventDefault(); break;
      case 'd': case 'D': document.getElementById('hw-disk').click();      e.preventDefault(); break;
    }
  });

  // Gamepad polling
  let last = { ax0: 0, ay0: 0, a: 0, b: 0, lb: 0, rb: 0 };
  function poll() {
    const gps = navigator.getGamepads?.() || [];
    for (const g of gps) {
      if (!g) continue;
      const open = !!document.querySelector('.modal.open');
      const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
      const dpadRight = g.buttons[15]?.pressed || ax >  0.5;
      const dpadLeft  = g.buttons[14]?.pressed || ax < -0.5;
      const dpadDown  = g.buttons[13]?.pressed || ay >  0.5;
      const dpadUp    = g.buttons[12]?.pressed || ay < -0.5;
      const aBtn      = g.buttons[0]?.pressed;
      const bBtn      = g.buttons[1]?.pressed;
      const lbBtn     = g.buttons[4]?.pressed;
      const rbBtn     = g.buttons[5]?.pressed;

      // edge-trigger axis movement
      if (!open) {
        if (dpadRight && !(last.lastRight ?? false)) go('right');
        if (dpadLeft  && !(last.lastLeft ?? false))  go('left');
        if (dpadDown  && !(last.lastDown ?? false))  go('down');
        if (dpadUp    && !(last.lastUp ?? false))    go('up');
        if (aBtn      && !last.a)  activate();
        if (lbBtn     && !last.lb) document.getElementById('open-library').click();
        if (rbBtn     && !last.rb) document.getElementById('hw-disk').click();
      } else {
        if (bBtn && !last.b) {
          const openModal = document.querySelector('.modal.open');
          if (openModal) openModal.classList.remove('open');
        }
      }
      last = { ...last,
        lastRight: dpadRight, lastLeft: dpadLeft, lastDown: dpadDown, lastUp: dpadUp,
        a: aBtn, b: bBtn, lb: lbBtn, rb: rbBtn,
      };
      break; // one controller is enough
    }
    requestAnimationFrame(poll);
  }
  requestAnimationFrame(poll);

  // Start with first unlocked card focused
  const first = [...ring.querySelectorAll('.card:not(.locked)')][0];
  if (first) focus(cards().indexOf(first));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
