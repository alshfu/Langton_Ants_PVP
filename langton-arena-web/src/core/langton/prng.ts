// src/core/langton/prng.ts
//
// Детерминированный seeded PRNG (mulberry32).
// При одинаковом seed гарантирует одинаковую последовательность — критично
// для replays и client-side prediction.

export type PRNG = () => number;

export function mulberry32(seed: number): PRNG {
  let a = seed >>> 0;
  return function rng(): number {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng: PRNG, max: number): number {
  return Math.floor(rng() * max);
}

export function pickRandom<T>(rng: PRNG, arr: ReadonlyArray<T>): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[randInt(rng, arr.length)];
}
