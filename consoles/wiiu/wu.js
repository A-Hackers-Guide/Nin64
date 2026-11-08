import { play, ctx as audioCtx } from '../../assets/js/sound.js';
import { listRoms, addRom, removeRom, formatBytes, classifyFile } from '../../assets/js/roms.js';
import { runRom } from '../../assets/js/emulator.js';
import { exportConsole } from '../../assets/js/export.js';

const AUDIO = { on: true };
document.addEventListener('pointerdown', function once() { try{audioCtx();}catch{} }, { once: true });
window.addEventListener('load', () => {
  setTimeout(() => play('wiiu','boot'), 300);
  setTimeout(() => document.getElementById('boot').classList.add('done'), 1600);
});

function clock() {
  const d = new Date();
  document.getElementById('clock').textContent = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
clock(); setInterval(clock, 30_000);

async function buildGrid() {
  const g = document.getElementById('grid');
  const roms = await listRoms('wiiu');

  g.innerHTML = '';
  // Fixed apps
  const fixed = [
    { kind: 'app', name: 'MiiVerse',     sub: 'Local',     icon: miiverseIcon() },
    { kind: 'app', name: 'eShop',        sub: 'Offline',   icon: shopIcon() },
    { kind: 'app', name: 'Settings',     sub: 'System',    icon: cogIcon(),     action: openSettings },
    { kind: 'app', name: 'Browser',      sub: 'Internet',  icon: webIcon(),     action: () => window.open('https://duckduckgo.com','_blank') },
    { kind: 'app', name: 'Mii Maker',    sub: 'Create',    icon: faceIcon() },
    { kind: 'app', name: 'Download Mgr', sub: 'Local',     icon: dlIcon() },
  ];
  for (const f of fixed) g.appendChild(mkTile(f));

  for (const r of roms) {
    g.appendChild(mkTile({
      kind: 'rom', name: r.name.length > 20 ? r.name.slice(0,18)+'…' : r.name,
      sub: formatBytes(r.size), icon: gameIcon(),
      action: () => startEmulator(r.id),
    }));
  }
  const add = mkTile({ kind: 'add', name: 'Add Game', sub: 'Local ROM', icon: '＋', action: openLibrary });
  add.classList.add('add');
  g.appendChild(add);
}
function mkTile(d) {
  const t = document.createElement('div');
  t.className = 'tile' + (d.kind === 'add' ? ' add' : '');
  t.innerHTML = `<div class="art">${d.icon}</div><div class="name">${d.name}</div><div class="sub">${d.sub}</div>`;
  t.onmouseenter = () => AUDIO.on && play('wiiu','hover');
  t.onclick = () => { play('wiiu','select'); if (d.action) d.action(); else openGeneric(d.name); };
  return t;
}

// SVG icons
function miiverseIcon() { return '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="#fff" fill-opacity="0.9"/><path d="M30 60 Q50 72 70 60 L62 76 L50 72 L38 76 Z" fill="#fff"/></svg>'; }
function shopIcon()     { return '<svg viewBox="0 0 100 100"><rect x="20" y="36" width="60" height="42" fill="#fff" fill-opacity="0.9"/><path d="M34 36 V24 a16 16 0 0 1 32 0 V36" fill="none" stroke="#fff" stroke-width="3"/></svg>'; }
function cogIcon()      { return '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="18" fill="none" stroke="#fff" stroke-width="4"/><circle cx="50" cy="50" r="6" fill="#fff"/></svg>'; }
function webIcon()      { return '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="26" fill="none" stroke="#fff" stroke-width="3"/><ellipse cx="50" cy="50" rx="26" ry="10" fill="none" stroke="#fff" stroke-width="2"/><path d="M50 24 Q36 50 50 76" fill="none" stroke="#fff" stroke-width="2"/></svg>'; }
function faceIcon()     { return '<svg viewBox="0 0 100 100"><circle cx="50" cy="44" r="22" fill="#fff"/><circle cx="42" cy="42" r="2.5" fill="#0f172a"/><circle cx="58" cy="42" r="2.5" fill="#0f172a"/><path d="M42 52 Q50 58 58 52" fill="none" stroke="#0f172a" stroke-width="2"/></svg>'; }
function dlIcon()       { return '<svg viewBox="0 0 100 100"><path d="M50 20 V62 M30 50 L50 70 L70 50" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M26 78 H74" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>'; }
function gameIcon()     { return '<svg viewBox="0 0 100 100"><rect x="22" y="36" width="56" height="34" rx="6" fill="#fff" fill-opacity="0.9"/><circle cx="36" cy="53" r="4" fill="#0f172a"/><circle cx="64" cy="53" r="4" fill="#0f172a"/></svg>'; }

buildGrid();

// Space switcher
document.querySelectorAll('.space').forEach(s => s.onclick = () => {
  document.querySelectorAll('.space').forEach(x => x.classList.remove('on'));
  s.classList.add('on');
  play('wiiu','select');
});

document.getElementById('back-btn').onclick = () => {
  play('wiiu','select');
  setTimeout(() => location.href = '../../index.html', 300);
};

document.querySelectorAll('[data-close]').forEach(el => el.onclick = () =>
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('on')));

