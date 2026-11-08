/* sound.js — Web Audio-synthesised UI sounds.
 *
 * All original FM/envelope synthesis. No copyrighted samples. Each console
 * has its own palette of blips, selects and boot stingers that evoke the
 * feel of its era without being the actual thing.
 */

let _ctx;
export function ctx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

/* Low-level helpers ------------------------------------------------------ */

function env(gain, t0, { a = 0.005, d = 0.08, s = 0, r = 0.02, peak = 1 } = {}) {
  gain.gain.cancelScheduledValues(t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + a);
  gain.gain.linearRampToValueAtTime(s * peak, t0 + a + d);
  gain.gain.linearRampToValueAtTime(0, t0 + a + d + r);
}

function tone(freq, {
  type = 'sine', dur = 0.12, when = 0, peak = 0.2,
  a = 0.005, d = 0.09, s = 0, r = 0.02, detune = 0, pan = 0, filter = null,
} = {}) {
  const c = ctx();
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  const p = c.createStereoPanner ? c.createStereoPanner() : null;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (detune) osc.detune.setValueAtTime(detune, t0);
  let node = osc.connect(g);
  if (filter) {
    const f = c.createBiquadFilter();
    f.type = filter.type || 'lowpass';
    f.frequency.value = filter.freq || 2000;
    f.Q.value = filter.Q || 0.7;
    node = node.connect(f);
  }
  if (p) {
    p.pan.value = pan;
    node.connect(p).connect(c.destination);
  } else {
    node.connect(c.destination);
  }
  env(g, t0, { a, d, s, r, peak });
  osc.start(t0);
  osc.stop(t0 + a + d + r + dur);
  return osc;
}

function fm(carrier, modRatio, modIndex, opts = {}) {
  const c = ctx();
  const t0 = c.currentTime + (opts.when || 0);
  const car = c.createOscillator();
  const mod = c.createOscillator();
  const modGain = c.createGain();
  const amp = c.createGain();
  car.frequency.value = carrier;
  mod.frequency.value = carrier * modRatio;
  modGain.gain.value = carrier * modIndex;
  mod.connect(modGain).connect(car.frequency);
  car.connect(amp).connect(ctx().destination);
  env(amp, t0, { a: opts.a ?? 0.01, d: opts.d ?? 0.2, s: opts.s ?? 0, r: opts.r ?? 0.05, peak: opts.peak ?? 0.18 });
  mod.start(t0); car.start(t0);
  const stopAt = t0 + (opts.a ?? 0.01) + (opts.d ?? 0.2) + (opts.r ?? 0.05) + 0.05;
  mod.stop(stopAt); car.stop(stopAt);
}

