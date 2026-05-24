// core/src/shared/formatting.ts
//
// Форматирование значений: время, проценты, большие числа.
// Используется И на сервере (при подготовке payload для UI), И на клиенте.
//
// Принцип контракта §7: UI не форматирует сам. Логика готовит уже-форматированные
// строки и отдаёт их в полях типа timerLabel, srDelta и т.д.

/**
 * Форматирует количество тиков в строку "mm:ss".
 * Соответствие: interface-contract.md §7.1.
 *
 * @example
 *   formatTimer(3000, 10) → "5:00"
 *   formatTimer(1530, 10) → "2:33"
 *   formatTimer(9, 10)    → "0:00"
 */
export function formatTimer(ticks: number, tps: number = 10): string {
  const totalSec = Math.max(0, Math.floor(ticks / tps));
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

/**
 * Форматирует долю (0..1) в строку с 1 знаком после запятой.
 * 100% — без точки.
 * Соответствие: §7.2.
 *
 * @example
 *   formatPercent(0.453) → "45.3%"
 *   formatPercent(0.004) → "0.4%"
 *   formatPercent(1.0)   → "100%"
 */
export function formatPercent(fraction: number): string {
  if (fraction >= 1) return '100%';
  return `${(fraction * 100).toFixed(1)}%`;
}

/**
 * Сокращает большие числа: 1234567 → "1.2M".
 * Соответствие: §7.3.
 *
 * @example
 *   formatLargeNumber(1234567) → "1.2M"
 *   formatLargeNumber(12345)   → "12.3k"
 *   formatLargeNumber(1234)    → "1,234"
 *   formatLargeNumber(123)     → "123"
 */
export function formatLargeNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000)    return `${(n / 1_000).toFixed(1)}k`;
  if (n >= 1_000)     return n.toLocaleString('en-US');
  return n.toString();
}

/**
 * Форматирует изменение SR с явным знаком.
 * Соответствие: §7.4.
 *
 * @example
 *   formatSrDelta(12)  → "+12"
 *   formatSrDelta(-8)  → "-8"
 *   formatSrDelta(0)   → "±0"
 */
export function formatSrDelta(delta: number): string {
  if (delta === 0) return '±0';
  return delta > 0 ? `+${delta}` : `${delta}`;
}

/**
 * Форматирует относительное время "5 min ago", "Tuesday", "Mar 15".
 * Соответствие: §7.5.
 *
 * Локализация: для рантайма UI пробрасывает locale. На сервере используем 'en' по умолчанию.
 *
 * @example
 *   formatRelativeTime(Date.now() - 30_000) → "just now"
 *   formatRelativeTime(Date.now() - 300_000) → "5 min ago"
 */
export function formatRelativeTime(ts: number, now: number = Date.now(), locale: string = 'en'): string {
  const diffSec = Math.floor((now - ts) / 1000);

  if (diffSec < 60) return locale === 'ru' ? 'только что' : 'just now';
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return locale === 'ru' ? `${m} мин назад` : `${m} min ago`;
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    return locale === 'ru' ? `${h} ч назад` : `${h} hours ago`;
  }
  if (diffSec < 604800) {
    const d = new Date(ts);
    return d.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { weekday: 'long' });
  }
  if (diffSec < 2592000) {
    const d = new Date(ts);
    return d.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { month: 'short', day: 'numeric' });
  }
  const d = new Date(ts);
  return d.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Категория пинга для UI: цвет и количество палочек.
 * Соответствие: §7.6.
 */
export function pingCategory(ms: number): { color: string; bars: number; label: string } {
  if (ms <= 30)  return { color: '#39D98A', bars: 5, label: 'excellent' };
  if (ms <= 80)  return { color: '#FFD60A', bars: 4, label: 'good' };
  if (ms <= 150) return { color: '#FF8A3D', bars: 3, label: 'fair' };
  if (ms <= 250) return { color: '#FF453A', bars: 2, label: 'poor' };
  return                { color: '#FF453A', bars: 1, label: 'bad' };
}
