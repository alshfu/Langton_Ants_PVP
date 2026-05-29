// src/lib/music.ts
//
// Stage 8 Day 25: dynamic gameplay music — Geometry Dash style.
//
// Архитектура (4 layer'а):
//   1. Bass    — A minor pentatonic walking line, всегда играет в gameplay
//   2. Pad     — sustained chord progression Am→F→C→G, всегда играет soft
//   3. Drums   — kick + hihat + snare, входят по intensity
//   4. Lead    — мелодический motif, играет на high intensity
//
// Scheduler использует AudioContext.currentTime + lookahead (100ms ahead)
// чтобы избежать GC jitter. Cycle scheduler работает каждые 25ms через
// setInterval — это canonical Web Audio scheduling pattern (см. Chris
// Wilson "A Tale of Two Clocks", 2013).
//
// Dynamic API:
//   start() / stop()      — start/stop loop
//   setIntensity(0..1)    — управляет drum + lead layer gains
//   setMood(neutral|winning|losing) — меняет гармонию (chord choice + bass)
//
// Tempo: 120 BPM (0.5s per beat). Phrase: 32 sixteenth notes = 4 seconds.
//
// Уважаем audio.ts mute toggle — если fx.isMuted() → music тоже muted.

import { fx, getMusicEffectiveGain, subscribeVolumeChanges } from './audio';

export type MusicMood = 'neutral' | 'winning' | 'losing';

// ─── Constants ───────────────────────────────────────────────────────────────

const BPM = 120;
const STEPS_PER_BEAT = 4;                          // 16th notes
const STEP_DURATION_SEC = 60 / BPM / STEPS_PER_BEAT;  // 0.125s
const PHRASE_STEPS = 32;                           // 2 bars × 16 steps
const SCHEDULE_AHEAD_SEC = 0.1;                    // 100ms lookahead
const SCHEDULER_INTERVAL_MS = 25;

/** Step indices когда играет bass note (steps 0, 4, 8, 12, ...) — на каждый beat. */
const BASS_STEPS = [0, 4, 8, 12, 16, 20, 24, 28];

/** Step indices для kick — beats 1 и 3 of каждого bar (heavy beats). */
const KICK_STEPS = [0, 8, 16, 24];

/** Snare — beats 2 и 4 (off-heavy beats). */
const SNARE_STEPS = [4, 12, 20, 28];

/** Hi-hat — все 8th notes (every other 16th). */
const HIHAT_STEPS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];

/** Lead motif — короткий melodic phrase запускается раз в phrase. */
const LEAD_MOTIF: Array<{ step: number; semitoneFromRoot: number }> = [
  { step: 24, semitoneFromRoot: 0 },   // root
  { step: 26, semitoneFromRoot: 3 },   // minor 3rd
  { step: 28, semitoneFromRoot: 7 },   // perfect 5th
  { step: 30, semitoneFromRoot: 12 },  // octave
];

/**
 * Bass + pad по mood. Все ноты как frequencies.
 * neutral = Am progression (i-iv-VI-VII): Am-Dm-F-G
 * winning = brighter Am7-F-C-G (major 7 colour + major chords)
 * losing  = Am-Dm-Bdim7-E7 (darker, более dramatic)
 *
 * Phrase = 32 steps = 4 chord segments по 8 steps каждый.
 */
interface ChordSegment {
  bassNote: number;       // Hz
  chordFreqs: number[];   // Hz, voiced triad/4-note
  leadRootHz: number;     // for melody motif
}

