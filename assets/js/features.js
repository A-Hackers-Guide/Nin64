/* features.js — the "things to do beyond booting a game" layer.
 *
 *   - Achievements       (track unlocked trophies per console, persist in IDB)
 *   - Screenshot wall    (save PNGs taken during emulation)
 *   - Save-state export  (download/import a save state file)
 *   - Playtime tracker   (session totals per console)
 *
 * All storage is local IndexedDB. Nothing uploads.
 */

const DB_NAME = 'nin64-features';
const DB_VER  = 1;
const STORES = ['achievements', 'screenshots', 'saves', 'playtime'];

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const s = db.createObjectStore(name, { keyPath: 'id', autoIncrement: true });
          s.createIndex('byConsole', 'console');
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(store, mode, work) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const out = work(s);
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
  });
}

async function all(store, consoleKey) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readonly');
    const s = t.objectStore(store);
    const req = consoleKey ? s.index('byConsole').getAll(consoleKey) : s.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ========== Achievements ========== */

const CATALOG = {
  wii: [
    { id: 'wii-boot',        name: 'Boot the Wii',               desc: 'Open the Wii Menu at least once.' },
    { id: 'wii-mii',         name: 'Meet the Miis',              desc: 'Open the Mii Channel.' },
    { id: 'wii-first-rom',   name: 'Disc Inserted',              desc: 'Add your first Wii or GameCube ROM.' },
    { id: 'wii-play',        name: 'Pointer, Meet Screen',       desc: 'Launch any Wii/GameCube ROM.' },
    { id: 'wii-screenshot',  name: 'Say Cheese',                 desc: 'Take an in-game screenshot.' },
    { id: 'wii-ten',         name: 'Full Shelf',                 desc: 'Store 10 Wii/GC ROMs locally.' },
  ],
  gamecube: [
    { id: 'gc-boot',         name: 'Cube Rolled',                desc: 'Finish the GameCube boot cube.' },
    { id: 'gc-first-rom',    name: 'Slot A Loaded',              desc: 'Add your first GameCube ROM.' },
    { id: 'gc-play',         name: 'Hold A to Play',             desc: 'Launch a GameCube game.' },
    { id: 'gc-save',         name: 'Memory Card Written',        desc: 'Export a save state.' },
  ],
  switch: [
    { id: 'sw-boot',         name: 'Click',                      desc: 'Boot the Switch home.' },
    { id: 'sw-ten',          name: 'Tile Row Full',              desc: 'Have 10 Switch ROMs in the library.' },
    { id: 'sw-screenshot',   name: 'Album Entry',                desc: 'Capture a screenshot.' },
  ],
  wiiu: [
    { id: 'wu-boot',         name: 'GamePad On',                 desc: 'Open the Wii U menu.' },
    { id: 'wu-first-rom',    name: 'Disc Loaded',                desc: 'Add your first Wii U ROM.' },
  ],
  n64: [
    { id: 'n64-boot',        name: 'Cartridge Seated',           desc: 'Boot into the N64 menu.' },
    { id: 'n64-first-rom',   name: 'Blow on the Pins',           desc: 'Add an N64 ROM.' },
    { id: 'n64-play',        name: 'Trident Grip',               desc: 'Launch an N64 game.' },
  ],
  nes: [
    { id: 'nes-start',       name: 'Press Start',                desc: 'Advance past the NES boot screen.' },
    { id: 'nes-first-rom',   name: 'Grey Box',                   desc: 'Add an NES ROM.' },
    { id: 'nes-play',        name: '8-bit Dreams',               desc: 'Launch an NES game.' },
  ],
  snes: [
    { id: 'snes-start',      name: 'Mode 7',                     desc: 'Advance past the SNES boot screen.' },
    { id: 'snes-first-rom',  name: 'Cartridge Click',            desc: 'Add an SNES ROM.' },
    { id: 'snes-play',       name: 'Rainbow Buttons',            desc: 'Launch an SNES game.' },
  ],
  gb: [
    { id: 'gb-boot',         name: 'Battery Check',              desc: 'Power on the Game Boy.' },
    { id: 'gb-first-rom',    name: 'Grey Cart',                  desc: 'Add a .gb or .gbc ROM.' },
    { id: 'gb-play',         name: 'Dot Matrix',                 desc: 'Launch a Game Boy game.' },
  ],
  gba: [
    { id: 'gba-boot',        name: 'Horizontal Hold',            desc: 'Power on the GBA.' },
    { id: 'gba-first-rom',   name: 'Indigo Insert',              desc: 'Add a .gba ROM.' },
    { id: 'gba-play',        name: '32 Bits of Sun',             desc: 'Launch a GBA game.' },
  ],
  genesis: [
    { id: 'gen-boot',        name: 'Does What Nintendon\'t',      desc: 'Boot the Genesis menu.' },
    { id: 'gen-first-rom',   name: 'Blast Processing',           desc: 'Add a .gen / .md / .smd ROM.' },
    { id: 'gen-play',        name: 'Welcome to the Next Level',  desc: 'Launch a Genesis game.' },
  ],
  ps1: [
    { id: 'ps1-boot',        name: 'Memory Card In',             desc: 'Boot into the PS1 menu.' },
    { id: 'ps1-first-rom',   name: 'CD Rolling',                 desc: 'Add a .cue / .pbp / .chd ROM.' },
    { id: 'ps1-play',        name: 'Shapes on the Button',       desc: 'Launch a PS1 game.' },
  ],
};

