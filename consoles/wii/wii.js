import { play, ctx as audioCtx } from '../../assets/js/sound.js';
import { listRoms, addRom, removeRom, formatBytes, classifyFile } from '../../assets/js/roms.js';
import { runRom, canEmulate } from '../../assets/js/emulator.js';
import { exportConsole } from '../../assets/js/export.js';
import { autoAttach } from '../../assets/js/features.js';
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
    case 'disc':
    case 'mii':
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
    case 'games': openGames(); break;
    default:
      openOverlay('ch-generic');
  }
}

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
          '../../assets/js/sound.js',
          '../../assets/js/roms.js',
          '../../assets/js/emulator.js',
          '../../assets/js/export.js',
          '../../assets/js/features.js',
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