const PROGRESSIONS: Record<MusicMood, ChordSegment[]> = {
  neutral: [
    // i: Am
    { bassNote: 110.00, chordFreqs: [220.00, 261.63, 329.63], leadRootHz: 440.00 },
    // iv: Dm
    { bassNote: 146.83, chordFreqs: [220.00, 293.66, 349.23], leadRootHz: 587.33 },
    // VI: F
    { bassNote:  87.31, chordFreqs: [174.61, 220.00, 261.63], leadRootHz: 349.23 },
    // VII: G
    { bassNote:  98.00, chordFreqs: [196.00, 246.94, 293.66], leadRootHz: 392.00 },
  ],
  winning: [
    // i7: Am7 (brighter)
    { bassNote: 110.00, chordFreqs: [220.00, 261.63, 329.63, 392.00], leadRootHz: 440.00 },
    // IV: F (major)
    { bassNote:  87.31, chordFreqs: [174.61, 220.00, 261.63], leadRootHz: 349.23 },
    // V: G
    { bassNote:  98.00, chordFreqs: [196.00, 246.94, 293.66], leadRootHz: 392.00 },
    // VI: C (resolution-ish)
    { bassNote: 130.81, chordFreqs: [261.63, 329.63, 392.00], leadRootHz: 523.25 },
  ],
  losing: [
    // i: Am
    { bassNote: 110.00, chordFreqs: [220.00, 261.63, 329.63], leadRootHz: 440.00 },
    // iv: Dm (down)
    { bassNote: 146.83, chordFreqs: [220.00, 293.66, 349.23], leadRootHz: 587.33 },
    // ii°: Bdim (dark)
    { bassNote: 123.47, chordFreqs: [246.94, 293.66, 349.23], leadRootHz: 493.88 },
    // V: E7 (dramatic)
    { bassNote:  82.41, chordFreqs: [164.81, 207.65, 246.94, 293.66], leadRootHz: 329.63 },
  ],
};

// ─── Pure helpers (testable) ─────────────────────────────────────────────────

/**
 * Compute список step events чтобы schedule вперёд от currentTime.
 * Pure function — testable без AudioContext.
 *
 * Returns: { step, time } pairs для всех ступеней которые попадают в окно
 * [nextScheduleTime, currentTime + scheduleAheadSec).
 *
 * Caller обновит nextScheduleTime и currentStep.
 */
export function computeStepsToSchedule(
  currentTime: number,
  nextScheduleTime: number,
  currentStep: number,
  scheduleAheadSec: number = SCHEDULE_AHEAD_SEC,
  stepDuration: number = STEP_DURATION_SEC,
  loopLength: number = PHRASE_STEPS,
): { events: Array<{ step: number; time: number }>; newNextTime: number; newStep: number } {
  const events: Array<{ step: number; time: number }> = [];
  let t = nextScheduleTime;
  let s = currentStep;
  const horizon = currentTime + scheduleAheadSec;
  while (t < horizon) {
    events.push({ step: s, time: t });
    t += stepDuration;
    s = (s + 1) % loopLength;
  }
  return { events, newNextTime: t, newStep: s };
}

/** Возвращает текущий chord segment index (0..3) для phrase step. */
export function chordIndexAtStep(step: number): number {
  // 8 steps per segment, 4 segments per phrase
  return Math.floor((step % PHRASE_STEPS) / 8);
}

/** Какой mood from territory delta — pure helper для caller. */
export function moodFromDelta(myShare: number, oppShare: number, threshold = 4): MusicMood {
  const delta = myShare - oppShare;
  if (delta > threshold) return 'winning';
  if (delta < -threshold) return 'losing';
  return 'neutral';
}

/** Clamp 0..1. */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// ─── MusicEngine ─────────────────────────────────────────────────────────────