export function catalog(consoleKey) { return CATALOG[consoleKey] || []; }

export async function listAchievements(consoleKey) {
  const unlocked = await all('achievements', consoleKey);
  const by = Object.fromEntries(unlocked.map(u => [u.key, u]));
  return catalog(consoleKey).map(def => ({
    ...def,
    unlocked: !!by[def.id],
    when: by[def.id]?.when || null,
  }));
}

export async function unlock(consoleKey, key) {
  // de-dup: only insert if not present
  const existing = await all('achievements', consoleKey);
  if (existing.some(e => e.key === key)) return false;
  const def = catalog(consoleKey).find(a => a.id === key);
  if (!def) return false;
  await tx('achievements', 'readwrite', s => s.add({
    console: consoleKey, key, name: def.name, desc: def.desc, when: Date.now(),
  }));
  showToast(`🏆 ${def.name}`, def.desc);
  return true;
}

/* ========== Screenshots ========== */

export async function saveScreenshot(consoleKey, dataUrl, caption = '') {
  const blob = await (await fetch(dataUrl)).blob();
  await tx('screenshots', 'readwrite', s => s.add({
    console: consoleKey, blob, caption, when: Date.now(),
  }));
  showToast('📷 Screenshot saved', '');
}

export async function listScreenshots(consoleKey) {
  const rows = await all('screenshots', consoleKey);
  return rows.sort((a, b) => b.when - a.when).map(r => ({
    id: r.id,
    url: URL.createObjectURL(r.blob),
    caption: r.caption,
    when: r.when,
  }));
}

export async function removeScreenshot(id) {
  await tx('screenshots', 'readwrite', s => s.delete(id));
}

/* Capture from an emulator canvas (EmulatorJS puts a <canvas> inside). */
export function captureFromMount(mountEl) {
  const canvas = mountEl.querySelector('canvas');
  if (!canvas) return null;
  try { return canvas.toDataURL('image/png'); }
  catch { return null; }
}

/* ========== Save states ========== */

export async function saveState(consoleKey, name, blob) {
  await tx('saves', 'readwrite', s => s.add({
    console: consoleKey, name, blob, when: Date.now(),
  }));
  showToast('💾 Save stored', name);
}

export async function listSaves(consoleKey) {
  const rows = await all('saves', consoleKey);
  return rows.sort((a, b) => b.when - a.when).map(r => ({
    id: r.id, name: r.name, when: r.when, size: r.blob.size,
    download: () => downloadBlob(r.blob, r.name + '.sav'),
  }));
}

export async function removeSave(id) {
  await tx('saves', 'readwrite', s => s.delete(id));
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  requestAnimationFrame(() => { a.remove(); URL.revokeObjectURL(a.href); });
}

/* ========== Playtime ========== */

const _sessions = {};  // consoleKey -> startMs

