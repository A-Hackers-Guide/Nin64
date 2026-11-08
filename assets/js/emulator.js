/* emulator.js — thin wrapper around EmulatorJS (loaded from CDN at runtime).
 *
 * EmulatorJS is MIT-licensed. It runs libretro cores in-browser (WebAssembly).
 * All ROMs come from the user's local IndexedDB library; nothing is uploaded.
 *
 * Supported here: NES, SNES, N64, GameCube, Wii. Wii U and Switch do not have
 * practical browser cores — those consoles get a friendly message.
 */

import { getRom } from './roms.js';

const EJS_CDN = 'https://cdn.emulatorjs.org/stable/data/';

const CORE_FOR = {
  nes: 'fceumm',
  snes: 'snes9x',
  n64: 'mupen64plus_next',
  gamecube: 'dolphin',
  wii: 'dolphin',
  gb: 'gambatte',
  gba: 'mgba',
  genesis: 'genesis_plus_gx',
  ps1: 'pcsx_rearmed',
};

export function canEmulate(consoleKey) {
  return consoleKey in CORE_FOR;
}

/* Mount the emulator into `mountEl` with ROM id from the local IndexedDB. */
export async function runRom(consoleKey, romId, mountEl, { onReady } = {}) {
  if (!canEmulate(consoleKey)) {
    mountEl.innerHTML = `<div class="emu-unsupported">
      In-browser emulation for ${consoleKey.toUpperCase()} is not available
      on current cores. Your ROMs stay stored locally — you can run them
      with a desktop emulator (Cemu / Ryujinx) for now.</div>`;
    return;
  }
  const rom = await getRom(romId);
  if (!rom) throw new Error('ROM not found');

  try { window.dispatchEvent(new CustomEvent('play:start', { detail: { console: consoleKey, romId } })); } catch {}

  // Stage a game container
  mountEl.innerHTML = '';
  const game = document.createElement('div');
  game.id = 'game';
  mountEl.appendChild(game);

  // Blob URL for the ROM data
  const url = URL.createObjectURL(new Blob([rom.data]));

  // Globals EmulatorJS reads
  window.EJS_player = '#game';
  window.EJS_core = CORE_FOR[consoleKey];
  window.EJS_gameUrl = url;
  window.EJS_pathtodata = EJS_CDN;
  window.EJS_startOnLoaded = true;
  window.EJS_gameName = rom.name;
  window.EJS_color = '#60a5fa';
  window.EJS_Buttons = {
    playPause: true, restart: true, mute: true, settings: true, fullscreen: true,
    saveState: true, loadState: true, screenshot: true, screenRecord: true,
    quickSave: true, quickLoad: true, exitEmulation: true,
    gamepad: true, cheat: true, cacheManager: true,
    diskButton: true, contextMenuButton: true,
  };
  window.EJS_cheats = true;
  window.EJS_defaultControls = undefined; // use EmulatorJS defaults; user can remap in Settings > Controls
  window.EJS_ready = () => onReady?.();

  // Inject loader script if not already present
  if (!document.querySelector('script[data-ejs]')) {
    const s = document.createElement('script');
    s.src = EJS_CDN + 'loader.js';
    s.setAttribute('data-ejs', '1');
    document.body.appendChild(s);
  } else {
    // Loader already present — reload by replacing
    const old = document.querySelector('script[data-ejs]');
    old.remove();
    const s = document.createElement('script');
    s.src = EJS_CDN + 'loader.js';
    s.setAttribute('data-ejs', '1');
    document.body.appendChild(s);
  }
}
