// src/lib/audio.ts
//
// Stage 8 Day 21: красивые звуковые эффекты — полноценный синтез.
//
// История:
//   Day 18 — простые sine/triangle тоны на одном oscillator'е каждый.
//            Работало, но звучало плоско (digital console beep).
//   Day 21 — layered synthesis. Каждый звук это minimum 2-4 oscillator'ов
//            + envelope + filter sweep + reverb tail. Размер кода вырос
//            x3, но звук стал кинематографичнее.
//
// Архитектура:
//   AudioContext → masterGain → splitter:
//     ├─ dryGain (90%) → destination
//     └─ wetGain (10%) → ConvolverNode (synth IR) → destination
//
//   ConvolverNode использует процедурно сгенерированный impulse response
//   (exponentially decayed white noise, 1.2s) — даёт mild room reverb
//   без ассетов.
//
// Контракт API не изменился: fx.play(soundId), fx.setMuted(b), etc.
// Существующие 6 soundId сохранены. Внутри они звучат в разы лучше.

export interface AudioApi {
  setMuted: (v: boolean) => void;
  isMuted: () => boolean;
  setVolume: (patch: { master?: number; music?: number; sfx?: number; ui?: number }) => void;
  play: (soundId: SoundId) => void;
}

export type SoundId =
  | 'countdown_beep'   // 3, 2, 1 — chime с octave stack
  | 'countdown_go'     // GO! — cinematic burst (sub kick + mid + high shimmer)
  | 'deploy'           // Click satisfying — body + transient + noise burst
  | 'victory'          // 5-note arpeggio C-E-G-C-E, multilayered
  | 'defeat'           // Descending Am chord pad с pitch drift
  | 'tie';             // FM bell, neutral но богатый обертонами

const MUTE_STORAGE_KEY = 'langton.audio.muted';

function readMutedFromStorage(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch { return false; }
}

function writeMutedToStorage(v: boolean): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(MUTE_STORAGE_KEY, v ? '1' : '0');
  } catch { /* localStorage может быть disabled — silently no-op */ }
}

let muted: boolean = readMutedFromStorage();
let ctx: AudioContext | null = null;
const refs: {
  masterGain: GainNode | null;
  dryBus: GainNode | null;   // direct path
  wetBus: GainNode | null;   // reverb send
} = { masterGain: null, dryBus: null, wetBus: null };
let masterVolume = 0.5;

/**
 * Generate synthesized reverb impulse response: exponentially decayed
 * white noise. Параметры подобраны для mild room reverb (не cathedral).
 * Stereo via different random seeds per channel — даёт wideness.
 */
function createReverbIR(c: AudioContext, durationSec = 1.4, decayRate = 3.2): AudioBuffer {
  const sampleRate = c.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const impulse = c.createBuffer(2, length, sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // Pseudo-random per-sample noise * exponential decay envelope
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decayRate);
    }
  }
  return impulse;
}

/** Lazy-create AudioContext + bus topology. */
function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const AC = W.AudioContext ?? W.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = masterVolume;
    master.connect(ctx.destination);

    const dry = ctx.createGain();
    dry.gain.value = 0.92;
    dry.connect(master);

    const reverb = ctx.createConvolver();
    reverb.buffer = createReverbIR(ctx);

    const wet = ctx.createGain();
    wet.gain.value = 0.18;
    wet.connect(reverb);
    reverb.connect(master);

    refs.masterGain = master;
    refs.dryBus = dry;
    refs.wetBus = wet;
  } catch { return null; }
  return ctx;
}

/**
 * ADSR envelope с exponential curves. Возвращает GainNode у которого
 * input — пин для osc'а, output — connect'ится к dry+wet bus'ам.
 */
function envelope(
  c: AudioContext,
  startTime: number,
  attack: number,
  hold: number,
  release: number,
  peakGain: number,
): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.00001, startTime);
  g.gain.exponentialRampToValueAtTime(peakGain, startTime + attack);
  g.gain.setValueAtTime(peakGain, startTime + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.00001, startTime + attack + hold + release);
  return g;
}

/** Routing helper: connect к dry+wet bus с заданными ratios. */
function routeToBuses(node: AudioNode, dryAmount: number, wetAmount: number): void {
  if (refs.dryBus && dryAmount > 0) {
    const dryG = ctx!.createGain();
    dryG.gain.value = dryAmount;
    node.connect(dryG);
    dryG.connect(refs.dryBus);
  }
  if (refs.wetBus && wetAmount > 0) {
    const wetG = ctx!.createGain();
    wetG.gain.value = wetAmount;
    node.connect(wetG);
    wetG.connect(refs.wetBus);
  }
}

/**
 * Single oscillator с envelope. Optional pitch sweep — frequency
 * рамп от startFreq к endFreq за длительность ноты (для defeat
 * pitch-down эффекта или deploy click).
 */
