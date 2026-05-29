// src/lib/qrCode.ts
//
// Stage 8 Day 19: QR code generation для room invite.
//
// Тонкая обёртка над `qrcode-generator` (~3 KB gzipped). Returns SVG
// string — мы рендерим его через `dangerouslySetInnerHTML` чтобы не
// тащить canvas-зависимости в bundle.
//
// Использование:
//   const svg = renderQrSvg(url);
//   <div dangerouslySetInnerHTML={{ __html: svg }} />

import qrcode from 'qrcode-generator';

export interface QrSvgOptions {
  /** Size в pixels по стороне квадрата. Default 200. */
  size?: number;
  /** Цвет тёмных модулей. Default '#0E0B1F' (наш bg-dark). */
  darkColor?: string;
  /** Цвет светлых модулей. Default '#F5F5F7'. */
  lightColor?: string;
  /** Error correction level. M = 15% корректируется (баланс size vs robust). */
  errorCorrection?: 'L' | 'M' | 'Q' | 'H';
  /** Padding (quiet zone) в модулях. Default 2 — достаточно для большинства сканеров. */
  margin?: number;
}

/**
 * Generate QR SVG markup for given text/URL.
 * Returns inline SVG string ready for dangerouslySetInnerHTML.
 *
 * Возвращает пустую строку если text слишком длинный для QR Type-40 limit
 * (~2953 chars в M mode) — не throw, чтобы UI не падал.
 */
export function renderQrSvg(text: string, opts: QrSvgOptions = {}): string {
  const size = opts.size ?? 200;
  const dark = opts.darkColor ?? '#0E0B1F';
  const light = opts.lightColor ?? '#F5F5F7';
  const ecc = opts.errorCorrection ?? 'M';
  const margin = opts.margin ?? 2;

  if (!text) return '';

  let qr;
  try {
    qr = qrcode(0, ecc); // type 0 = auto-detect smallest type
    qr.addData(text);
    qr.make();
  } catch {
    // Text too long или unsupported chars — graceful empty
    return '';
  }

  const moduleCount = qr.getModuleCount();
  const totalModules = moduleCount + margin * 2;
  const cellSize = size / totalModules;

  // Build SVG path для всех dark modules — это эффективнее чем <rect> per
  // module (особенно для крупных QR с 1000+ модулей).
  let path = '';
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (qr.isDark(row, col)) {
        const x = (col + margin) * cellSize;
        const y = (row + margin) * cellSize;
        path += `M${x.toFixed(2)},${y.toFixed(2)}h${cellSize.toFixed(2)}v${cellSize.toFixed(2)}h-${cellSize.toFixed(2)}z`;
      }
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code">`,
    `<rect width="${size}" height="${size}" fill="${light}"/>`,
    `<path d="${path}" fill="${dark}"/>`,
    `</svg>`,
  ].join('');
}

/**
 * Web Share API helper. Возвращает true если share случился (или попытка),
 * false если API недоступно — caller fallback'ает на copy-to-clipboard.
 *
 * Web Share требует:
 * - secure context (https)
 * - user gesture (call from click handler)
 * - browser support (iOS Safari 12.2+, Android Chrome 75+, desktop Safari 14+)
 */
export async function tryWebShare(payload: {
  title?: string;
  text?: string;
  url: string;
}): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & {
    share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  };
  if (typeof nav.share !== 'function') return false;
  try {
    await nav.share(payload);
    return true;
  } catch (err) {
    // AbortError = user dismissed dialog — это нормально, не fallback нужен.
    // NotAllowedError = browser отказал — fallback на copy.
    const name = (err as { name?: string })?.name;
    if (name === 'AbortError') return true;
    return false;
  }
}

/** True если Web Share API доступен в текущем браузере. */
export function isWebShareAvailable(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof (navigator as Navigator & { share?: unknown }).share === 'function';
}