export function startPlay(consoleKey) {
  _sessions[consoleKey] = performance.now();
}

export async function endPlay(consoleKey) {
  if (!_sessions[consoleKey]) return;
  const ms = performance.now() - _sessions[consoleKey];
  delete _sessions[consoleKey];
  await tx('playtime', 'readwrite', s => s.add({
    console: consoleKey, ms, when: Date.now(),
  }));
}

export async function totalPlaytime(consoleKey) {
  const rows = await all('playtime', consoleKey);
  return rows.reduce((a, b) => a + (b.ms || 0), 0);
}

export function formatPlaytime(ms) {
  if (ms < 60_000) return `${Math.round(ms / 1000)} s`;
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60); const m = mins % 60;
  return `${h}h ${m}m`;
}

/* ========== Toasts ========== */

let _toastRoot;
function showToast(title, desc) {
  if (!_toastRoot) {
    _toastRoot = document.createElement('div');
    _toastRoot.style.cssText = 'position:fixed;right:20px;top:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(_toastRoot);
  }
  const t = document.createElement('div');
  t.style.cssText = `
    background: rgba(14,22,54,0.95);
    border: 1px solid rgba(96,165,250,0.4);
    color: #fff;
    padding: 12px 18px;
    border-radius: 10px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    box-shadow: 0 10px 30px rgba(0,0,0,0.4), 0 0 20px rgba(96,165,250,0.3);
    backdrop-filter: blur(12px);
    min-width: 240px;
    max-width: 340px;
    animation: toastIn 0.4s cubic-bezier(.2,.9,.3,1.1);
  `;
  t.innerHTML = `<div style="font-weight:700;font-size:14px;letter-spacing:0.02em">${title}</div>
                 ${desc ? `<div style="font-size:12px;color:#8b9bc5;margin-top:4px">${desc}</div>` : ''}`;
  _toastRoot.appendChild(t);
  if (!document.getElementById('toast-css')) {
    const s = document.createElement('style');
    s.id = 'toast-css';
    s.textContent = '@keyframes toastIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }';
    document.head.appendChild(s);
  }
  setTimeout(() => {
    t.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    t.style.opacity = '0';
    t.style.transform = 'translateX(100px)';
    setTimeout(() => t.remove(), 300);
  }, 3600);
}

/* Boot-up achievement trigger: every console calls this once on load. */
export async function recordBoot(consoleKey) {
  const bootKey = { wii:'wii-boot', gamecube:'gc-boot', wiiu:'wu-boot', switch:'sw-boot', n64:'n64-boot', nes:'nes-start', snes:'snes-start', gb:'gb-boot', gba:'gba-boot', genesis:'gen-boot', ps1:'ps1-boot' }[consoleKey];
  if (bootKey) await unlock(consoleKey, bootKey);
}

export async function recordRomAdded(consoleKey, totalCount) {
  const firstKey = { wii:'wii-first-rom', gamecube:'gc-first-rom', wiiu:'wu-first-rom', n64:'n64-first-rom', nes:'nes-first-rom', snes:'snes-first-rom', gb:'gb-first-rom', gba:'gba-first-rom', genesis:'gen-first-rom', ps1:'ps1-first-rom' }[consoleKey];
  if (firstKey && totalCount >= 1) await unlock(consoleKey, firstKey);
  if (consoleKey === 'wii' && totalCount >= 10) await unlock('wii', 'wii-ten');
  if (consoleKey === 'switch' && totalCount >= 10) await unlock('switch', 'sw-ten');
}

export async function recordPlay(consoleKey) {
  const playKey = { wii:'wii-play', gamecube:'gc-play', n64:'n64-play', nes:'nes-play', snes:'snes-play', gb:'gb-play', gba:'gba-play', genesis:'gen-play', ps1:'ps1-play' }[consoleKey];
  if (playKey) await unlock(consoleKey, playKey);
}

/* ========== Auto-attach — one call per console ==========
 *
 * Adds:
 *   - A floating "🏆" button bottom-right that opens a Trophies/Screenshots/Saves panel.
 *   - F2 → screenshot capture of any visible <canvas> (works during emulation).
 *   - F3 → open the panel.
 *   - On load, records the boot achievement.
 */

