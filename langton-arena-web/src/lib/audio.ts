// src/lib/audio.ts
//
// Stage 8 Day 18: реальная WebAudio FX реализация.
//
// Все звуки синтезируются процедурно через oscillators + envelope —
// нет .mp3/.wav ассетов, нет network round-trip, bundle не растёт.
//
// AudioContext создаётся лениво на первом play() — это нужно потому что
// браузеры (Chrome/Safari) блокируют autoplay до первого user gesture.
// Если play() вызван до user gesture — AudioContext будет в "suspended"
// state и резюмируется автоматически когда пользователь кликнет
// что-нибудь (например Ready в lobby).
//
// Mute toggle персистится в localStorage под `langton.audio.muted`.
// Контракт совместим со старым stub (fx.setMuted/isMuted/play).

export interface AudioApi {
  setMuted: (v: boolean) => void;
  isMuted: () => boolean;
  setVolume: (patch: { master?: number; music?: number; sfx?: number; ui?: number }) => void;
  play: (soundId: SoundId) => void;
}

export type SoundId =
  | 'countdown_beep'   // 3, 2, 1 — короткий ровный 660Hz beep
  | 'countdown_go'     // GO! — outsized 880Hz triangle
  | 'deploy'           // tap-to-deploy click feedback
  | 'victory'          // major C-E-G arpeggio
  | 'defeat'           // descending minor E-C
  | 'tie';             // single 440Hz tone

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
const masterGainRef: { current: GainNode | null } = { current: null };
let masterVolume = 0.5;

/** Lazy-create AudioContext. Returns null если WebAudio недоступно (SSR / old browser). */
function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const AC = W.AudioContext ?? W.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    masterGainRef.current = ctx.createGain();
    masterGainRef.current.gain.value = masterVolume;
    masterGainRef.current.connect(ctx.destination);
  } catch { return null; }
  // Если context suspended (до user gesture) — попробуем resume на каждом
  // call play(). resume() возвращает Promise который мы игнорируем —
  // если оно не зарезюмировалось, sound будет тихий, но не упадёт.
  return ctx;
}

/** ADSR envelope: attack → sustain → exponential decay. */
function envelope(
  c: AudioContext,
  destination: AudioNode,
  startTime: number,
  attack: number,
  sustain: number,
  decay: number,
  peakGain: number,
): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.00001, startTime);
  g.gain.exponentialRampToValueAtTime(peakGain, startTime + attack);
  g.gain.setValueAtTime(peakGain, startTime + attack + sustain);
  g.gain.exponentialRampToValueAtTime(0.00001, startTime + attack + sustain + decay);
  g.connect(destination);
  return g;
}

function tone(
  c: AudioContext,
  freq: number,
  type: OscillatorType,
  startTime: number,
  duration: number,
  peakGain: number,
  destination: AudioNode,
): void {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const attack = Math.min(0.005, duration * 0.1);
  const decay = Math.min(0.08, duration * 0.6);
  const sustain = Math.max(0, duration - attack - decay);
  const env = envelope(c, destination, startTime, attack, sustain, decay, peakGain);
  osc.connect(env);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

function playSound(id: SoundId): void {
  if (muted) return;
  const c = getCtx();
  if (!c || !masterGainRef.current) return;
  if (c.state === 'suspended') {
    // Fire-and-forget resume — если до user gesture, не сработает,
    // первый play будет тихим, второй уже громким (после Ready click).
    void c.resume().catch(() => {});
  }
  const dest = masterGainRef.current;
  const now = c.currentTime;
  switch (id) {
    case 'countdown_beep':
      tone(c, 660, 'sine', now, 0.10, 0.5, dest);
      break;
    case 'countdown_go':
      // Двойной hit для драматизма: 880 + 1320 (octave + fifth) триадой
      tone(c, 880, 'triangle', now,        0.25, 0.55, dest);
      tone(c, 1320, 'triangle', now + 0.04, 0.20, 0.35, dest);
      break;
    case 'deploy':
      // Короткий click: sharp square wave, чуть нисходящая частота
      tone(c, 1400, 'square', now,         0.025, 0.18, dest);
      tone(c, 800,  'square', now + 0.015, 0.030, 0.10, dest);
      break;
    case 'victory': {
      // C-E-G arpeggio в octave 5 (523/659/784 Hz)
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        const start = now + i * 0.12;
        tone(c, freq, 'triangle', start, 0.32, 0.45, dest);
      });
      break;
    }
    case 'defeat': {
      // E5 → C5 → A4 descending minor triad
      const notes = [659.25, 523.25, 440.00];
      notes.forEach((freq, i) => {
        const start = now + i * 0.16;
        tone(c, freq, 'sine', start, 0.35, 0.30, dest);
      });
      break;
    }
    case 'tie':
      // Нейтральный 440Hz короткий тон
      tone(c, 440, 'sine', now, 0.40, 0.30, dest);
      break;
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
      if (masterGainRef.current) {
        masterGainRef.current.gain.value = masterVolume;
      }
    }
    // music/sfx/ui channels пока не разделены — Stage 9 при необходимости.
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
  masterGainRef.current = null;
  masterVolume = 0.5;
  try { window?.localStorage?.removeItem(MUTE_STORAGE_KEY); } catch { /* */ }
}
