import { benchmark, unlocked, tierFor, TIERS } from './hardware.js';
import { play, ctx as audioCtx } from './sound.js';
import { addRom, listRoms, removeRom, formatBytes, classifyFile } from './roms.js';

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
  { key: 'snes',     name: 'SNES',       sub: '1990',                  tier: 1 },
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
