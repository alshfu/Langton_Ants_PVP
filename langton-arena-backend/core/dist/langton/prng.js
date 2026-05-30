// src/core/langton/prng.ts
//
// Детерминированный seeded PRNG (mulberry32).
// При одинаковом seed гарантирует одинаковую последовательность — критично
// для replays и client-side prediction.
export function mulberry32(seed) {
    let a = seed >>> 0;
    return function rng() {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export function randInt(rng, max) {
    return Math.floor(rng() * max);
}
export function pickRandom(rng, arr) {
    if (arr.length === 0)
        return undefined;
    return arr[randInt(rng, arr.length)];
}
//# sourceMappingURL=prng.js.map