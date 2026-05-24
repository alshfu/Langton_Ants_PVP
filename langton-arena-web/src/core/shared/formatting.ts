// src/core/shared/formatting.ts
//
// Форматирование значений. UI вызывает эти функции и получает готовые строки.

export function formatTimer(ticks: number, tps = 10): string {
  const totalSec = Math.max(0, Math.floor(ticks / tps));
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

export function formatPercent(fraction: number): string {
  if (fraction >= 1) return '100%';
  return `${(fraction * 100).toFixed(1)}%`;
}

export function formatLargeNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000)    return `${(n / 1_000).toFixed(1)}k`;
  if (n >= 1_000)     return n.toLocaleString('en-US');
  return n.toString();
}

export function formatSrDelta(delta: number): string {
  if (delta === 0) return '±0';
  return delta > 0 ? `+${delta}` : `${delta}`;
}
