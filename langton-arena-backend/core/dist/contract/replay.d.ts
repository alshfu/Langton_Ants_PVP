import type { SandboxConfig } from './state';
/** Атомарная запись действия игрока в run mode. */
export interface DeployAction {
    /** Тик когда был сделан клик. */
    tick: number;
    /** Какой игрок выпустил (по idx из cfg.players). */
    playerIdx: number;
    /** Координаты deploy click. */
    x: number;
    y: number;
}
/** Метаданные replay — отображаются в списке. */
export interface ReplayMetadata {
    /** Уникальный ID — `replay-<timestamp>-<random>`. */
    id: string;
    /** Имя данное пользователем или auto-generated. */
    name: string;
    /** Время создания (ms since epoch). */
    createdAt: number;
    /** Продолжительность матча в тиках. */
    durationTicks: number;
    /** Сколько deploy actions было записано. */
    deployCount: number;
    /** Имя пресета на котором основан (если loadPreset был использован). */
    presetName?: string;
}
/** Полный replay — для сохранения и playback. */
export interface Replay {
    /** Версия формата — для будущей совместимости. */
    version: 1;
    /** Метаданные (дублируются в индексе для быстрого list). */
    metadata: ReplayMetadata;
    /** Полный конфиг — всё что нужно чтобы стартовать симуляцию. */
    config: SandboxConfig;
    /** Timeline of deploy actions в хронологическом порядке. */
    deployTimeline: DeployAction[];
}
/** Версия формата для будущей совместимости. */
export declare const REPLAY_FORMAT_VERSION = 1;
//# sourceMappingURL=replay.d.ts.map