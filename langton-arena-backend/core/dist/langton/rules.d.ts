/** 4 направления: N=0, E=1, S=2, W=3. [dx, dy] */
export declare const LA_DIRS: ReadonlyArray<readonly [number, number]>;
/** Стандартные правила. Ключ — id. Значение — строка из символов R/L/U. */
export declare const LA_RULES: Readonly<Record<string, string>>;
export declare function parseRule(s: string): string;
//# sourceMappingURL=rules.d.ts.map