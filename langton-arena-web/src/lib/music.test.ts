// src/lib/music.test.ts
//
// Stage 8 Day 25: тесты для music engine.
//
// Тестируем pure helpers (computeStepsToSchedule, chordIndexAtStep,
// moodFromDelta) + smoke на MusicEngine class (start/stop/setIntensity
// без real AudioContext в jsdom).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MusicEngine, music,
  computeStepsToSchedule, chordIndexAtStep, moodFromDelta,
} from './music';

describe('computeStepsToSchedule', () => {
  it('пустое окно если nextScheduleTime > currentTime + ahead', () => {
    const r = computeStepsToSchedule(
      /*currentTime*/ 1.0,
      /*nextScheduleTime*/ 2.0,
      /*currentStep*/ 5,
      /*scheduleAheadSec*/ 0.1,
      /*stepDuration*/ 0.125,
      /*loopLength*/ 32,
    );
    expect(r.events).toEqual([]);
    expect(r.newNextTime).toBe(2.0);
    expect(r.newStep).toBe(5);
  });

  it('шедулит несколько event\'ов когда отстаём', () => {
    const r = computeStepsToSchedule(1.0, 0.5, 0, 0.1, 0.125, 32);
    // window [0.5, 1.1), step duration 0.125 → 5 events: 0.5, 0.625, 0.75, 0.875, 1.0
    expect(r.events.length).toBe(5);
    expect(r.events[0]).toEqual({ step: 0, time: 0.5 });
    expect(r.events[1]).toEqual({ step: 1, time: 0.625 });
    expect(r.events[4]).toEqual({ step: 4, time: 1.0 });
    expect(r.newStep).toBe(5);
    expect(r.newNextTime).toBeCloseTo(1.125, 3);
  });

  it('wraps around loop length', () => {
    const r = computeStepsToSchedule(0, 0, 30, 0.5, 0.125, 32);
    // 4 events scheduled. Steps: 30, 31, 0, 1
    expect(r.events.map(e => e.step)).toEqual([30, 31, 0, 1]);
    expect(r.newStep).toBe(2);
  });

  it('default parameters работают', () => {
    const r = computeStepsToSchedule(1.0, 0.5, 0);
    expect(r.events.length).toBeGreaterThan(0);
  });
});

describe('chordIndexAtStep', () => {
  it('steps 0-7 → segment 0', () => {
    expect(chordIndexAtStep(0)).toBe(0);
    expect(chordIndexAtStep(7)).toBe(0);
  });
  it('steps 8-15 → segment 1', () => {
    expect(chordIndexAtStep(8)).toBe(1);
    expect(chordIndexAtStep(15)).toBe(1);
  });
  it('steps 16-23 → segment 2', () => {
    expect(chordIndexAtStep(16)).toBe(2);
    expect(chordIndexAtStep(23)).toBe(2);
  });
  it('steps 24-31 → segment 3', () => {
    expect(chordIndexAtStep(24)).toBe(3);
    expect(chordIndexAtStep(31)).toBe(3);
  });
  it('wraps modulo 32', () => {
    expect(chordIndexAtStep(32)).toBe(0);
    expect(chordIndexAtStep(40)).toBe(1);
  });
});

describe('moodFromDelta', () => {
  it('равные → neutral', () => {
    expect(moodFromDelta(50, 50)).toBe('neutral');
  });
  it('я веду на >threshold → winning', () => {
    expect(moodFromDelta(60, 50)).toBe('winning');
  });
  it('оппонент ведёт на >threshold → losing', () => {
    expect(moodFromDelta(40, 50)).toBe('losing');
  });
  it('небольшой gap внутри threshold → neutral', () => {
    expect(moodFromDelta(52, 50, 4)).toBe('neutral');
    expect(moodFromDelta(48, 50, 4)).toBe('neutral');
  });
  it('custom threshold', () => {
    expect(moodFromDelta(55, 50, 10)).toBe('neutral');
    expect(moodFromDelta(65, 50, 10)).toBe('winning');
  });
});

