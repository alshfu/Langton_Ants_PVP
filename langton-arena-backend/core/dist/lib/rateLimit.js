// core/src/lib/rateLimit.ts
//
// Stage 8 Day 14 — sliding-window rate limiter.
// Используется server'ом для per-connection ограничений (deploy/msg/error
// budgets). Pure logic — testable без mocks времени.
//
// Алгоритм: фиксированное окно `windowMs`, считаем количество событий
// в нём, если ≥ `limit` — отказ. Старые события автоматически уходят за
// границу окна и больше не учитываются.
/**
 * Pure sliding-window rate limiter.
 * Caller передаёт `now` ms (для testability — реальное время в production).
 * Returns true если событие разрешено (и регистрируется в окне), false если
 * лимит превышен (событие НЕ регистрируется).
 */
export class SlidingWindowLimiter {
    config;
    hits = [];
    constructor(config) {
        this.config = config;
    }
    /**
     * Попытаться зарегистрировать событие в момент `now`.
     * Возвращает true если разрешено (счётчик инкрементирован),
     * false если лимит превышен.
     */
    tryHit(now) {
        this.prune(now);
        if (this.hits.length >= this.config.limit)
            return false;
        this.hits.push(now);
        return true;
    }
    /** Текущее количество событий в окне (для отладки/тестов/UI). */
    count(now) {
        this.prune(now);
        return this.hits.length;
    }
    /** Сбросить всё (например, на reconnect grace timer end). */
    reset() {
        this.hits.length = 0;
    }
    prune(now) {
        const cutoff = now - this.config.windowMs;
        // hits отсортирован by insertion order (по времени), удаляем с начала
        let i = 0;
        while (i < this.hits.length && this.hits[i] < cutoff)
            i++;
        if (i > 0)
            this.hits.splice(0, i);
    }
}
/**
 * Standard limit presets для PvP.
 * Обоснование значений:
 * - deploy 5/sec: legitimate spamclick редко превышает 3-4/sec, бот на
 *   автокликере удержим
 * - msg 30/sec: ping + ready toggle + deploy + edge cases, оставляем запас
 * - errorBudget 5 за 10s: 5 невалидных сообщений за 10 секунд = чёткая
 *   атака / сломанный клиент, дисконнектим
 */
export const RATE_LIMITS = {
    deploy: { limit: 5, windowMs: 1_000 },
    message: { limit: 30, windowMs: 1_000 },
    errorBudget: { limit: 5, windowMs: 10_000 },
};
//# sourceMappingURL=rateLimit.js.map