/* storage.js — local disk-space accounting and safety rails.
 *
 * Browsers cap each origin's IndexedDB. Hitting that cap kills ROM writes
 * mid-flight and can wipe older rows at the browser's discretion. Nin64
 * stays usable by:
 *   - showing real quota + usage anywhere a user adds a ROM,
 *   - asking for persistent storage after a meaningful write,
 *   - warning before a write that would push past 85% of quota,
 *   - offering one-click clears per bucket (ROMs, screenshots, saves).
 */

import { listRoms, removeRom, formatBytes } from './roms.js';

/* ---------- Quota ---------- */

export async function quota() {
  if (!navigator.storage?.estimate) {
    return { usage: 0, quota: 0, ratio: 0, unknown: true };
  }
  const q = await navigator.storage.estimate();
  const usage = q.usage || 0;
  const cap   = q.quota || 0;
  const ratio = cap ? usage / cap : 0;
  return { usage, quota: cap, ratio, unknown: false };
}

export async function isPersistent() {
  if (!navigator.storage?.persisted) return false;
  try { return await navigator.storage.persisted(); } catch { return false; }
}

export async function requestPersistent() {
  if (!navigator.storage?.persist) return false;
  try { return await navigator.storage.persist(); } catch { return false; }
}

/* ---------- Pre-write guard ----------
 *
 * Call before a batch of file reads. Returns:
 *   { ok: true }                           → proceed
 *   { ok: false, reason: 'quota-exceed' }  → user said no
 *   { ok: false, reason: 'blocked' }       → an added size exceeds remaining
 */

export async function guardWrite(incomingBytes) {
  const q = await quota();
  if (q.unknown) return { ok: true };
  const after  = q.usage + incomingBytes;
  const afterR = q.quota ? after / q.quota : 0;

  if (afterR >= 0.98) {
    return { ok: false, reason: 'blocked',
      msg: `This would need ${formatBytes(incomingBytes)} on top of ${formatBytes(q.usage)} already stored — that passes your browser's ${formatBytes(q.quota)} quota. Clear some data first.` };
  }

  if (afterR >= 0.85) {
    const proceed = window.confirm(
      `Heads up — this write will push your local storage to ${(afterR*100).toFixed(0)}% ` +
      `of the browser's ${formatBytes(q.quota)} cap. The browser may start evicting data. Continue?`
    );
    if (!proceed) return { ok: false, reason: 'quota-exceed' };
  }

  // Request persistent storage once we're doing meaningful writes
  if (!(await isPersistent()) && q.usage > 50 * 1024 * 1024) {
    requestPersistent().catch(() => {});
  }
  return { ok: true };
}

/* ---------- Bucket sums ---------- */

export async function sizes() {
  const result = { roms: 0, screenshots: 0, saves: 0, total: 0, counts: { roms: 0, screenshots: 0, saves: 0 } };
  try {
    const roms = await listRoms();
    for (const r of roms) { result.roms += r.size; result.counts.roms++; }
  } catch {}
  // Screenshots + saves live in nin64-features DB — look them up directly
  try {
    const db = await openFeaturesDb();
    for (const store of ['screenshots', 'saves']) {
      const rows = await new Promise((res, rej) => {
        const t = db.transaction(store, 'readonly');
        const r = t.objectStore(store).getAll();
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
      for (const row of rows) {
        const blob = row.blob;
        if (blob && typeof blob.size === 'number') {
          result[store] += blob.size;
          result.counts[store]++;
        }
      }
    }
  } catch {}
  result.total = result.roms + result.screenshots + result.saves;
  return result;
}

function openFeaturesDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('nin64-features');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ---------- Clear ops ---------- */

export async function clearRoms() {
  const roms = await listRoms();
  for (const r of roms) await removeRom(r.id);
}

export async function clearStore(storeName) {
  const db = await openFeaturesDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, 'readwrite');
    const r = t.objectStore(storeName).clear();
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}
export async function clearScreenshots() { await clearStore('screenshots'); }
export async function clearSaves()       { await clearStore('saves'); }
export async function clearAchievements() { await clearStore('achievements'); }

export async function clearEverything() {
  await clearRoms();
  await clearStore('screenshots');
  await clearStore('saves');
  await clearStore('playtime');
  // achievements intentionally preserved — ask separately before clearing
}

/* ---------- Human-readable diagnostics ---------- */

export function ratioToLabel(r) {
  if (r >= 0.9) return 'Critical';
  if (r >= 0.75) return 'High';
  if (r >= 0.5)  return 'Moderate';
  if (r >= 0.2)  return 'Light';
  return 'Low';
}

export function ratioColor(r) {
  if (r >= 0.9) return '#ef4444';
  if (r >= 0.75) return '#f97316';
  if (r >= 0.5)  return '#eab308';
  if (r >= 0.2)  return '#34d399';
  return '#60a5fa';
}
