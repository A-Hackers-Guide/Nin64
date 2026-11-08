import { play, ctx as audioCtx } from '../../assets/js/sound.js';
import { listRoms, addRom, removeRom, formatBytes, classifyFile } from '../../assets/js/roms.js';
import { runRom, canEmulate } from '../../assets/js/emulator.js';
import { exportConsole } from '../../assets/js/export.js';
import { autoAttach } from '../../assets/js/features.js';
import { boxTile } from '../../assets/js/art.js';
import { miiSvg, listMiis, saveMii, removeMii, DEFAULT as MII_DEFAULT, SKINS, HAIRS } from './mii.js';
autoAttach('wii');

/* Pointer */
const pointer = document.getElementById('pointer');
window.addEventListener('mousemove', e => {
  pointer.style.left = e.clientX + 'px';
  pointer.style.top  = e.clientY + 'px';
});

/* Clock */
function tickClock() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  document.getElementById('clock-h').textContent = `${hh}:${mm}`;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  document.getElementById('clock-d').textContent = `${days[d.getDay()]} · ${months[d.getMonth()]} ${d.getDate()}`;
}
tickClock(); setInterval(tickClock, 1000 * 30);

/* Audio unlock */
let audioEnabled = true;
document.addEventListener('pointerdown', function once() {
  try { audioCtx(); } catch {}
  document.removeEventListener('pointerdown', once);
}, { once: true });

/* Mii parade — populate from saved Miis, fall back to defaults */
function paintMiiParade() {
  const parade = document.getElementById('mii-parade');
  if (!parade) return;
  let miis = listMiis();
  if (miis.length === 0) {
    miis = [
      { skin: '#f5d4b3', hair: 'short', hairC: '#3a2a1a', eye: 'dot',  mouth: 'smile' },
      { skin: '#e8b28f', hair: 'long',  hairC: '#d94747', eye: 'oval', mouth: 'grin' },
      { skin: '#8d5a2e', hair: 'short', hairC: '#2a1a0a', eye: 'dot',  mouth: 'smile' },
      { skin: '#f8e3c7', hair: 'spike', hairC: '#c9a267', eye: 'line', mouth: 'grin' },
    ];
  }
  parade.innerHTML = miis.slice(0, 6).map((m, i) =>
    `<div class="mii" style="padding:0;background:#fff;animation-delay:${i * 0.2}s">${miiSvg(m, { size: 40 })}</div>`
  ).join('');
}
paintMiiParade();

/* Clouds */
(function makeClouds() {
  const root = document.getElementById('clouds');
  for (let i = 0; i < 8; i++) {
    const c = document.createElement('div');
    c.className = 'cloud';
    const h = 20 + Math.random() * 30;
    c.style.width = `${80 + Math.random() * 200}px`;
    c.style.height = `${h}px`;
    c.style.top = `${10 + Math.random() * 70}%`;
    c.style.animationDuration = `${60 + Math.random() * 90}s`;
    c.style.animationDelay = `${-Math.random() * 60}s`;
    root.appendChild(c);
  }
})();

/* Channel wiring */
document.querySelectorAll('.chan').forEach(el => {
  el.addEventListener('mouseenter', () => { if (audioEnabled) play('wii', 'hover'); pointer.classList.add('over'); });
  el.addEventListener('mouseleave', () => pointer.classList.remove('over'));
  el.addEventListener('click', () => { if (audioEnabled) play('wii', 'select'); openChannel(el.dataset.channel); });
});

/* Overlay helpers */
function openOverlay(id) {
  document.getElementById(id).classList.add('on');
}
function closeOverlays() {
  document.querySelectorAll('.overlay').forEach(o => o.classList.remove('on'));
  if (audioEnabled) play('wii', 'back');
}
document.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeOverlays));

async function openChannel(name) {
  switch (name) {
    case 'settings': openSettings(); break;
    case 'mii':      openMiiStudio(); break;
    case 'games':    openGames();     break;
    case 'disc':
    case 'photo':
    case 'internet':
    case 'shop':
    case 'news':
    case 'weather':
    case 'votes':
    case 'checkmii':
    case 'credits':
      openOverlay(`ch-${name}`);
      break;
    default:
      openOverlay('ch-generic');
  }
}

/* ---------- Mii Studio ---------- */

let currentMii = { ...MII_DEFAULT };