function osc(
  c: AudioContext,
  type: OscillatorType,
  startFreq: number,
  endFreq: number | null,
  startTime: number,
  attack: number,
  hold: number,
  release: number,
  peak: number,
  dryMix = 1,
  wetMix = 1,
): void {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(startFreq, startTime);
  if (endFreq !== null && endFreq !== startFreq) {
    o.frequency.exponentialRampToValueAtTime(
      Math.max(0.0001, endFreq),
      startTime + attack + hold + release,
    );
  }
  const env = envelope(c, startTime, attack, hold, release, peak);
  o.connect(env);
  routeToBuses(env, dryMix, wetMix);
  o.start(startTime);
  o.stop(startTime + attack + hold + release + 0.05);
}

/**
 * Short white-noise burst через AudioBufferSourceNode. Используется для
 * percussive transients (deploy click attack, countdown_go shimmer).
 */
function noiseBurst(
  c: AudioContext,
  startTime: number,
  duration: number,
  peak: number,
  filterFreq: number,
  dryMix = 1,
  wetMix = 0.3,
): void {
  const sampleRate = c.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * duration));
  const buf = c.createBuffer(1, length, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;

  // High-pass filter для shimmer (отрезает низа от шума)
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = 0.7;

  const env = envelope(c, startTime, 0.001, duration * 0.1, duration * 0.9, peak);
  src.connect(filter);
  filter.connect(env);
  routeToBuses(env, dryMix, wetMix);
  src.start(startTime);
  src.stop(startTime + duration + 0.05);
}

/**
 * FM bell synthesis: один carrier oscillator модулируется частотой
 * другого. Получается богатый звон с обертонами не равными гармоникам
 * carrier'а. Хорошо для tie sound.
 */
function fmBell(
  c: AudioContext,
  carrierFreq: number,
  modRatio: number,    // modFreq = carrierFreq * modRatio
  modIndex: number,    // глубина модуляции в Hz
  startTime: number,
  duration: number,
  peak: number,
  dryMix = 0.8,
  wetMix = 0.6,
): void {
  const carrier = c.createOscillator();
  carrier.type = 'sine';
  carrier.frequency.value = carrierFreq;

  const mod = c.createOscillator();
  mod.type = 'sine';
  mod.frequency.value = carrierFreq * modRatio;

  const modGain = c.createGain();
  modGain.gain.value = modIndex;
  mod.connect(modGain);
  modGain.connect(carrier.frequency);

  const env = envelope(c, startTime, 0.005, duration * 0.15, duration * 0.85, peak);
  carrier.connect(env);
  routeToBuses(env, dryMix, wetMix);
  mod.start(startTime);
  mod.stop(startTime + duration + 0.05);
  carrier.start(startTime);
  carrier.stop(startTime + duration + 0.05);
}

// ─── Sound recipes ───────────────────────────────────────────────────────

function playCountdownBeep(c: AudioContext, t: number): void {
  // Chime: fundamental + octave shimmer + slight detune для chorus
  osc(c, 'sine',     660,   660,   t, 0.005, 0.05, 0.12, 0.45, 1, 0.7);
  osc(c, 'sine',     1320,  1320,  t, 0.005, 0.04, 0.10, 0.18, 1, 0.7);
  osc(c, 'triangle', 662,   662,   t, 0.005, 0.05, 0.12, 0.20, 1, 0.7);
}

function playCountdownGo(c: AudioContext, t: number): void {
  // Cinematic burst: sub-kick + mid hit + high shimmer + noise top
  // Sub-bass kick — sine с pitch sweep 120→50Hz даёт "boom" feel
  osc(c, 'sine',     120,  50,    t,        0.002, 0.02, 0.18, 0.85, 1, 0.6);
  // Mid hit
  osc(c, 'triangle', 440,  440,   t + 0.02, 0.005, 0.10, 0.35, 0.55, 1, 0.9);
  osc(c, 'triangle', 880,  880,   t + 0.02, 0.005, 0.08, 0.30, 0.45, 1, 0.9);
  // High shimmer triad
  osc(c, 'triangle', 1760, 1760,  t + 0.03, 0.003, 0.06, 0.25, 0.25, 1, 0.9);
  osc(c, 'triangle', 2640, 2640,  t + 0.04, 0.003, 0.04, 0.20, 0.18, 1, 0.9);
  // White noise burst — air / impact
  noiseBurst(c, t, 0.18, 0.20, 2200, 1, 0.5);
}

function playDeploy(c: AudioContext, t: number): void {
  // Satisfying click: body click + high transient burst, no reverb
  // Body — sine с быстрым pitch sweep
  osc(c, 'sine',     800,  300,   t, 0.001, 0.005, 0.04, 0.35, 1, 0);
  // High transient — square для digital edge
  osc(c, 'square',   2200, 1400,  t, 0.001, 0.003, 0.025, 0.18, 1, 0);
  // Mild noise click для tactile feel
  noiseBurst(c, t, 0.018, 0.15, 1200, 1, 0);
}

