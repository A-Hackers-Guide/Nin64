/* hardware.js — client-only hardware benchmark + tier gating
 *
 * A console is "unlocked" when the local score meets its tier threshold.
 * All measurement happens in the browser. Nothing leaves the device.
 */

const TIERS = {
  1: { name: 'Light',      min: 0   },  // NES, SNES
  2: { name: 'Moderate',   min: 35  },  // N64
  3: { name: 'Demanding',  min: 60  },  // GameCube, Wii
  4: { name: 'Extreme',    min: 85  },  // Wii U, Switch
};

async function readGpuInfo() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return { renderer: 'none', vendor: 'none', score: 0 };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
    const vendor   = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)   : 'unknown';

    // Heuristic GPU score based on renderer string keywords
    const s = String(renderer).toLowerCase();
    let score = 10; // baseline WebGL
    if (s.includes('apple m')) {
      score = s.match(/m[23456789]/) ? 24 : 20;
    } else if (/rtx 40|rtx 50|rx 7\d\d\d|rx 9\d\d\d/.test(s)) score = 25;
    else if (/rtx 30|rtx 20|rx 6\d\d\d/.test(s)) score = 22;
    else if (/gtx 16|gtx 10|rx 5\d\d\d/.test(s)) score = 18;
    else if (/intel.*iris|intel.*xe|intel arc/.test(s)) score = 14;
    else if (/intel.*hd|intel.*uhd/.test(s)) score = 8;
    else if (/adreno 7|mali-g7/.test(s)) score = 12;
    else if (/swiftshader|software/.test(s)) score = 2;
    return { renderer: String(renderer), vendor: String(vendor), score };
  } catch { return { renderer: 'error', vendor: 'error', score: 0 }; }
}

function readWasmFeatures() {
  // Rough proxy: SIMD, threads, bulk-memory — the big three for emulator cores
  const feats = { simd: false, threads: false, bulkMemory: false };
  try {
    // SIMD check — valid module with v128 type
    feats.simd = WebAssembly.validate(new Uint8Array([
      0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,
      10,10,1,8,0,65,0,253,15,253,98,11
    ]));
  } catch {}
  try { feats.threads = typeof SharedArrayBuffer !== 'undefined'; } catch {}
  try {
    feats.bulkMemory = WebAssembly.validate(new Uint8Array([
      0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,5,3,1,0,1,
      10,9,1,7,0,65,0,65,0,252,11,0,11
    ]));
  } catch {}

  let score = 5;
  if (feats.simd) score += 10;
  if (feats.threads) score += 7;
  if (feats.bulkMemory) score += 3;
  return { ...feats, score };
}

async function microBenchmark() {
  // Tiny arithmetic + typed-array loop; a floor on raw single-thread throughput.
  const N = 2_000_000;
  const buf = new Float64Array(1024);
  for (let i = 0; i < 1024; i++) buf[i] = Math.sin(i);
  const t0 = performance.now();
  let acc = 0;
  for (let i = 0; i < N; i++) acc += buf[i & 1023] * 1.000001 + i * 1e-9;
  const t1 = performance.now();
  const ms = t1 - t0;
  // Faster = higher. 20 ms → ~25pts, 200 ms → ~2pts
  const score = Math.min(25, Math.max(0, Math.round(500 / Math.max(ms, 1))));
  return { ms: +ms.toFixed(1), acc, score };
}

export async function benchmark() {
  const cores  = navigator.hardwareConcurrency || 2;
  const memGB  = navigator.deviceMemory || 4;    // Safari & FF return undefined → assume 4
  const dpr    = window.devicePixelRatio || 1;
  const screen = { w: window.screen.width, h: window.screen.height, dpr };

  const gpu   = await readGpuInfo();
  const wasm  = readWasmFeatures();
  const micro = await microBenchmark();

  // CPU score: cores (0-10) + micro throughput (0-25) — up to 35
  const cpuScore = Math.min(25, Math.round(cores * 2.5)) + micro.score;

  // Memory score: deviceMemory GB (0-25) — 8 GB → 20, 16 GB → 25
  const memScore = Math.min(25, Math.round(memGB * 2.5));

  // Final composite — min 0, max ~100
  const total = Math.min(100, cpuScore + memScore + gpu.score + wasm.score - 10);

  const tier =
    total >= TIERS[4].min ? 4 :
    total >= TIERS[3].min ? 3 :
    total >= TIERS[2].min ? 2 : 1;

  return {
    cores, memGB, screen,
    gpu, wasm, micro,
    cpuScore, memScore,
    total: Math.max(0, total),
    tier,
    tierName: TIERS[tier].name,
  };
}

export function tierFor(consoleKey) {
  return ({
    nes: 1, snes: 1, gb: 1, gba: 1,
    n64: 2,
    gamecube: 3, wii: 3,
    wiiu: 4, switch: 4,
  })[consoleKey] ?? 1;
}

export function unlocked(report, consoleKey) {
  return report.tier >= tierFor(consoleKey);
}

export { TIERS };