function openMiiStudio() {
  openOverlay('ch-mii');
  const sheet = document.querySelector('#ch-mii .sheet');
  sheet.innerHTML = `
    <h2>Mii Channel</h2>
    <p class="lead">Build a Mii, and they'll walk the top ribbon forever.</p>
    <div class="mii-studio">
      <div class="mii-canvas" id="mii-preview"></div>
      <div class="mii-controls">
        <div class="mii-row"><label>Face</label><div class="options" data-key="face">
          ${['round','oval','square'].map(v => `<button class="opt" data-v="${v}">${v}</button>`).join('')}
        </div></div>
        <div class="mii-row"><label>Skin</label><div class="swatches" data-key="skin">
          ${SKINS.map(c => `<button class="swatch" data-v="${c}" style="background:${c}"></button>`).join('')}
        </div></div>
        <div class="mii-row"><label>Hair</label><div class="options" data-key="hair">
          ${['short','long','spike','bald'].map(v => `<button class="opt" data-v="${v}">${v}</button>`).join('')}
        </div></div>
        <div class="mii-row"><label>Hair color</label><div class="swatches" data-key="hairC">
          ${HAIRS.map(c => `<button class="swatch" data-v="${c}" style="background:${c}"></button>`).join('')}
        </div></div>
        <div class="mii-row"><label>Eyes</label><div class="options" data-key="eye">
          ${['dot','oval','line'].map(v => `<button class="opt" data-v="${v}">${v}</button>`).join('')}
        </div></div>
        <div class="mii-row"><label>Mouth</label><div class="options" data-key="mouth">
          ${['smile','grin','line','frown'].map(v => `<button class="opt" data-v="${v}">${v}</button>`).join('')}
        </div></div>
        <div class="mii-row"><label>Name</label>
          <input type="text" id="mii-name" value="${currentMii.name}" maxlength="10"
                 style="padding:6px 10px;border-radius:999px;border:1px solid var(--chip-stroke);font-family:inherit;font-size:13px"></div>
      </div>
    </div>
    <div class="mii-saved">
      <h3>Saved Miis</h3>
      <div class="mii-row-saved" id="mii-saved"></div>
    </div>
    <div style="display:flex;gap:10px;margin-top:16px;justify-content:space-between">
      <div style="display:flex;gap:10px">
        <button class="wbtn primary" id="mii-save">Save Mii</button>
        <button class="wbtn" id="mii-reset">Randomize</button>
      </div>
      <button class="wbtn" data-close>Back</button>
    </div>
  `;

  // Wire controls
  sheet.querySelectorAll('[data-key]').forEach(group => {
    const key = group.dataset.key;
    group.querySelectorAll('[data-v]').forEach(btn => {
      btn.onclick = () => {
        currentMii[key] = btn.dataset.v;
        markOn(group, btn);
        if (audioEnabled) play('wii', 'select');
        redrawMii();
      };
    });
    markOn(group, group.querySelector(`[data-v="${currentMii[key]}"]`));
  });

  sheet.querySelector('#mii-name').oninput = e => { currentMii.name = e.target.value; };

  sheet.querySelector('#mii-save').onclick = () => {
    saveMii(currentMii);
    play('wii', 'select');
    paintMiiParade();
    refreshSavedMiis();
  };
  sheet.querySelector('#mii-reset').onclick = () => {
    currentMii.face  = pick(['round','oval','square']);
    currentMii.skin  = pick(SKINS);
    currentMii.hair  = pick(['short','long','spike','bald']);
    currentMii.hairC = pick(HAIRS);
    currentMii.eye   = pick(['dot','oval','line']);
    currentMii.mouth = pick(['smile','grin','line','frown']);
    play('wii', 'hover');
    openMiiStudio(); // re-render UI with new selections
  };
  sheet.querySelectorAll('[data-close]').forEach(el => el.onclick = closeOverlays);

  redrawMii();
  refreshSavedMiis();
}

