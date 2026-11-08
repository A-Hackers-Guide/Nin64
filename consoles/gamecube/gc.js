import { play, ctx as audioCtx } from '../../assets/js/sound.js';
import { listRoms, addRom, removeRom, formatBytes, classifyFile } from '../../assets/js/roms.js';
import { runRom } from '../../assets/js/emulator.js';
import { exportConsole } from '../../assets/js/export.js';
import { autoAttach } from '../../assets/js/features.js';
import { boxArt } from '../../assets/js/art.js';
autoAttach('gamecube');

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
document.getElementById('lane-a').onclick    = () => { play('gamecube', 'select'); openMemcard('A'); };
document.getElementById('lane-b').onclick    = () => { play('gamecube', 'select'); openMemcard('B'); };
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

/* Memory card viewer */
async function openMemcard(slot) {
  // Reuse the games modal shell for the memcard view, but inject the memcard layout.
  const m = document.getElementById('games-modal');
  m.classList.add('on');
  const sheet = m.querySelector('.sheet');
  const { listSaves } = await import('../../assets/js/features.js');
  const saves = await listSaves('gamecube');
  const roms = await listRoms('gamecube');

  // 251 blocks per slot (approx real GC spec). Fill from saves + roms.
  const BLOCKS = 251;
  const used = [];
  let cursor = 0;
  for (const r of roms.slice(0, 20)) {
    const n = Math.max(1, Math.min(8, Math.round(r.size / (1024 * 1024 * 50))));
    used.push({ kind: 'rom', name: r.name, size: r.size, blocks: n, start: cursor, id: r.id });
    cursor += n;
  }
  for (const s of saves) {
    used.push({ kind: 'save', name: s.name, size: s.size, blocks: Math.max(1, Math.ceil(s.size / 8192)), start: cursor, id: s.id });
    cursor += Math.max(1, Math.ceil(s.size / 8192));
  }
  const usedBlocks = used.reduce((a, b) => a + b.blocks, 0);
  const free = Math.max(0, BLOCKS - usedBlocks);

  const blockCells = [];
  let b = 0;
  for (const entry of used) {
    for (let k = 0; k < entry.blocks && b < BLOCKS; k++, b++) {
      blockCells.push(`<div class="block ${entry.kind === 'save' ? 'save' : 'used'}" title="${entry.name}"></div>`);
    }
  }
  while (b < BLOCKS) { blockCells.push('<div class="block"></div>'); b++; }

  sheet.innerHTML = `
    <h2>Memory Card — Slot ${slot}</h2>
    <p class="lead">Each tile is one block (251 total, as per the real card spec). Purple = ROM data, green = save state.</p>
    <div class="memcard-sheet">
      <div class="memcard-img">
        <div>
          <div class="info">Nin64 Memory Card</div>
          <div style="font-size:16px;font-weight:700;color:#fff;margin:4px 0">Slot ${slot}</div>
          <div class="info">${usedBlocks} used · ${free} free</div>
        </div>
        <div class="sticker">${Math.round(usedBlocks / BLOCKS * 100)}%</div>
      </div>
      <div class="blocks">${blockCells.join('')}</div>
      <div>
        <h3 style="font-size:14px;margin:0 0 6px;letter-spacing:0.1em;text-transform:uppercase;color:var(--faint)">Files</h3>
        <div class="file-list">
          ${used.length === 0
            ? '<p style="color:var(--faint);font-size:12px;padding:10px 0">Empty card. Open the disc to add games.</p>'
            : used.map(u => `
              <div class="file-row">
                <div class="dot ${u.kind === 'save' ? 'save' : ''}"></div>
                <span><b>${u.name.length > 40 ? u.name.slice(0, 38) + '…' : u.name}</b></span>
                <span class="size">${u.blocks} blk</span>
                <button class="del" data-del="${u.kind}:${u.id}" title="Remove">✕</button>
              </div>`).join('')}
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:6px;justify-content:space-between">
        <button class="gbtn primary" id="mc-open-games">Add game</button>
        <button class="gbtn" data-close>Back</button>
      </div>
    </div>
  `;

  sheet.querySelectorAll('[data-close]').forEach(el => el.onclick = () =>
    document.querySelectorAll('.modal').forEach(x => x.classList.remove('on')));
  sheet.querySelector('#mc-open-games').onclick = () => { openGames(); };
  sheet.querySelectorAll('[data-del]').forEach(b => b.onclick = async e => {
    const [kind, idStr] = e.target.dataset.del.split(':');
    const id = +idStr;
    if (kind === 'rom') await removeRom(id);
    else if (kind === 'save') {
      const { removeSave } = await import('../../assets/js/features.js');
      await removeSave(id);
    }
    openMemcard(slot);
    refreshLanes();
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
        jsModules: ['gc.js', '../../assets/js/sound.js', '../../assets/js/roms.js', '../../assets/js/emulator.js', '../../assets/js/export.js', '../../assets/js/features.js', '../../assets/js/storage.js', '../../assets/js/art.js'],
      });
      play('gamecube','select');
    } catch (e) { alert('Export failed: ' + e.message); }
  };
}