describe('MusicEngine — smoke', () => {
  let engine: MusicEngine;
  beforeEach(() => {
    engine = new MusicEngine();
  });
  afterEach(() => {
    engine.stop();
  });

  it('start() в jsdom (no AudioContext) — no-op без throw', () => {
    expect(() => engine.start()).not.toThrow();
    // isPlaying false потому что ensureContext вернул false
    expect(engine.isPlaying()).toBe(false);
  });

  it('stop() без start() — no-op', () => {
    expect(() => engine.stop()).not.toThrow();
  });

  it('setIntensity clamps 0..1', () => {
    engine.setIntensity(-0.5);
    expect(engine.getIntensity()).toBe(0);
    engine.setIntensity(1.5);
    expect(engine.getIntensity()).toBe(1);
    engine.setIntensity(0.7);
    expect(engine.getIntensity()).toBe(0.7);
  });

  it('setMood обновляет state', () => {
    engine.setMood('winning');
    expect(engine.getMood()).toBe('winning');
    engine.setMood('losing');
    expect(engine.getMood()).toBe('losing');
    engine.setMood('neutral');
    expect(engine.getMood()).toBe('neutral');
  });

  it('singleton music exported', () => {
    expect(music).toBeInstanceOf(MusicEngine);
    expect(music.getMood()).toBe('neutral');
    expect(music.getIntensity()).toBe(0);
  });
});

describe('MusicEngine — с mocked AudioContext', () => {
  let engine: MusicEngine;

  function setupMock() {
    const oscStart = vi.fn();
    const oscStop = vi.fn();
    const bufStart = vi.fn();
    const bufStop = vi.fn();
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
        connect: vi.fn(function (this: unknown) { return arguments[0]; }),
        start: oscStart,
        stop: oscStop,
      }),
      createGain: () => ({
        gain: {
          value: 0,
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          cancelScheduledValues: vi.fn(),
        },
        connect: vi.fn(function (this: unknown) { return arguments[0]; }),
      }),
      createBiquadFilter: () => ({
        type: 'lowpass',
        frequency: { value: 0 },
        Q: { value: 0 },
        connect: vi.fn(function (this: unknown) { return arguments[0]; }),
      }),
      createBuffer: (_ch: number, len: number) => ({
        getChannelData: () => new Float32Array(len),
      }),
      createBufferSource: () => ({
        buffer: null,
        connect: vi.fn(function (this: unknown) { return arguments[0]; }),
        start: bufStart,
        stop: bufStop,
      }),
      resume: () => Promise.resolve(),
    };
    return { ctx, oscStart, bufStart };
  }

  beforeEach(() => {
    engine = new MusicEngine();
  });

  afterEach(() => {
    engine.stop();
    const w = window as unknown as { AudioContext?: unknown };
    delete w.AudioContext;
  });

  it('start() с AudioContext — isPlaying=true', () => {
    const { ctx } = setupMock();
    const w = window as unknown as { AudioContext: typeof AudioContext };
    w.AudioContext = (vi.fn(() => ctx) as unknown) as typeof AudioContext;
    engine.start();
    expect(engine.isPlaying()).toBe(true);
    engine.stop();
    expect(engine.isPlaying()).toBe(false);
  });

  it('start() двойной — second call ignored', () => {
    const { ctx } = setupMock();
    const w = window as unknown as { AudioContext: typeof AudioContext };
    w.AudioContext = (vi.fn(() => ctx) as unknown) as typeof AudioContext;
    engine.start();
    engine.start();
    expect(engine.isPlaying()).toBe(true);
    engine.stop();
  });

  it('setIntensity делает linearRamp на drumBus + leadBus (после start)', () => {
    const { ctx } = setupMock();
    const w = window as unknown as { AudioContext: typeof AudioContext };
    w.AudioContext = (vi.fn(() => ctx) as unknown) as typeof AudioContext;
    engine.start();
    engine.setIntensity(0.8);
    // intensity stored
    expect(engine.getIntensity()).toBe(0.8);
    engine.stop();
  });
});
