// src/lib/audio.test.ts
//
// Stage 8 Day 18: тесты для WebAudio fx модуля.
//
// jsdom не имеет AudioContext, так что мы:
// 1. Тестируем mute toggle + localStorage persistence — pure logic
// 2. Тестируем что play() не падает когда WebAudio недоступно (SSR-safe)
// 3. Тестируем что setMuted блокирует subsequent play() calls

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fx, _resetAudioForTest,
  getVolumes, getMusicEffectiveGain, subscribeVolumeChanges,
} from './audio';

describe('audio fx — mute toggle', () => {
  beforeEach(() => {
    _resetAudioForTest();
  });

  it('default not muted', () => {
    expect(fx.isMuted()).toBe(false);
  });

  it('setMuted true → isMuted reports true', () => {
    fx.setMuted(true);
    expect(fx.isMuted()).toBe(true);
  });

  it('setMuted false → isMuted reports false', () => {
    fx.setMuted(true);
    fx.setMuted(false);
    expect(fx.isMuted()).toBe(false);
  });

  it('mute state persists in localStorage', () => {
    fx.setMuted(true);
    expect(window.localStorage.getItem('langton.audio.muted')).toBe('1');
    fx.setMuted(false);
    expect(window.localStorage.getItem('langton.audio.muted')).toBe('0');
  });
});

describe('audio fx — play() SSR / no-audio safety', () => {
  beforeEach(() => {
    _resetAudioForTest();
  });

  it('does not throw when AudioContext is unavailable (jsdom)', () => {
    // jsdom не предоставляет AudioContext — getCtx() вернёт null,
    // playSound должен early-return без exception.
    expect(() => fx.play('countdown_beep')).not.toThrow();
    expect(() => fx.play('countdown_go')).not.toThrow();
    expect(() => fx.play('deploy')).not.toThrow();
    expect(() => fx.play('victory')).not.toThrow();
    expect(() => fx.play('defeat')).not.toThrow();
    expect(() => fx.play('tie')).not.toThrow();
    expect(() => fx.play('ui_click')).not.toThrow();
  });

  it('does not throw when muted', () => {
    fx.setMuted(true);
    expect(() => fx.play('countdown_beep')).not.toThrow();
    expect(() => fx.play('victory')).not.toThrow();
  });

  it('setVolume does not throw without AudioContext', () => {
    expect(() => fx.setVolume({ master: 0.8 })).not.toThrow();
    expect(() => fx.setVolume({ master: 0, sfx: 0.5 })).not.toThrow();
  });

  it('setVolume clamps master to [0, 1]', () => {
    // Не падает на out-of-range. Внутренний state не expose'ится напрямую,
    // но повторный call с valid value должен работать.
    expect(() => fx.setVolume({ master: -1 })).not.toThrow();
    expect(() => fx.setVolume({ master: 99 })).not.toThrow();
    expect(() => fx.setVolume({ master: 0.5 })).not.toThrow();
  });
});

/**
 * Day 21: mock factory с полным API surface (для layered synthesis):
 * createOscillator, createGain, createConvolver, createBuffer,
 * createBufferSource, createBiquadFilter.
 */