function noise({ dur = 0.2, when = 0, peak = 0.15, filter = null } = {}) {
  const c = ctx();
  const t0 = c.currentTime + when;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  let node = src.connect(g);
  if (filter) {
    const f = c.createBiquadFilter();
    f.type = filter.type || 'bandpass';
    f.frequency.value = filter.freq || 1200;
    f.Q.value = filter.Q || 2;
    node = node.connect(f);
  }
  node.connect(c.destination);
  env(g, t0, { a: 0.005, d: dur * 0.9, s: 0, r: 0.03, peak });
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

/* Palette: a map of named UI events → sound recipes.
 * Each console's index page loads the file and calls play('hover') etc. */

const palettes = {
  /* Boot picker — warm starfield blip */
  picker: {
    hover()   { tone(880, { type: 'sine', dur: 0.05, peak: 0.08, d: 0.04 }); },
    select()  { fm(440, 2, 2, { peak: 0.22, d: 0.28 }); tone(880, { when: 0.02, dur: 0.08, peak: 0.12 }); },
    boot()    {
      fm(220, 3, 3, { peak: 0.24, a: 0.02, d: 0.6 });
      tone(660, { when: 0.1, type: 'triangle', dur: 0.3, peak: 0.1 });
      tone(880, { when: 0.3, type: 'sine', dur: 0.4, peak: 0.08 });
    },
    locked()  { tone(140, { type: 'sawtooth', dur: 0.14, peak: 0.1, filter: { type: 'lowpass', freq: 600 } }); },
  },

  /* Wii: airy, clean, tick */
  wii: {
    hover()  { tone(1760, { type: 'sine', dur: 0.03, peak: 0.07, d: 0.025, r: 0.01 }); },
    select() {
      tone(1320, { type: 'sine', dur: 0.08, peak: 0.12 });
      tone(1760, { when: 0.04, dur: 0.1, peak: 0.1 });
    },
    back()   { tone(880, { type: 'sine', dur: 0.08, peak: 0.1 }); tone(660, { when: 0.04, dur: 0.08, peak: 0.08 }); },
    boot() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone(f, { type: 'triangle', dur: 0.4, peak: 0.12, when: i * 0.12, a: 0.03, d: 0.25, r: 0.12 }));
    },
  },

  /* GameCube: iconic glassy, descending */
  gamecube: {
    hover()  { tone(1500, { type: 'sine', dur: 0.04, peak: 0.06, d: 0.03 }); },
    select() { fm(660, 1.5, 4, { peak: 0.2, d: 0.2 }); },
    boot() {
      // Rolling marimba-like cascade
      const notes = [392, 523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((f, i) => fm(f, 2, 5, { when: i * 0.08, peak: 0.18, d: 0.25, a: 0.004 }));
      tone(130, { type: 'sine', dur: 1.5, peak: 0.08, a: 0.1, d: 1.2, r: 0.2, when: 0.3 });
    },
  },

  /* Wii U: softer, friendly */
  wiiu: {
    hover()  { tone(1400, { type: 'sine', dur: 0.04, peak: 0.07, d: 0.03 }); },
    select() { tone(900, { type: 'sine', dur: 0.1, peak: 0.14 }); tone(1350, { when: 0.05, dur: 0.1, peak: 0.1 }); },
    boot() {
      [587.33, 783.99, 988, 1318.5].forEach((f, i) =>
        tone(f, { type: 'sine', dur: 0.5, peak: 0.1, when: i * 0.1, a: 0.04, d: 0.3, r: 0.15 }));
    },
  },

  /* Switch: sharp percussive click + warm select */
  switch: {
    hover()  { noise({ dur: 0.03, peak: 0.07, filter: { type: 'highpass', freq: 3500 } }); },
    select() {
      noise({ dur: 0.04, peak: 0.1, filter: { type: 'highpass', freq: 2000 } });
      tone(1760, { when: 0.02, type: 'sine', dur: 0.08, peak: 0.1 });
    },
    boot() {
      tone(55, { type: 'sine', dur: 0.8, peak: 0.2, a: 0.01, d: 0.3, r: 0.4 });
      tone(880, { when: 0.3, type: 'triangle', dur: 0.4, peak: 0.1 });
    },
  },

  /* N64: bitcrushed, bold */
  n64: {
    hover()  { tone(660, { type: 'square', dur: 0.03, peak: 0.08, filter: { type: 'lowpass', freq: 2200 } }); },
    select() { fm(220, 1, 6, { peak: 0.22, d: 0.2 }); },
    boot()   {
      // Deep rising stinger
      for (let i = 0; i < 6; i++) {
        tone(110 * Math.pow(1.5, i / 5), { type: 'square', dur: 0.15, peak: 0.1, when: i * 0.08,
          filter: { type: 'lowpass', freq: 1800 } });
      }
    },
  },

  /* NES: classic chip */
  nes: {
    hover()  { tone(1046.5, { type: 'square', dur: 0.02, peak: 0.08 }); },
    select() { tone(1046.5, { type: 'square', dur: 0.04, peak: 0.15 });
               tone(1568, { when: 0.04, type: 'square', dur: 0.06, peak: 0.15 }); },
    boot()   {
      [261.63, 329.63, 392, 523.25].forEach((f, i) =>
        tone(f, { type: 'square', dur: 0.12, peak: 0.12, when: i * 0.08 }));
    },
  },

  /* SNES: rich, slightly tri */
  snes: {
    hover()  { tone(1318.5, { type: 'triangle', dur: 0.03, peak: 0.08 }); },
    select() {
      tone(880, { type: 'triangle', dur: 0.08, peak: 0.14 });
      tone(1318.5, { when: 0.04, type: 'triangle', dur: 0.08, peak: 0.1 });
    },
    boot()   {
      [523.25, 783.99, 1046.5].forEach((f, i) =>
        tone(f, { type: 'triangle', dur: 0.3, peak: 0.14, when: i * 0.1, d: 0.2, r: 0.1 }));
    },
  },
};

export function play(palette, event) {
  try {
    const p = palettes[palette];
    if (p && p[event]) p[event]();
  } catch (e) { /* audio optional, swallow */ }
}

export function mute(flag) {
  try { ctx().destination.disconnect?.(); } catch {}
}