function markOn(group, btn) {
  if (!btn) return;
  group.querySelectorAll('[data-v]').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
}
function redrawMii() {
  const p = document.getElementById('mii-preview');
  if (p) p.innerHTML = miiSvg(currentMii, { size: 180 });
}
function refreshSavedMiis() {
  const el = document.getElementById('mii-saved');
  if (!el) return;
  const miis = listMiis();
  if (!miis.length) { el.innerHTML = '<span style="color:#6a7a94;font-size:12px">No Miis yet. Make one above.</span>'; return; }
  el.innerHTML = miis.map(m => `
    <div class="mii-mini" title="${m.name || 'Mii'}" data-id="${m.id}">
      ${miiSvg(m, { size: 36 })}
      <button class="x" data-del="${m.id}">✕</button>
    </div>`).join('');
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = e => {
    e.stopPropagation();
    removeMii(+e.target.dataset.del);
    play('wii', 'back');
    refreshSavedMiis();
    paintMiiParade();
  });
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* Settings — includes "Export this console as HTML" */
function openSettings() {
  openOverlay('ch-settings');
  const nameInput = document.getElementById('user-name');
  nameInput.value = localStorage.getItem('wii-user') || 'Player 1';
  nameInput.addEventListener('input', () => localStorage.setItem('wii-user', nameInput.value));

  const soundToggle = document.getElementById('sound-toggle');
  soundToggle.classList.toggle('on', audioEnabled);
  soundToggle.onclick = () => {
    audioEnabled = !audioEnabled;
    soundToggle.classList.toggle('on', audioEnabled);
    if (audioEnabled) play('wii', 'select');
  };

  document.getElementById('export-btn').onclick = async () => {
    try {
      await exportConsole({
        title: 'Wii Menu — Standalone',
        htmlUrl: 'index.html',
        cssUrls: ['wii.css'],
        jsUrls: [],
        jsModules: [
          'wii.js',
          'mii.js',
          '../../assets/js/sound.js',
          '../../assets/js/roms.js',
          '../../assets/js/emulator.js',
          '../../assets/js/export.js',
          '../../assets/js/features.js',
          '../../assets/js/storage.js',
          '../../assets/js/art.js',
        ],
      });
      play('wii', 'select');
    } catch (e) {
      alert('Export failed: ' + e.message);
    }
  };
}

/* Games — Wii + GameCube ROMs */
async function openGames() {
  openOverlay('ch-games');
  await refreshGames();
  document.getElementById('games-drop').onclick = () => document.getElementById('games-input').click();
  document.getElementById('games-input').onchange = async e => {
    for (const f of e.target.files) {
      try {
        const meta = classifyFile(f.name);
        if (!meta) { continue; }
        if (meta.console !== 'wii' && meta.console !== 'gamecube') continue;
        await addRom(f);
      } catch {}
    }
    await refreshGames();
  };
}
async function refreshGames() {
  const list = document.getElementById('games-list');
  const wii = await listRoms('wii');
  const gc  = await listRoms('gamecube');
  const all = [...wii, ...gc];
  if (!all.length) {
    list.innerHTML = `<div style="color:#6a7a94;text-align:center;padding:20px;font-size:13px">No Wii / GameCube ROMs yet.<br>Drop files above or in the main library on the boot picker.</div>`;
    return;
  }
  list.innerHTML = all.map(r => `
    <div class="rom-row">
      <span><b>${r.name}</b><br><small style="color:#6a7a94">${r.console.toUpperCase()} · ${formatBytes(r.size)}</small></span>
      <button class="play" data-play="${r.id}" data-console="${r.console}">Play</button>
      <button class="play" style="background:#f3f4f6;color:#dc2626" data-del="${r.id}">✕</button>
    </div>
  `).join('');
  list.querySelectorAll('[data-play]').forEach(b => b.onclick = e => {
    const id = +e.target.dataset.play;
    const cns = e.target.dataset.console;
    startEmulator(cns, id);
  });
  list.querySelectorAll('[data-del]').forEach(b => b.onclick = async e => {
    await removeRom(+e.target.dataset.del); refreshGames();
  });
}

/* Emulator */
function startEmulator(consoleKey, romId) {
  closeOverlays();
  const mount = document.getElementById('emu-mount');
  mount.classList.add('on');
  document.body.style.cursor = 'auto';
  pointer.style.display = 'none';
  runRom(consoleKey, romId, mount, {
    onReady: () => {}
  }).catch(e => mount.innerHTML = `<div class="emu-unsupported">Emulator error: ${e.message}</div>`);
}
document.getElementById('emu-close').onclick = () => {
  document.getElementById('emu-mount').classList.remove('on');
  document.getElementById('emu-mount').innerHTML = '';
  document.body.style.cursor = 'none';
  pointer.style.display = '';
  play('wii', 'back');
};

/* Home button goes back to boot picker */
document.getElementById('home-btn').addEventListener('click', () => {
  play('wii', 'back');
  const curtain = document.getElementById('curtain');
  curtain.classList.add('on');
  setTimeout(() => location.href = '../../index.html', 700);
});

/* Boot chime once */
window.addEventListener('load', () => {
  // Need a user gesture before audio plays — guarded by audioCtx() in play()
  setTimeout(() => play('wii', 'boot'), 300);
});