export function autoAttach(consoleKey) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => _attach(consoleKey));
  } else {
    _attach(consoleKey);
  }
}

function _attach(consoleKey) {
  recordBoot(consoleKey);

  window.addEventListener('rom:added', async e => {
    if (e.detail?.console !== consoleKey) return;
    await recordRomAdded(consoleKey, e.detail.total || 1);
  });
  window.addEventListener('play:start', async e => {
    if (e.detail?.console !== consoleKey) return;
    await recordPlay(consoleKey);
    startPlay(consoleKey);
  });

  // Floating button
  const btn = document.createElement('button');
  btn.innerHTML = '🏆';
  btn.title = 'Trophies, Screenshots & Saves (F3)';
  btn.style.cssText = `
    position: fixed; right: 16px; bottom: 60px; z-index: 180;
    width: 46px; height: 46px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.3);
    background: rgba(14,22,54,0.75); color: #fff;
    font-size: 20px; cursor: pointer;
    backdrop-filter: blur(10px);
    box-shadow: 0 6px 20px rgba(0,0,0,0.4);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  `;
  btn.onmouseenter = () => { btn.style.transform = 'scale(1.1)'; btn.style.boxShadow = '0 6px 24px rgba(96,165,250,0.5)'; };
  btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; btn.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)'; };
  btn.onclick = () => openPanel(consoleKey);
  document.body.appendChild(btn);

  // Keyboard hooks
  window.addEventListener('keydown', e => {
    if (e.key === 'F3') { e.preventDefault(); openPanel(consoleKey); }
    if (e.key === 'F4') { e.preventDefault(); toggleCrt(consoleKey); }
    if (e.key === 'F2') {
      e.preventDefault();
      const canvas = document.querySelector('.emu-mount canvas, #emu-mount canvas');
      if (canvas) {
        try {
          const url = canvas.toDataURL('image/png');
          saveScreenshot(consoleKey, url, `${consoleKey} @ ${new Date().toISOString()}`);
          const sKey = { wii:'wii-screenshot', switch:'sw-screenshot' }[consoleKey];
          if (sKey) unlock(consoleKey, sKey);
        } catch (err) { console.warn('Screenshot failed:', err); }
      }
    }
  });

  // Restore CRT preference
  if (localStorage.getItem(`crt:${consoleKey}`) === '1') applyCrt(true);
}

/* ---------- CRT overlay ---------- */

function applyCrt(on) {
  let el = document.getElementById('nin64-crt');
  if (!el) {
    el = document.createElement('div');
    el.id = 'nin64-crt';
    el.style.cssText = `
      position: fixed; inset: 0; pointer-events: none; z-index: 220;
      background:
        repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 2px, transparent 2px 4px),
        radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.5) 100%);
      mix-blend-mode: multiply;
      opacity: 0; transition: opacity 0.3s ease;
    `;
    document.body.appendChild(el);
  }
  requestAnimationFrame(() => el.style.opacity = on ? '1' : '0');
}

export function toggleCrt(consoleKey) {
  const key = `crt:${consoleKey}`;
  const next = localStorage.getItem(key) === '1' ? '0' : '1';
  localStorage.setItem(key, next);
  applyCrt(next === '1');
  showToast(next === '1' ? '📺 CRT overlay on' : '📺 CRT overlay off', 'Press F4 to toggle');
}

