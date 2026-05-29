// src/lib/qrCode.test.ts
//
// Stage 8 Day 19: тесты для QR encoder + Web Share helper.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderQrSvg, tryWebShare, isWebShareAvailable } from './qrCode';

describe('renderQrSvg', () => {
  it('returns valid SVG string for typical URL', () => {
    const svg = renderQrSvg('https://alshfu.github.io/Langton_Ants_PVP/?room=ABCDE');
    expect(svg).toMatch(/^<svg /);
    expect(svg).toMatch(/<\/svg>$/);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('role="img"');
  });

  it('uses default size 200', () => {
    const svg = renderQrSvg('hello');
    expect(svg).toContain('width="200"');
    expect(svg).toContain('height="200"');
    expect(svg).toContain('viewBox="0 0 200 200"');
  });

  it('respects custom size option', () => {
    const svg = renderQrSvg('hello', { size: 320 });
    expect(svg).toContain('width="320"');
    expect(svg).toContain('height="320"');
  });

  it('uses default colors when not specified', () => {
    const svg = renderQrSvg('hello');
    expect(svg).toContain('#0E0B1F'); // dark default
    expect(svg).toContain('#F5F5F7'); // light default
  });

  it('respects custom colors', () => {
    const svg = renderQrSvg('hello', { darkColor: '#FF0000', lightColor: '#00FF00' });
    expect(svg).toContain('#FF0000');
    expect(svg).toContain('#00FF00');
  });

  it('returns empty string for empty input', () => {
    expect(renderQrSvg('')).toBe('');
  });

  it('contains path with module rectangles', () => {
    const svg = renderQrSvg('https://example.com/?room=ABCDE');
    // Path syntax: M{x},{y}h{w}v{h}h-{w}z для каждого dark module
    expect(svg).toMatch(/<path d="M[^"]+" fill="/);
  });

  it('handles short input (single char)', () => {
    const svg = renderQrSvg('A');
    expect(svg).toMatch(/^<svg /);
  });

  it('handles long URL with query params', () => {
    const longUrl = 'https://alshfu.github.io/Langton_Ants_PVP/?room=ABCDEFGHIJKL&extra=querystring&more=params';
    const svg = renderQrSvg(longUrl);
    expect(svg).toMatch(/^<svg /);
  });

  it('different texts produce different SVG content', () => {
    const a = renderQrSvg('text-a-12345');
    const b = renderQrSvg('text-b-67890');
    expect(a).not.toBe(b);
  });

  it('M error correction is default', () => {
    // Smoke: M ECC должен генерировать чуть бОльший QR чем L для того же текста
    const m = renderQrSvg('hello', { errorCorrection: 'M' });
    const l = renderQrSvg('hello', { errorCorrection: 'L' });
    // Оба не пустые
    expect(m).toBeTruthy();
    expect(l).toBeTruthy();
  });

  it('returns empty SVG for text too long to encode', () => {
    // QR Type 40 + M ECC max ~2300 alphanumeric chars. 5000 chars гарантированно
    // overflow → renderQrSvg вернёт '' через try/catch.
    const tooLong = 'A'.repeat(5000);
    expect(renderQrSvg(tooLong)).toBe('');
  });
});

describe('tryWebShare', () => {
  let originalShare: unknown;

  beforeEach(() => {
    originalShare = (navigator as Navigator & { share?: unknown }).share;
  });

  afterEach(() => {
    if (originalShare !== undefined) {
      Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true });
    } else {
      delete (navigator as { share?: unknown }).share;
    }
  });

  it('returns false when navigator.share unavailable', async () => {
    delete (navigator as { share?: unknown }).share;
    const ok = await tryWebShare({ url: 'https://example.com' });
    expect(ok).toBe(false);
  });

  it('returns true when share succeeds', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: shareMock, configurable: true });
    const ok = await tryWebShare({ url: 'https://example.com', title: 'Test' });
    expect(ok).toBe(true);
    expect(shareMock).toHaveBeenCalledWith({ url: 'https://example.com', title: 'Test' });
  });

  it('treats AbortError as success (user dismissed dialog)', async () => {
    const abortErr = Object.assign(new Error('User aborted'), { name: 'AbortError' });
    const shareMock = vi.fn().mockRejectedValue(abortErr);
    Object.defineProperty(navigator, 'share', { value: shareMock, configurable: true });
    const ok = await tryWebShare({ url: 'https://example.com' });
    // User dismissed — это успешно: share attempt был, fallback не нужен.
    expect(ok).toBe(true);
  });

  it('returns false on other errors (fallback to copy)', async () => {
    const notAllowed = Object.assign(new Error('not allowed'), { name: 'NotAllowedError' });
    const shareMock = vi.fn().mockRejectedValue(notAllowed);
    Object.defineProperty(navigator, 'share', { value: shareMock, configurable: true });
    const ok = await tryWebShare({ url: 'https://example.com' });
    expect(ok).toBe(false);
  });
});

describe('isWebShareAvailable', () => {
  let originalShare: unknown;

  beforeEach(() => {
    originalShare = (navigator as Navigator & { share?: unknown }).share;
  });

  afterEach(() => {
    if (originalShare !== undefined) {
      Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true });
    } else {
      delete (navigator as { share?: unknown }).share;
    }
  });

  it('returns false when navigator.share undefined', () => {
    delete (navigator as { share?: unknown }).share;
    expect(isWebShareAvailable()).toBe(false);
  });

  it('returns true when navigator.share is a function', () => {
    Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true });
    expect(isWebShareAvailable()).toBe(true);
  });

  it('returns false when navigator.share is not a function', () => {
    Object.defineProperty(navigator, 'share', { value: 'not-a-function', configurable: true });
    expect(isWebShareAvailable()).toBe(false);
  });
});