async function openLibrary() {
  document.getElementById('library-modal').classList.add('on');
  await refreshLibrary();
  document.getElementById('wu-add').onclick = () => document.getElementById('wu-input').click();
  document.getElementById('wu-input').onchange = async e => {
    for (const f of e.target.files) {
      try { const m = classifyFile(f.name); if (!m || m.console !== 'wiiu') continue; await addRom(f); } catch {}
    }
    refreshLibrary(); buildGrid();
  };
}
async function refreshLibrary() {
  const list = document.getElementById('wu-list');
  const roms = await listRoms('wiiu');
  if (!roms.length) {
    list.innerHTML = '<p style="color:#64748b;font-size:13px">No Wii U ROMs. Add .wud / .wux above.<br>In-browser emulation isn\'t available; files are stored locally for future use.</p>';
    return;
  }
  list.innerHTML = roms.map(r => `
    <div class="rom-row">
      <span><b>${r.name}</b><br><small style="color:#64748b">${formatBytes(r.size)}</small></span>
      <button class="play" data-play="${r.id}">Play</button>
      <button class="play" style="background:#ef4444" data-del="${r.id}">✕</button>
    </div>
  `).join('');
  list.querySelectorAll('[data-play]').forEach(b => b.onclick = e => startEmulator(+e.target.dataset.play));
  list.querySelectorAll('[data-del]').forEach(b => b.onclick = async e => {
    await removeRom(+e.target.dataset.del); refreshLibrary(); buildGrid();
  });
}
function startEmulator(id) {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('on'));
  const mount = document.getElementById('emu-mount');
  mount.classList.add('on');
  document.getElementById('emu-close').style.display = '';
  runRom('wiiu', id, mount).catch(e => mount.innerHTML = `<div class="emu-unsupported">${e.message}</div>`);
}
document.getElementById('emu-close').onclick = () => {
  const m = document.getElementById('emu-mount'); m.classList.remove('on'); m.innerHTML = '';
  document.getElementById('emu-close').style.display = 'none';
};

function openGeneric(name) {
  const m = document.getElementById('generic-modal');
  m.classList.add('on');
  document.getElementById('generic-title').textContent = name;
}
function openSettings() {
  document.getElementById('settings-modal').classList.add('on');
  const n = document.getElementById('wu-user');
  n.value = localStorage.getItem('wu-user') || 'Player';
  n.oninput = () => localStorage.setItem('wu-user', n.value);
  const t = document.getElementById('wu-sound');
  t.classList.toggle('on', AUDIO.on);
  t.onclick = () => { AUDIO.on = !AUDIO.on; t.classList.toggle('on', AUDIO.on); };
  document.getElementById('wu-export').onclick = async () => {
    try {
      await exportConsole({
        title: 'Wii U Menu — Standalone',
        htmlUrl: 'index.html',
        cssUrls: ['wu.css'],
        jsModules: ['wu.js','../../assets/js/sound.js','../../assets/js/roms.js','../../assets/js/emulator.js','../../assets/js/export.js'],
      });
    } catch(e){ alert('Export failed: '+e.message);}
  };
}