function openPanel(consoleKey) {
  let panel = document.getElementById('nin64-features-panel');
  if (panel) { panel.classList.toggle('on'); refreshPanel(consoleKey); return; }

  panel = document.createElement('div');
  panel.id = 'nin64-features-panel';
  panel.className = 'on';
  panel.innerHTML = `
    <style>
      #nin64-features-panel {
        position: fixed; inset: 0; z-index: 190;
        display: none; align-items: center; justify-content: center;
        background: rgba(2, 4, 10, 0.78);
        backdrop-filter: blur(14px);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #nin64-features-panel.on { display: flex; }
      #nin64-features-panel .fpanel {
        width: min(880px, 94vw); max-height: 86vh;
        background: linear-gradient(180deg, rgba(14,22,54,0.98), rgba(10,16,36,0.98));
        color: #e6ecff;
        border: 1px solid rgba(96,165,250,0.35);
        border-radius: 18px; padding: 24px 28px; overflow: auto;
        box-shadow: 0 30px 80px rgba(0,0,0,0.7);
      }
      #nin64-features-panel h2 { margin: 0; font-size: 18px; letter-spacing: 0.05em; }
      #nin64-features-panel .tabs { display: flex; gap: 6px; margin: 16px 0; border-bottom: 1px solid rgba(96,165,250,0.15); }
      #nin64-features-panel .tab {
        padding: 10px 16px; border: 0; background: transparent;
        color: #8b9bc5; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase;
        cursor: pointer; border-bottom: 2px solid transparent;
      }
      #nin64-features-panel .tab.on { color: #fff; border-bottom-color: #60a5fa; }
      #nin64-features-panel .trophies { display: grid; gap: 8px; }
      #nin64-features-panel .trow {
        display: grid; grid-template-columns: 40px 1fr auto; gap: 14px; align-items: center;
        padding: 12px 16px; border: 1px solid rgba(96,165,250,0.15); border-radius: 10px;
        background: rgba(14,22,54,0.5);
      }
      #nin64-features-panel .trow.locked { opacity: 0.45; }
      #nin64-features-panel .trow .icon { font-size: 22px; text-align: center; }
      #nin64-features-panel .trow .n { font-weight: 700; font-size: 14px; }
      #nin64-features-panel .trow .d { font-size: 12px; color: #8b9bc5; margin-top: 2px; }
      #nin64-features-panel .trow .when { font-size: 11px; color: #8b9bc5; letter-spacing: 0.1em; text-transform: uppercase; }
      #nin64-features-panel .shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
      #nin64-features-panel .shot { position: relative; border-radius: 8px; overflow: hidden; border: 1px solid rgba(96,165,250,0.2); aspect-ratio: 16/9; }
      #nin64-features-panel .shot img { width: 100%; height: 100%; object-fit: cover; }
      #nin64-features-panel .shot .cap { position: absolute; left: 0; right: 0; bottom: 0; padding: 6px 10px; font-size: 11px;
        background: linear-gradient(0deg, rgba(0,0,0,0.75), transparent); color: #fff; }
      #nin64-features-panel .shot button { position: absolute; top: 6px; right: 6px;
        background: rgba(0,0,0,0.6); color: #fff; border: 0; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 11px; }
      #nin64-features-panel .empty { color: #8b9bc5; font-size: 13px; padding: 20px; text-align: center; }
      #nin64-features-panel .save-row {
        display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center;
        padding: 10px 14px; border: 1px solid rgba(96,165,250,0.15); border-radius: 8px; margin-bottom: 6px;
        background: rgba(14,22,54,0.5); font-size: 13px;
      }
      #nin64-features-panel button.pbtn {
        padding: 6px 14px; background: #60a5fa; color: #03050b; border: 0; border-radius: 6px;
        font-weight: 700; font-size: 12px; cursor: pointer; letter-spacing: 0.05em;
      }
      #nin64-features-panel .close {
        float: right; background: transparent; color: #8b9bc5; border: 0; font-size: 22px; cursor: pointer;
      }
      #nin64-features-panel .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; }
      #nin64-features-panel .stat {
        padding: 14px; border: 1px solid rgba(96,165,250,0.15); border-radius: 10px;
        background: rgba(14,22,54,0.5);
      }
      #nin64-features-panel .stat .label { font-size: 10px; letter-spacing: 0.2em; color: #8b9bc5; text-transform: uppercase; }
      #nin64-features-panel .stat .v { font-size: 26px; font-weight: 900; margin-top: 4px; }
    </style>
    <div class="fpanel">
      <button class="close" data-close-panel>✕</button>
      <h2>🏆 ${consoleKey.toUpperCase()} · Memories</h2>
      <div class="stat-grid">
        <div class="stat"><div class="label">Trophies</div><div class="v" id="ft-stat-trophies">—</div></div>
        <div class="stat"><div class="label">Screenshots</div><div class="v" id="ft-stat-shots">—</div></div>
        <div class="stat"><div class="label">Playtime</div><div class="v" id="ft-stat-time">—</div></div>
      </div>
      <div class="tabs">
        <button class="tab on" data-tab="trophies">Trophies</button>
        <button class="tab"    data-tab="shots">Screenshots</button>
        <button class="tab"    data-tab="saves">Saves</button>
      </div>
      <div data-view="trophies"></div>
      <div data-view="shots" style="display:none"></div>
      <div data-view="saves" style="display:none"></div>
      <p style="margin-top:16px;color:#8b9bc5;font-size:11px;letter-spacing:0.08em">
        Press <b>F2</b> during gameplay to screenshot · <b>F3</b> to toggle this panel
      </p>
    </div>
  `;
  document.body.appendChild(panel);
  panel.querySelector('[data-close-panel]').onclick = () => panel.classList.remove('on');
  panel.addEventListener('click', e => { if (e.target === panel) panel.classList.remove('on'); });
  panel.querySelectorAll('.tab').forEach(t => t.onclick = () => {
    panel.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
    t.classList.add('on');
    panel.querySelectorAll('[data-view]').forEach(v => v.style.display = 'none');
    panel.querySelector(`[data-view="${t.dataset.tab}"]`).style.display = '';
  });
  refreshPanel(consoleKey);
}

