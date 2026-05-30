/**
 * Форматирует количество тиков в строку "mm:ss".
 * Соответствие: interface-contract.md §7.1.
 *
 * @example
 *   formatTimer(3000, 10) → "5:00"
 *   formatTimer(1530, 10) → "2:33"
 *   formatTimer(9, 10)    → "0:00"
 */
export declare function formatTimer(ticks: number, tps?: number): string;
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
export declare function formatPercent(fraction: number): string;
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
export declare function formatLargeNumber(n: number): string;
/**
 * Форматирует изменение SR с явным знаком.
 * Соответствие: §7.4.
 *
 * @example
 *   formatSrDelta(12)  → "+12"
 *   formatSrDelta(-8)  → "-8"
 *   formatSrDelta(0)   → "±0"
 */
export declare function formatSrDelta(delta: number): string;
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
export declare function formatRelativeTime(ts: number, now?: number, locale?: string): string;
/**
 * Категория пинга для UI: цвет и количество палочек.
 * Соответствие: §7.6.
 */
export declare function pingCategory(ms: number): {
    color: string;
    bars: number;
    label: string;
};
//# sourceMappingURL=formatting.d.ts.map