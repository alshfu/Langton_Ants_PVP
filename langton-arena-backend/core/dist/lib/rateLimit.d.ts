export interface RateLimitConfig {
    /** Максимум событий в окне. */
    limit: number;
    /** Длина окна в миллисекундах. */
    windowMs: number;
}
/**
 * Pure sliding-window rate limiter.
 * Caller передаёт `now` ms (для testability — реальное время в production).
 * Returns true если событие разрешено (и регистрируется в окне), false если
 * лимит превышен (событие НЕ регистрируется).
 */
export declare class SlidingWindowLimiter {
    readonly config: RateLimitConfig;
    private readonly hits;
    constructor(config: RateLimitConfig);
    /**
     * Попытаться зарегистрировать событие в момент `now`.
     * Возвращает true если разрешено (счётчик инкрементирован),
     * false если лимит превышен.
     */
    tryHit(now: number): boolean;
    /** Текущее количество событий в окне (для отладки/тестов/UI). */
    count(now: number): number;
    /** Сбросить всё (например, на reconnect grace timer end). */
    reset(): void;
    private prune;
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
export declare const RATE_LIMITS: {
    readonly deploy: {
        readonly limit: 5;
        readonly windowMs: 1000;
    };
    readonly message: {
        readonly limit: 30;
        readonly windowMs: 1000;
    };
    readonly errorBudget: {
        readonly limit: 5;
        readonly windowMs: 10000;
    };
};
//# sourceMappingURL=rateLimit.d.ts.map