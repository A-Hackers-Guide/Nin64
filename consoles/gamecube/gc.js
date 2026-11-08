import { play, ctx as audioCtx } from '../../assets/js/sound.js';
import { listRoms, addRom, removeRom, formatBytes, classifyFile } from '../../assets/js/roms.js';
import { runRom } from '../../assets/js/emulator.js';
import { exportConsole } from '../../assets/js/export.js';

const AUDIO = { on: true };
document.addEventListener('pointerdown', function once() {
  try { audioCtx(); } catch {}
  document.removeEventListener('pointerdown', once);
}, { once: true });

/* Boot sequence */
window.addEventListener('load', () => {
  setTimeout(() => play('gamecube', 'boot'), 250);
  setTimeout(() => {
    document.getElementById('boot-stage').classList.add('done');
    document.getElementById('menu').classList.add('on');
  }, 3200);
});

/* Clock */
function clock() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  document.getElementById('clock').textContent = `${hh}:${mm}`;
}
clock(); setInterval(clock, 30_000);

/* Lane counts */
async function refreshLanes() {
  const gc = await listRoms('gamecube');
  document.getElementById('slot-a-count').textContent = gc.length;
  document.getElementById('slot-b-count').textContent = '0';
}
refreshLanes();

/* Hover sounds */
document.querySelectorAll('.lane, .gbtn').forEach(el => {
  el.addEventListener('mouseenter', () => AUDIO.on && play('gamecube', 'hover'));
});

/* Buttons */
document.getElementById('lane-a').onclick    = () => { play('gamecube', 'select'); openGames(); };
document.getElementById('lane-b').onclick    = () => { play('gamecube', 'select'); openGames(); };
document.getElementById('disc-area').onclick = () => { play('gamecube', 'select'); openGames(); };

document.getElementById('open-games').onclick = () => { play('gamecube', 'select'); openGames(); };
document.getElementById('open-settings').onclick = () => { play('gamecube', 'select'); openSettings(); };

document.getElementById('home-btn').onclick = () => {
  play('gamecube', 'select');
  document.getElementById('menu').style.transition = 'opacity 0.6s ease';
  document.getElementById('menu').classList.remove('on');
  setTimeout(() => location.href = '../../index.html', 600);
};

/* Modal close */
document.querySelectorAll('[data-close]').forEach(el => el.onclick = () => {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('on'));
});

/* Games */
async function openGames() {
  document.getElementById('games-modal').classList.add('on');
  await refreshGames();
  document.getElementById('games-add').onclick = () => document.getElementById('games-input').click();
  document.getElementById('games-input').onchange = async e => {
    for (const f of e.target.files) {
      try {
        const meta = classifyFile(f.name);
        if (!meta || meta.console !== 'gamecube') continue;
        await addRom(f);
      } catch {}
    }
    await refreshGames();
    await refreshLanes();
  };
}

async function refreshGames() {
  const list = document.getElementById('games-list');
  const roms = await listRoms('gamecube');
  if (!roms.length) {
    list.innerHTML = '<div style="color:rgba(255,255,255,0.5);text-align:center;padding:20px;font-size:13px">No GameCube ROMs. Add .iso / .gcm / .gcz above.</div>';
    return;
  }
  list.innerHTML = roms.map(r => `
    <div class="rom-row">
      <span><b>${r.name}</b><br><small style="color:rgba(255,255,255,0.5)">${formatBytes(r.size)}</small></span>
      <button class="play" data-play="${r.id}">Play</button>
      <button class="play" style="background:rgba(220,38,38,0.7)" data-del="${r.id}">✕</button>
    </div>
  `).join('');
  list.querySelectorAll('[data-play]').forEach(b => b.onclick = e => startEmulator(+e.target.dataset.play));
  list.querySelectorAll('[data-del]').forEach(b => b.onclick = async e => {
    await removeRom(+e.target.dataset.del);
    refreshGames(); refreshLanes();
  });
}

/* Emulator */
function startEmulator(id) {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('on'));
  const mount = document.getElementById('emu-mount');
  mount.classList.add('on');
  document.getElementById('emu-close').style.display = '';
  runRom('gamecube', id, mount).catch(e => {
    mount.innerHTML = `<div class="emu-unsupported">Emulator error: ${e.message}</div>`;
  });
}
document.getElementById('emu-close').onclick = () => {
  const mount = document.getElementById('emu-mount');
  mount.classList.remove('on'); mount.innerHTML = '';
  document.getElementById('emu-close').style.display = 'none';
  play('gamecube', 'select');
};

/* Settings + export */
function openSettings() {
  document.getElementById('settings-modal').classList.add('on');
  const name = document.getElementById('gc-user');
  name.value = localStorage.getItem('gc-user') || 'Player';
  name.oninput = () => localStorage.setItem('gc-user', name.value);
  const snd = document.getElementById('gc-sound');
  snd.classList.toggle('on', AUDIO.on);
  snd.onclick = () => { AUDIO.on = !AUDIO.on; snd.classList.toggle('on', AUDIO.on); if (AUDIO.on) play('gamecube','select'); };
  document.getElementById('gc-export').onclick = async () => {
    try {
      await exportConsole({
        title: 'GameCube Menu — Standalone',
        htmlUrl: 'index.html',
        cssUrls: ['gc.css'],
        jsModules: ['gc.js', '../../assets/js/sound.js', '../../assets/js/roms.js', '../../assets/js/emulator.js', '../../assets/js/export.js'],
      });
      play('gamecube','select');
    } catch (e) { alert('Export failed: ' + e.message); }
  };
}