async function refreshPanel(consoleKey) {
  const panel = document.getElementById('nin64-features-panel');
  if (!panel) return;

  const [trophies, shots, saves, time] = await Promise.all([
    listAchievements(consoleKey),
    listScreenshots(consoleKey),
    listSaves(consoleKey),
    totalPlaytime(consoleKey),
  ]);

  panel.querySelector('#ft-stat-trophies').textContent = `${trophies.filter(t => t.unlocked).length}/${trophies.length}`;
  panel.querySelector('#ft-stat-shots').textContent    = shots.length;
  panel.querySelector('#ft-stat-time').textContent     = time > 0 ? formatPlaytime(time) : '—';

  const tv = panel.querySelector('[data-view="trophies"]');
  tv.innerHTML = '<div class="trophies">' + trophies.map(t => `
    <div class="trow ${t.unlocked ? '' : 'locked'}">
      <div class="icon">${t.unlocked ? '🏆' : '🔒'}</div>
      <div><div class="n">${t.name}</div><div class="d">${t.desc}</div></div>
      <div class="when">${t.when ? new Date(t.when).toLocaleDateString() : ''}</div>
    </div>`).join('') + '</div>';

  const sv = panel.querySelector('[data-view="shots"]');
  if (!shots.length) sv.innerHTML = '<div class="empty">No screenshots yet. Press F2 in-game to capture.</div>';
  else sv.innerHTML = '<div class="shots">' + shots.map(s => `
      <div class="shot"><img src="${s.url}"><div class="cap">${new Date(s.when).toLocaleString()}</div>
      <button data-del-shot="${s.id}">✕</button></div>
    `).join('') + '</div>';
  sv.querySelectorAll('[data-del-shot]').forEach(b => b.onclick = async e => {
    await removeScreenshot(+e.target.dataset.delShot);
    refreshPanel(consoleKey);
  });

  const av = panel.querySelector('[data-view="saves"]');
  if (!saves.length) av.innerHTML = '<div class="empty">No save states stored yet.</div>';
  else av.innerHTML = saves.map(s => `
    <div class="save-row">
      <span><b>${s.name}</b> · <small style="color:#8b9bc5">${new Date(s.when).toLocaleString()}</small></span>
      <button class="pbtn" data-dl-save="${s.id}">Export</button>
      <button class="pbtn" style="background:#f87171" data-del-save="${s.id}">✕</button>
    </div>
  `).join('');
  av.querySelectorAll('[data-dl-save]').forEach(b => b.onclick = async e => {
    const id = +e.target.dataset.dlSave;
    const s = saves.find(x => x.id === id);
    if (s) s.download();
  });
  av.querySelectorAll('[data-del-save]').forEach(b => b.onclick = async e => {
    await removeSave(+e.target.dataset.delSave);
    refreshPanel(consoleKey);
  });
}
