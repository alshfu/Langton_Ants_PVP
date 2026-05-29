// core/src/lib/rateLimit.test.ts

import { describe, it, expect } from 'vitest';
import { SlidingWindowLimiter, RATE_LIMITS } from './rateLimit';

describe('SlidingWindowLimiter', () => {
  it('пропускает события пока не достигнут лимит', () => {
    const lim = new SlidingWindowLimiter({ limit: 3, windowMs: 1_000 });
    expect(lim.tryHit(0)).toBe(true);
    expect(lim.tryHit(100)).toBe(true);
    expect(lim.tryHit(200)).toBe(true);
    expect(lim.tryHit(300)).toBe(false);
  });

  it('после ухода события за окно — снова разрешает', () => {
    const lim = new SlidingWindowLimiter({ limit: 2, windowMs: 1_000 });
    expect(lim.tryHit(0)).toBe(true);
    expect(lim.tryHit(500)).toBe(true);
    expect(lim.tryHit(900)).toBe(false);
    // Первое событие выходит за окно на 1001
    expect(lim.tryHit(1001)).toBe(true);
    // Второе всё ещё в окне (выйдет на 1501)
    expect(lim.tryHit(1100)).toBe(false);
    expect(lim.tryHit(1501)).toBe(true);
  });

  it('rejected попытки НЕ занимают слот', () => {
    const lim = new SlidingWindowLimiter({ limit: 2, windowMs: 1_000 });
    lim.tryHit(0);
    lim.tryHit(100);
    // 10 отказов подряд
    for (let i = 0; i < 10; i++) {
      expect(lim.tryHit(200 + i)).toBe(false);
    }
    // Через 1001 первое уходит за окно, доступен 1 слот
    expect(lim.tryHit(1001)).toBe(true);
    // Сразу следующее заполняет — лимит достигнут опять
    expect(lim.tryHit(1002)).toBe(false);
  });

  it('count возвращает текущее число в окне', () => {
    const lim = new SlidingWindowLimiter({ limit: 100, windowMs: 1_000 });
    expect(lim.count(0)).toBe(0);
    lim.tryHit(0);
    lim.tryHit(100);
    lim.tryHit(200);
    expect(lim.count(300)).toBe(3);
    expect(lim.count(1100)).toBe(2);
    expect(lim.count(2000)).toBe(0);
  });

  it('reset обнуляет', () => {
    const lim = new SlidingWindowLimiter({ limit: 1, windowMs: 1_000 });
    lim.tryHit(0);
    expect(lim.tryHit(100)).toBe(false);
    lim.reset();
    expect(lim.tryHit(100)).toBe(true);
  });

  it('limit=0 → всегда отказ', () => {
    const lim = new SlidingWindowLimiter({ limit: 0, windowMs: 1_000 });
    expect(lim.tryHit(0)).toBe(false);
    expect(lim.tryHit(100)).toBe(false);
  });

  it('window=0 → каждое событие сразу выходит за окно', () => {
    const lim = new SlidingWindowLimiter({ limit: 1, windowMs: 0 });
    // С window=0 предыдущее событие сразу outdated на любом now > его time
    expect(lim.tryHit(0)).toBe(true);
    expect(lim.tryHit(1)).toBe(true);
    expect(lim.tryHit(2)).toBe(true);
  });

  it('burst at exactly limit boundary', () => {
    const lim = new SlidingWindowLimiter({ limit: 5, windowMs: 1_000 });
    // 5 событий в один и тот же ms
    for (let i = 0; i < 5; i++) expect(lim.tryHit(100)).toBe(true);
    expect(lim.tryHit(100)).toBe(false);
  });
});

describe('RATE_LIMITS presets', () => {
  it('deploy = 5/sec', () => {
    expect(RATE_LIMITS.deploy.limit).toBe(5);
    expect(RATE_LIMITS.deploy.windowMs).toBe(1_000);
  });
  it('message = 30/sec', () => {
    expect(RATE_LIMITS.message.limit).toBe(30);
  });
  it('errorBudget = 5/10sec', () => {
    expect(RATE_LIMITS.errorBudget.limit).toBe(5);
    expect(RATE_LIMITS.errorBudget.windowMs).toBe(10_000);
  });
});
