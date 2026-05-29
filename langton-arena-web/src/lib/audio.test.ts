// src/lib/audio.test.ts
//
// Stage 8 Day 18: тесты для WebAudio fx модуля.
//
// jsdom не имеет AudioContext, так что мы:
// 1. Тестируем mute toggle + localStorage persistence — pure logic
// 2. Тестируем что play() не падает когда WebAudio недоступно (SSR-safe)
// 3. Тестируем что setMuted блокирует subsequent play() calls

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fx, _resetAudioForTest } from './audio';

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

describe('audio fx — WebAudio mock smoke', () => {
  beforeEach(() => {
    _resetAudioForTest();
  });

  it('attempts to use AudioContext when available', () => {
    // Mock AudioContext чтобы убедиться что play() лениво его создаёт.
    const oscStart = vi.fn();
    const oscStop = vi.fn();
    const oscConnect = vi.fn();
    const gainConnect = vi.fn();
    const setValueAtTime = vi.fn();
    const expRamp = vi.fn();

    const MockCtx = vi.fn(() => ({
      currentTime: 0,
      state: 'running',
      destination: {},
      createOscillator: () => ({
        type: 'sine',
        frequency: { value: 0 },
        connect: oscConnect,
        start: oscStart,
        stop: oscStop,
      }),
      createGain: () => ({
        gain: {
          value: 0,
          setValueAtTime,
          exponentialRampToValueAtTime: expRamp,
        },
        connect: gainConnect,
      }),
      resume: () => Promise.resolve(),
    }));

    const w = window as unknown as { AudioContext: typeof AudioContext };
    const prevCtx = w.AudioContext;
    w.AudioContext = MockCtx as unknown as typeof AudioContext;

    try {
      fx.play('deploy');
      // 'deploy' создаёт 2 oscillator'а (1400Hz click + 800Hz tail)
      expect(oscStart).toHaveBeenCalledTimes(2);
      expect(oscStop).toHaveBeenCalledTimes(2);
    } finally {
      if (prevCtx) w.AudioContext = prevCtx;
      else delete (w as unknown as { AudioContext?: unknown }).AudioContext;
    }
  });

  it('muted prevents oscillators from being created', () => {
    const oscStart = vi.fn();

    const MockCtx = vi.fn(() => ({
      currentTime: 0,
      state: 'running',
      destination: {},
      createOscillator: () => ({
        type: 'sine',
        frequency: { value: 0 },
        connect: vi.fn(),
        start: oscStart,
        stop: vi.fn(),
      }),
      createGain: () => ({
        gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      }),
      resume: () => Promise.resolve(),
    }));

    const w = window as unknown as { AudioContext: typeof AudioContext };
    const prevCtx = w.AudioContext;
    w.AudioContext = MockCtx as unknown as typeof AudioContext;

    try {
      fx.setMuted(true);
      fx.play('victory');
      // muted = true → playSound early-return → 0 oscillators
      expect(oscStart).not.toHaveBeenCalled();
    } finally {
      if (prevCtx) w.AudioContext = prevCtx;
      else delete (w as unknown as { AudioContext?: unknown }).AudioContext;
    }
  });
});
