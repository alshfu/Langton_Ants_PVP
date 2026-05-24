// src/lib/audio.ts
//
// WebAudio FX — заглушка для будущей реализации.
// Контракт API: см. backend audio.js (master/music/sfx/ui каналы).

export interface AudioApi {
  setMuted: (v: boolean) => void;
  isMuted: () => boolean;
  setVolume: (patch: { master?: number; music?: number; sfx?: number; ui?: number }) => void;
  play: (soundId: string) => void;
}

let muted = false;

export const fx: AudioApi = {
  setMuted: (v) => { muted = v; },
  isMuted:  () => muted,
  setVolume: () => { /* TODO */ },
  play: () => { /* TODO: WebAudio synth */ },
};

if (typeof window !== 'undefined') {
  (window as unknown as { fx: AudioApi }).fx = fx;
}
