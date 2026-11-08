/* roms.js — local ROM library in IndexedDB. Nothing leaves the browser. */

const DB_NAME = 'retroboot';
const DB_VERSION = 1;
const STORE = 'roms';

const EXT_TO_CORE = {
  nes:  { console: 'nes',      core: 'fceumm' },
  fds:  { console: 'nes',      core: 'fceumm' },
  smc:  { console: 'snes',     core: 'snes9x' },
  sfc:  { console: 'snes',     core: 'snes9x' },
  swc:  { console: 'snes',     core: 'snes9x' },
  n64:  { console: 'n64',      core: 'mupen64plus_next' },
  z64:  { console: 'n64',      core: 'mupen64plus_next' },
  v64:  { console: 'n64',      core: 'mupen64plus_next' },
  iso:  { console: 'gamecube', core: 'dolphin' },
  gcm:  { console: 'gamecube', core: 'dolphin' },
  gcz:  { console: 'gamecube', core: 'dolphin' },
  wbfs: { console: 'wii',      core: 'dolphin' },
  wad:  { console: 'wii',      core: 'dolphin' },
  wud:  { console: 'wiiu',     core: 'unsupported' },
  wux:  { console: 'wiiu',     core: 'unsupported' },
  nsp:  { console: 'switch',   core: 'unsupported' },
  xci:  { console: 'switch',   core: 'unsupported' },
};

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        s.createIndex('byConsole', 'console');
        s.createIndex('byName', 'name');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function classifyFile(name) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_TO_CORE[ext] || null;
}

export async function addRom(file) {
  const meta = classifyFile(file.name);
  if (!meta) throw new Error(`Unrecognized ROM extension: ${file.name}`);
  const blob = await file.arrayBuffer();
  const db = await openDb();
  const id = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).add({
      name: file.name,
      size: file.size,
      console: meta.console,
      core: meta.core,
      added: Date.now(),
      data: blob,
    });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  try {
    const total = (await listRoms(meta.console)).length;
    window.dispatchEvent(new CustomEvent('rom:added', { detail: { console: meta.console, total } }));
  } catch {}
  return id;
}

export async function listRoms(consoleKey = null) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = consoleKey
      ? store.index('byConsole').getAll(consoleKey)
      : store.getAll();
    req.onsuccess = () => resolve(req.result.map(r => ({
      id: r.id, name: r.name, size: r.size, console: r.console, core: r.core, added: r.added,
    })));
    req.onerror = () => reject(req.error);
  });
}

export async function getRom(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function removeRom(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