export class MusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bassBus: GainNode | null = null;
  private padBus: GainNode | null = null;
  private drumBus: GainNode | null = null;
  private leadBus: GainNode | null = null;

  private isRunning = false;
  private intensity = 0;
  private mood: MusicMood = 'neutral';

  private nextStepTime = 0;
  private currentStep = 0;
  private schedulerHandle: ReturnType<typeof setInterval> | null = null;
  // Day 26: unsubscribe из volume changes — called в stop().
  private volumeUnsubscribe: (() => void) | null = null;

  /** Lazy create AudioContext + bus topology. Возвращает true если success. */
  private ensureContext(): boolean {
    if (this.ctx) return true;
    if (typeof window === 'undefined') return false;
    const W = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const AC = W.AudioContext ?? W.webkitAudioContext;
    if (!AC) return false;
    try {
      const c = new AC();
      this.ctx = c;
      this.masterGain = c.createGain();
      // Day 26: master = 0.55 × effective music gain (master × music из fx).
      this.masterGain.gain.value = 0.55 * getMusicEffectiveGain();
      this.masterGain.connect(c.destination);

      // Bus per layer (independent gain stages для smooth intensity transitions)
      this.bassBus = c.createGain();
      this.bassBus.gain.value = 0.55;
      this.bassBus.connect(this.masterGain);

      this.padBus = c.createGain();
      this.padBus.gain.value = 0.30;
      this.padBus.connect(this.masterGain);

      this.drumBus = c.createGain();
      this.drumBus.gain.value = 0;  // controlled by intensity
      this.drumBus.connect(this.masterGain);

      this.leadBus = c.createGain();
      this.leadBus.gain.value = 0;  // controlled by intensity
      this.leadBus.connect(this.masterGain);
    } catch { return false; }
    return true;
  }

  /** Start the loop. No-op if already running. */
  start(): void {
    if (this.isRunning) return;
    if (!this.ensureContext()) return;
    const c = this.ctx!;
    if (c.state === 'suspended') {
      void c.resume().catch(() => {});
    }
    this.isRunning = true;
    this.currentStep = 0;
    this.nextStepTime = c.currentTime + 0.05; // tiny offset чтобы первое событие в будущем
    this.schedulerHandle = setInterval(() => this.tick(), SCHEDULER_INTERVAL_MS);
    // Day 26: подписываемся на volume changes
    if (!this.volumeUnsubscribe) {
      this.volumeUnsubscribe = subscribeVolumeChanges(() => this.applyVolume());
    }
  }

  /** Day 26: re-apply effective master gain на change. Linear ramp 150ms. */
  private applyVolume(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const target = 0.55 * getMusicEffectiveGain();
    try {
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(target, now + 0.15);
    } catch { /* */ }
  }

  /** Stop the loop + cancel scheduled notes via clearing oscillators (they auto-stop). */
  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.schedulerHandle != null) {
      clearInterval(this.schedulerHandle);
      this.schedulerHandle = null;
    }
    // Day 26: unsubscribe из volume changes
    if (this.volumeUnsubscribe) {
      this.volumeUnsubscribe();
      this.volumeUnsubscribe = null;
    }
    // Уже scheduled осcillator'ы доиграют свои короткие envelope'ы — это OK.
    // Долгий pad может звучать ещё ~1 секунду — приемлемо как fade-out.
  }

  /** Set intensity 0..1 — управляет drum и lead bus gains через ramp. */
  setIntensity(v: number): void {
    this.intensity = clamp01(v);
    if (!this.ctx || !this.drumBus || !this.leadBus) return;
    const now = this.ctx.currentTime;
    // Smooth ramp 200ms чтобы не было щелчков
    // Drums начинают слышаться от intensity > 0.15, full при 0.8
    const drumGain = Math.max(0, (this.intensity - 0.15) / 0.65) * 0.35;
    // Lead — от intensity > 0.6, full при 1.0
    const leadGain = Math.max(0, (this.intensity - 0.6) / 0.4) * 0.30;
    try {
      this.drumBus.gain.cancelScheduledValues(now);
      this.drumBus.gain.linearRampToValueAtTime(drumGain, now + 0.2);
      this.leadBus.gain.cancelScheduledValues(now);
      this.leadBus.gain.linearRampToValueAtTime(leadGain, now + 0.2);
    } catch { /* */ }
  }

  setMood(m: MusicMood): void {
    this.mood = m;
  }

  /** Test/debug accessors. */
  getIntensity(): number { return this.intensity; }
  getMood(): MusicMood { return this.mood; }
  isPlaying(): boolean { return this.isRunning; }

  private tick(): void {
    if (!this.isRunning || !this.ctx) return;
    if (fx.isMuted()) {
      // Если muted — продвигаем clock но не шедулим звуки
      const now = this.ctx.currentTime;
      while (this.nextStepTime < now + SCHEDULE_AHEAD_SEC) {
        this.nextStepTime += STEP_DURATION_SEC;
        this.currentStep = (this.currentStep + 1) % PHRASE_STEPS;
      }
      return;
    }
    const now = this.ctx.currentTime;
    const { events, newNextTime, newStep } = computeStepsToSchedule(
      now, this.nextStepTime, this.currentStep,
    );
    for (const ev of events) this.scheduleStep(ev.step, ev.time);
    this.nextStepTime = newNextTime;
    this.currentStep = newStep;
  }

  private scheduleStep(step: number, time: number): void {
    const segIdx = chordIndexAtStep(step);
    const seg = PROGRESSIONS[this.mood]![segIdx]!;

    // Bass: на BASS_STEPS играем root note сегмента
    if (BASS_STEPS.includes(step)) {
      this.playBass(seg.bassNote, time);
    }

    // Pad: на step 0 каждого segment'а играем chord (длинный sustain)
    if (step % 8 === 0) {
      for (const f of seg.chordFreqs) this.playPad(f, time);
    }

    // Drums: kick / snare / hihat по indexes (всегда планируем, gain в drumBus)
    if (KICK_STEPS.includes(step)) this.playKick(time);
    if (SNARE_STEPS.includes(step)) this.playSnare(time);
    if (HIHAT_STEPS.includes(step)) this.playHiHat(time);

    // Lead motif: на high intensity sometimes
    for (const note of LEAD_MOTIF) {
      if (note.step === step) {
        const freq = seg.leadRootHz * Math.pow(2, note.semitoneFromRoot / 12);
        this.playLead(freq, time);
      }
    }
  }

  // ─── Voice synthesis ───────────────────────────────────────────────────────

  private playBass(freq: number, time: number): void {
    const c = this.ctx!;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    // Low-pass filter для warmth
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = freq * 4;
    lp.Q.value = 1.5;
    const env = c.createGain();
    env.gain.setValueAtTime(0.00001, time);
    env.gain.exponentialRampToValueAtTime(0.7, time + 0.005);
    env.gain.exponentialRampToValueAtTime(0.00001, time + 0.25);
    osc.connect(lp).connect(env).connect(this.bassBus!);
    osc.start(time);
    osc.stop(time + 0.3);
  }

  private playPad(freq: number, time: number): void {
    const c = this.ctx!;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const env = c.createGain();
    env.gain.setValueAtTime(0.00001, time);
    env.gain.exponentialRampToValueAtTime(0.25, time + 0.3);
    env.gain.setValueAtTime(0.25, time + 0.6);
    env.gain.exponentialRampToValueAtTime(0.00001, time + 1.5);
    osc.connect(env).connect(this.padBus!);
    osc.start(time);
    osc.stop(time + 1.6);
  }

  private playKick(time: number): void {
    const c = this.ctx!;
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
    const env = c.createGain();
    env.gain.setValueAtTime(0.00001, time);
    env.gain.exponentialRampToValueAtTime(0.9, time + 0.005);
    env.gain.exponentialRampToValueAtTime(0.00001, time + 0.16);
    osc.connect(env).connect(this.drumBus!);
    osc.start(time);
    osc.stop(time + 0.18);
  }

  private playSnare(time: number): void {
    const c = this.ctx!;
    // Snare = body tone (200Hz) + noise burst через bandpass
    const tone = c.createOscillator();
    tone.type = 'triangle';
    tone.frequency.value = 200;
    const toneEnv = c.createGain();
    toneEnv.gain.setValueAtTime(0.00001, time);
    toneEnv.gain.exponentialRampToValueAtTime(0.3, time + 0.003);
    toneEnv.gain.exponentialRampToValueAtTime(0.00001, time + 0.08);
    tone.connect(toneEnv).connect(this.drumBus!);
    tone.start(time);
    tone.stop(time + 0.1);
    // Noise burst
    const buf = c.createBuffer(1, c.sampleRate * 0.08, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = c.createBufferSource();
    noise.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2000;
    bp.Q.value = 0.7;
    const noiseEnv = c.createGain();
    noiseEnv.gain.setValueAtTime(0.00001, time);
    noiseEnv.gain.exponentialRampToValueAtTime(0.45, time + 0.002);
    noiseEnv.gain.exponentialRampToValueAtTime(0.00001, time + 0.08);
    noise.connect(bp).connect(noiseEnv).connect(this.drumBus!);
    noise.start(time);
    noise.stop(time + 0.09);
  }

  private playHiHat(time: number): void {
    const c = this.ctx!;
    const buf = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const env = c.createGain();
    env.gain.setValueAtTime(0.00001, time);
    env.gain.exponentialRampToValueAtTime(0.18, time + 0.001);
    env.gain.exponentialRampToValueAtTime(0.00001, time + 0.04);
    src.connect(hp).connect(env).connect(this.drumBus!);
    src.start(time);
    src.stop(time + 0.05);
  }

  private playLead(freq: number, time: number): void {
    const c = this.ctx!;
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    // Detuned octave-up для chiptune feel
    const osc2 = c.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = freq * 2;
    const env = c.createGain();
    env.gain.setValueAtTime(0.00001, time);
    env.gain.exponentialRampToValueAtTime(0.4, time + 0.005);
    env.gain.exponentialRampToValueAtTime(0.00001, time + 0.18);
    osc.connect(env);
    osc2.connect(env);
    env.connect(this.leadBus!);
    osc.start(time);
    osc2.start(time);
    osc.stop(time + 0.2);
    osc2.stop(time + 0.2);
  }
}

/** Singleton — один MusicEngine на приложение. */
export const music = new MusicEngine();
