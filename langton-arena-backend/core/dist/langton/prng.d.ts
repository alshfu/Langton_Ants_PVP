export type PRNG = () => number;
export declare function mulberry32(seed: number): PRNG;
export declare function randInt(rng: PRNG, max: number): number;
export declare function pickRandom<T>(rng: PRNG, arr: ReadonlyArray<T>): T | undefined;
//# sourceMappingURL=prng.d.ts.map