function makeMockAudioContext(): {
  ctx: object;
  oscStart: ReturnType<typeof vi.fn>;
  oscStop: ReturnType<typeof vi.fn>;
  bufferSourceStart: ReturnType<typeof vi.fn>;
  bufferSourceStop: ReturnType<typeof vi.fn>;
} {
  const oscStart = vi.fn();
  const oscStop = vi.fn();
  const bufferSourceStart = vi.fn();
  const bufferSourceStop = vi.fn();
  const ctx = {
    currentTime: 0,
    state: 'running',
    sampleRate: 44100,
    destination: { connect: vi.fn() },
    createOscillator: () => ({
      type: 'sine',
      frequency: {
        value: 0,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: oscStart,
      stop: oscStop,
    }),
    createGain: () => ({
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }),
    createConvolver: () => ({
      buffer: null,
      connect: vi.fn(),
    }),
    createBuffer: (channels: number, length: number, _sr: number) => ({
      getChannelData: (_ch: number) => new Float32Array(length),
      numberOfChannels: channels,
      length,
    }),
    createBufferSource: () => ({
      buffer: null,
      connect: vi.fn(),
      start: bufferSourceStart,
      stop: bufferSourceStop,
    }),
    createBiquadFilter: () => ({
      type: 'highpass',
      frequency: { value: 0 },
      Q: { value: 0 },
      connect: vi.fn(),
    }),
    resume: () => Promise.resolve(),
  };
  return { ctx, oscStart, oscStop, bufferSourceStart, bufferSourceStop };
}

describe('audio fx — WebAudio mock smoke (Day 21 layered synthesis)', () => {
  beforeEach(() => {
    _resetAudioForTest();
  });

  it('deploy creates layered sound (body osc + transient osc + noise burst)', () => {
    const { ctx, oscStart, bufferSourceStart } = makeMockAudioContext();
    const MockCtx = vi.fn(() => ctx);
    const w = window as unknown as { AudioContext: typeof AudioContext };
    const prevCtx = w.AudioContext;
    w.AudioContext = MockCtx as unknown as typeof AudioContext;

    try {
      fx.play('deploy');
      expect(oscStart).toHaveBeenCalledTimes(2);
      expect(bufferSourceStart).toHaveBeenCalledTimes(1);
    } finally {
      if (prevCtx) w.AudioContext = prevCtx;
      else delete (w as unknown as { AudioContext?: unknown }).AudioContext;
    }
  });

  it('countdown_go is cinematic burst (multiple osc + noise)', () => {
    const { ctx, oscStart, bufferSourceStart } = makeMockAudioContext();
    const MockCtx = vi.fn(() => ctx);
    const w = window as unknown as { AudioContext: typeof AudioContext };
    const prevCtx = w.AudioContext;
    w.AudioContext = MockCtx as unknown as typeof AudioContext;

    try {
      fx.play('countdown_go');
      // Sub + Mid (2) + Highs (2) = 5 oscillators + 1 noise burst
      expect(oscStart.mock.calls.length).toBeGreaterThanOrEqual(5);
      expect(bufferSourceStart).toHaveBeenCalledTimes(1);
    } finally {
      if (prevCtx) w.AudioContext = prevCtx;
      else delete (w as unknown as { AudioContext?: unknown }).AudioContext;
    }
  });

  it('victory is multi-layered fanfare (13+ osc для 5 нот × 2-3 слоя + final chord)', () => {
    const { ctx, oscStart } = makeMockAudioContext();
    const MockCtx = vi.fn(() => ctx);
    const w = window as unknown as { AudioContext: typeof AudioContext };
    const prevCtx = w.AudioContext;
    w.AudioContext = MockCtx as unknown as typeof AudioContext;

    try {
      fx.play('victory');
      // 5 нот × (lead + sub) = 10, + 3 верхних с octave-up = 13, + final chord (3) = 16
      expect(oscStart.mock.calls.length).toBeGreaterThanOrEqual(13);
    } finally {
      if (prevCtx) w.AudioContext = prevCtx;
      else delete (w as unknown as { AudioContext?: unknown }).AudioContext;
    }
  });

  it('tie uses FM bell synthesis (carrier + modulator pairs)', () => {
    const { ctx, oscStart } = makeMockAudioContext();
    const MockCtx = vi.fn(() => ctx);
    const w = window as unknown as { AudioContext: typeof AudioContext };
    const prevCtx = w.AudioContext;
    w.AudioContext = MockCtx as unknown as typeof AudioContext;

    try {
      fx.play('tie');
      // 2 fmBell calls × 2 osc each + 1 sub = 5 osc
      expect(oscStart.mock.calls.length).toBeGreaterThanOrEqual(5);
    } finally {
      if (prevCtx) w.AudioContext = prevCtx;
      else delete (w as unknown as { AudioContext?: unknown }).AudioContext;
    }
  });

  it('muted prevents any synthesis (no osc, no noise)', () => {
    const { ctx, oscStart, bufferSourceStart } = makeMockAudioContext();
    const MockCtx = vi.fn(() => ctx);
    const w = window as unknown as { AudioContext: typeof AudioContext };
    const prevCtx = w.AudioContext;
    w.AudioContext = MockCtx as unknown as typeof AudioContext;

    try {
      fx.setMuted(true);
      fx.play('victory');
      fx.play('countdown_go');
      fx.play('deploy');
      expect(oscStart).not.toHaveBeenCalled();
      expect(bufferSourceStart).not.toHaveBeenCalled();
    } finally {
      if (prevCtx) w.AudioContext = prevCtx;
      else delete (w as unknown as { AudioContext?: unknown }).AudioContext;
    }
  });

  it('ui_click (Day 22) — light tap, 2 osc, no noise burst, dry only', () => {
    const { ctx, oscStart, bufferSourceStart } = makeMockAudioContext();
    const MockCtx = vi.fn(() => ctx);
    const w = window as unknown as { AudioContext: typeof AudioContext };
    const prevCtx = w.AudioContext;
    w.AudioContext = MockCtx as unknown as typeof AudioContext;

    try {
      fx.play('ui_click');
      // sine click + square transient = 2 osc, без noise
      expect(oscStart).toHaveBeenCalledTimes(2);
      expect(bufferSourceStart).not.toHaveBeenCalled();
    } finally {
      if (prevCtx) w.AudioContext = prevCtx;
      else delete (w as unknown as { AudioContext?: unknown }).AudioContext;
    }
  });
});

describe('audio fx — Day 26 volume channels', () => {
  beforeEach(() => {
    _resetAudioForTest();
  });

  it('defaults: master 0.7, music 0.6, sfx 0.8', () => {
    const v = getVolumes();
    expect(v.master).toBe(0.7);
    expect(v.music).toBe(0.6);
    expect(v.sfx).toBe(0.8);
  });

  it('setVolume merges patches не задевая other channels', () => {
    fx.setVolume({ master: 0.5 });
    expect(getVolumes().master).toBe(0.5);
    expect(getVolumes().music).toBe(0.6);
    expect(getVolumes().sfx).toBe(0.8);
    fx.setVolume({ music: 0.3, sfx: 0.9 });
    expect(getVolumes()).toEqual({ master: 0.5, music: 0.3, sfx: 0.9 });
  });

  it('setVolume clamps each channel to [0, 1]', () => {
    fx.setVolume({ master: -1, music: 2, sfx: 0.5 });
    expect(getVolumes()).toEqual({ master: 0, music: 1, sfx: 0.5 });
  });

  it('volumes persist в localStorage', () => {
    fx.setVolume({ master: 0.42, music: 0.13, sfx: 0.77 });
    expect(window.localStorage.getItem('langton.audio.vol.master')).toBe('0.42');
    expect(window.localStorage.getItem('langton.audio.vol.music')).toBe('0.13');
    expect(window.localStorage.getItem('langton.audio.vol.sfx')).toBe('0.77');
  });

  it('getMusicEffectiveGain = master × music когда не muted', () => {
    fx.setVolume({ master: 0.5, music: 0.4 });
    expect(getMusicEffectiveGain()).toBeCloseTo(0.20, 5);
  });

  it('getMusicEffectiveGain = 0 когда muted (даже при ненулевых volumes)', () => {
    fx.setVolume({ master: 1, music: 1 });
    fx.setMuted(true);
    expect(getMusicEffectiveGain()).toBe(0);
  });

  it('subscribeVolumeChanges вызывается на setVolume', () => {
    const fn = vi.fn();
    const unsubscribe = subscribeVolumeChanges(fn);
    fx.setVolume({ master: 0.3 });
    expect(fn).toHaveBeenCalledTimes(1);
    fx.setVolume({ music: 0.2 });
    expect(fn).toHaveBeenCalledTimes(2);
    unsubscribe();
    fx.setVolume({ sfx: 0.1 });
    expect(fn).toHaveBeenCalledTimes(2); // не вызывается после unsubscribe
  });

  it('subscribeVolumeChanges вызывается на setMuted', () => {
    const fn = vi.fn();
    subscribeVolumeChanges(fn);
    fx.setMuted(true);
    expect(fn).toHaveBeenCalledTimes(1);
    fx.setMuted(false);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('один listener throw не валит остальных', () => {
    const good = vi.fn();
    const bad = vi.fn(() => { throw new Error('bad listener'); });
    subscribeVolumeChanges(bad);
    subscribeVolumeChanges(good);
    expect(() => fx.setVolume({ master: 0.1 })).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
  });

  it('после reset: defaults + empty localStorage', () => {
    fx.setVolume({ master: 0.1, music: 0.2, sfx: 0.3 });
    _resetAudioForTest();
    expect(getVolumes()).toEqual({ master: 0.7, music: 0.6, sfx: 0.8 });
    expect(window.localStorage.getItem('langton.audio.vol.master')).toBeNull();
  });
});
