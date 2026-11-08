import { play, ctx as audioCtx } from '../../assets/js/sound.js';
import { listRoms, addRom, removeRom, formatBytes, classifyFile } from '../../assets/js/roms.js';
import { runRom, canEmulate } from '../../assets/js/emulator.js';
import { exportConsole } from '../../assets/js/export.js';
import { autoAttach } from '../../assets/js/features.js';
import { boxArt, boxTile } from '../../assets/js/art.js';
autoAttach('switch');

const AUDIO = { on: true };
document.addEventListener('pointerdown', function once() { try{audioCtx();}catch{} }, { once:true });

window.addEventListener('load', () => {
  setTimeout(() => play('switch', 'boot'), 100);
  setTimeout(() => document.getElementById('boot').classList.add('done'), 1600);
});

function clock() {
  const d = new Date();
  document.getElementById('clock').textContent = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
clock(); setInterval(clock, 30_000);

/* Build tiles for each Switch ROM + an Add tile that opens library */
async function buildTiles() {
  const row = document.getElementById('tiles');
  const roms = await listRoms('switch');

  const addTile = document.createElement('div');
  addTile.className = 'tile add';
  addTile.innerHTML = `<div class="art">＋</div>
    <div class="name">Add Game</div>
    <div class="sub">All titles</div>`;
  addTile.onclick = () => { play('switch','select'); openLibrary(); };

  row.innerHTML = '';
  if (roms.length === 0) {
    // Placeholder tiles so the row doesn't look empty
    for (let i = 0; i < 4; i++) {
      const t = document.createElement('div');
      t.className = 'tile';
      t.style.pointerEvents = 'none'; t.style.opacity = '0.5';
      t.innerHTML = `<div class="art"><svg viewBox="0 0 100 100"><rect width="100" height="100" fill="rgba(255,255,255,0.03)"/></svg></div>
        <div class="name">Placeholder</div><div class="sub">Add a ROM</div>`;
      row.appendChild(t);
    }
  } else {
    roms.forEach(r => {
      const t = document.createElement('div');
      t.className = 'tile';
      t.innerHTML = `<div class="art" style="background:transparent;padding:0;overflow:hidden">${boxArt(r, { w: 320, h: 320 })}</div>
        <div class="name">${r.name.length > 24 ? r.name.slice(0, 22)+'…' : r.name}</div>
        <div class="sub">${formatBytes(r.size)}</div>`;
      t.onmouseenter = () => AUDIO.on && play('switch','hover');
      t.onclick = () => { play('switch','select'); startEmulator(r.id); };
      row.appendChild(t);
    });
  }
  row.appendChild(addTile);
}
buildTiles();

/* Icon bar */
document.querySelectorAll('.ibtn').forEach(b => {
  b.onmouseenter = () => AUDIO.on && play('switch','hover');
});
document.getElementById('ib-settings').onclick = () => { play('switch','select'); openSettings(); };
document.getElementById('ib-games').onclick    = () => { play('switch','select'); openLibrary(); };
document.getElementById('ib-power').onclick    = () => {
  play('switch','select');
  setTimeout(() => location.href = '../../index.html', 300);
};

/* Modal close */
document.querySelectorAll('[data-close]').forEach(el => el.onclick = () =>
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('on')));

/* Library */
async function openLibrary() {
  document.getElementById('library-modal').classList.add('on');
  await refreshLibrary();
  document.getElementById('sw-add').onclick = () => document.getElementById('sw-input').click();
  document.getElementById('sw-input').onchange = async e => {
    for (const f of e.target.files) {
      try {
        const meta = classifyFile(f.name);
        if (!meta || meta.console !== 'switch') continue;
        await addRom(f);
      } catch {}
    }
    await refreshLibrary();
    await buildTiles();
  };
}
async function refreshLibrary() {
  const list = document.getElementById('sw-list');
  const roms = await listRoms('switch');
  if (!roms.length) {
    list.innerHTML = '<p style="color:rgba(255,255,255,0.5);font-size:13px;padding:14px 0">No Switch ROMs. Add .nsp / .xci above.<br>Note: Switch emulation is not yet available in-browser — ROMs are stored and listed, but Play opens a desktop-emulator message.</p>';
    return;
  }
  list.innerHTML = roms.map(r => `
    <div class="rom-row">
      <span><b>${r.name}</b><br><small style="color:rgba(255,255,255,0.5)">${formatBytes(r.size)}</small></span>
      <button class="play" data-play="${r.id}">Play</button>
      <button class="play" style="background:#444;color:#fff" data-del="${r.id}">✕</button>
    </div>
  `).join('');
  list.querySelectorAll('[data-play]').forEach(b => b.onclick = e => startEmulator(+e.target.dataset.play));
  list.querySelectorAll('[data-del]').forEach(b => b.onclick = async e => {
    await removeRom(+e.target.dataset.del); refreshLibrary(); buildTiles();
  });
}

function startEmulator(id) {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('on'));
  const mount = document.getElementById('emu-mount');
  mount.classList.add('on');
  document.getElementById('emu-close').style.display = '';
  runRom('switch', id, mount).catch(e => mount.innerHTML = `<div class="emu-unsupported">${e.message}</div>`);
}
document.getElementById('emu-close').onclick = () => {
  const m = document.getElementById('emu-mount');
  m.classList.remove('on'); m.innerHTML = '';
  document.getElementById('emu-close').style.display = 'none';
};

/* Settings + export */
function openSettings() {
  document.getElementById('settings-modal').classList.add('on');
  const n = document.getElementById('sw-user');
  n.value = localStorage.getItem('sw-user') || 'Player';
  n.oninput = () => localStorage.setItem('sw-user', n.value);
  const t = document.getElementById('sw-sound');
  t.classList.toggle('on', AUDIO.on);
  t.onclick = () => { AUDIO.on = !AUDIO.on; t.classList.toggle('on', AUDIO.on); };
  document.getElementById('sw-export').onclick = async () => {
    try {
      await exportConsole({
        title: 'Switch Home — Standalone',
        htmlUrl: 'index.html',
        cssUrls: ['sw.css'],
        jsModules: ['sw.js','../../assets/js/sound.js','../../assets/js/roms.js','../../assets/js/emulator.js','../../assets/js/export.js','../../assets/js/features.js','../../assets/js/art.js','../../assets/js/storage.js'],
      });
      play('switch','select');
    } catch(e) { alert('Export failed: '+e.message); }
  };
}