function playVictory(c: AudioContext, t: number): void {
  // Orchestral fanfare: 5-note ascending arpeggio C-E-G-C-E
  // Layer 1: triangle lead (clean)
  // Layer 2: sine sub octave (warmth)
  // Layer 3: triangle octave up (brilliance)
  const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5 E5 G5 C6 E6
  notes.forEach((freq, i) => {
    const start = t + i * 0.11;
    // Lead
    osc(c, 'triangle', freq, freq, start, 0.005, 0.06, 0.28, 0.40, 1, 0.9);
    // Sub octave (warmth)
    osc(c, 'sine', freq / 2, freq / 2, start, 0.005, 0.06, 0.28, 0.22, 1, 0.7);
    // Octave up (sparkle) — только на 3 верхних нотах чтоб не было caterpillar feel
    if (i >= 2) {
      osc(c, 'triangle', freq * 2, freq * 2, start, 0.003, 0.04, 0.20, 0.15, 1, 0.9);
    }
  });
  // Финальный sustain аккорд на последней ноте — C major triad
  const finalT = t + 4 * 0.11 + 0.05;
  osc(c, 'sine',     261.63, 261.63, finalT, 0.02, 0.10, 0.50, 0.22, 1, 0.9); // C4
  osc(c, 'triangle', 329.63, 329.63, finalT, 0.02, 0.10, 0.50, 0.18, 1, 0.9); // E4
  osc(c, 'triangle', 392.00, 392.00, finalT, 0.02, 0.10, 0.50, 0.16, 1, 0.9); // G4
}

function playDefeat(c: AudioContext, t: number): void {
  // Melancholic descending: A minor → F → C arpeggio + pitch drift вниз
  const notes = [659.25, 523.25, 440.00, 349.23]; // E5 C5 A4 F4
  notes.forEach((freq, i) => {
    const start = t + i * 0.18;
    // Sine main с slow attack (sigh-like)
    osc(c, 'sine', freq, freq * 0.97, start, 0.04, 0.10, 0.35, 0.32, 1, 1);
    // Triangle slight detune под (chorus warmth) — третья гармоника
    osc(c, 'triangle', freq * 0.502, freq * 0.487, start, 0.05, 0.08, 0.30, 0.15, 1, 1);
  });
  // Final pad — Am chord держится дольше, slow tape-stop pitch slide
  const padT = t + 4 * 0.18 + 0.05;
  osc(c, 'sine',     440.00, 415.30, padT, 0.10, 0.20, 0.70, 0.18, 1, 1);  // A4 → drift down
  osc(c, 'sine',     523.25, 493.88, padT, 0.10, 0.20, 0.70, 0.14, 1, 1);  // C5 → drift
  osc(c, 'sine',     659.25, 622.25, padT, 0.10, 0.20, 0.70, 0.10, 1, 1);  // E5 → drift
}

function playTie(c: AudioContext, t: number): void {
  // FM bell — neutral но богатый. Carrier 440Hz, modulator 220Hz (ratio 0.5),
  // index 200Hz. Получается "ding" с metallic overtones.
  fmBell(c, 440, 0.5, 200, t, 0.55, 0.32, 1, 0.8);
  // Layer thirds harmonics softly
  fmBell(c, 550, 0.5, 150, t + 0.03, 0.50, 0.18, 1, 0.8);
  // Sub sine для grounding
  osc(c, 'sine', 220, 220, t, 0.02, 0.20, 0.35, 0.15, 1, 0.7);
}

// ─── Public play() dispatch ──────────────────────────────────────────────

function playSound(id: SoundId): void {
  if (muted) return;
  const c = getCtx();
  if (!c || !refs.masterGain) return;
  if (c.state === 'suspended') {
    void c.resume().catch(() => {});
  }
  const now = c.currentTime;
  switch (id) {
    case 'countdown_beep': playCountdownBeep(c, now); break;
    case 'countdown_go':   playCountdownGo(c, now); break;
    case 'deploy':         playDeploy(c, now); break;
    case 'victory':        playVictory(c, now); break;
    case 'defeat':         playDefeat(c, now); break;
    case 'tie':            playTie(c, now); break;
  }
}

export const fx: AudioApi = {
  setMuted: (v) => {
    muted = v;
    writeMutedToStorage(v);
  },
  isMuted: () => muted,
  setVolume: (patch) => {
    if (typeof patch.master === 'number') {
      masterVolume = Math.max(0, Math.min(1, patch.master));
      if (refs.masterGain) {
        refs.masterGain.gain.value = masterVolume;
      }
    }
  },
  play: playSound,
};

if (typeof window !== 'undefined') {
  (window as unknown as { fx: AudioApi }).fx = fx;
}

/** Test-only: reset internal state (для unit tests). */
export function _resetAudioForTest(): void {
  muted = false;
  ctx = null;
  refs.masterGain = null;
  refs.dryBus = null;
  refs.wetBus = null;
  masterVolume = 0.5;
  try { window?.localStorage?.removeItem(MUTE_STORAGE_KEY); } catch { /* */ }
}
