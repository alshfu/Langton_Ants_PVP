// src/match.ts
//
// Match — активный матч в Room. Stage 8 Day 4.
// Lifecycle:
//   countdown (3000ms) → match_started → tick loop @ 10 TPS → match_ended
//
// Day 4: deploys timeline пустой (Day 5 implements). Win condition — time-based
// (tick >= config.winCondition.threshold), result = tie (winnerId null).
//
// Day 11+ - full computeMatchResult с perPlayer stats для domination/elimination.
import { makeLangtonState, stepLangton, canDeploy, applyDeployAction, computeWinnerByTerritory, buildReplayFromMatch, buildAntsFromConfig as coreBuildAntsFromConfig, buildBirthConfig as coreBuildBirthConfig, } from '@langton/core';
import { SERVER_ENGINE_VERSION } from './matchConfig.js';
export class Match {
    matchId;
    seed;
    startedAt;
    config;
    room;
    /** Полный timeline всех applied deploys — для replay сохранения (Day 12). */
    deployTimeline = [];
    sim;
    tickHandle = null;
    finished = false;
    tickIntervalMs;
    /** Queue: deploys ожидающие применения на следующем tick'е. */
    pendingDeploys = [];
    constructor(room, config, matchId, opts = {}) {
        this.room = room;
        this.config = config;
        this.matchId = matchId;
        this.seed = config.seed;
        this.startedAt = Date.now();
        this.tickIntervalMs = opts.tickIntervalMs ?? 100;
        this.sim = this.buildSim();
    }
    /**
     * Validate + queue deploy от клиента. Returns DeployValidation для caller'а.
     * Stage 8 Day 5: используется в router handleDeploy.
     *
     * Алгоритм:
     *   1. Проверка что матч активен
     *   2. INPUT_TOO_OLD если tick < current (защита от лагов / abuse)
     *   3. canDeploy через @langton/core (bounds + occupancy + rule)
     *   4. Push в pendingDeploys — будет применён на next tick
     */
    validateAndQueueDeploy(playerIdx, x, y, clientTick) {
        if (this.finished) {
            return { ok: false, reason: 'Match not active' };
        }
        // Server is source of truth — игнорируем deploys из прошлого
        if (clientTick < this.sim.tick - 5) {
            return { ok: false, reason: 'Input too old' };
        }
        const v = canDeploy(x, y, playerIdx, this.sim, {
            deployRule: this.config.deployRule,
            deployRadius: this.config.deployRadius,
        });
        if (!v.ok)
            return v;
        // Server применит этот deploy на NEXT tick (sim.tick + 1)
        this.pendingDeploys.push({
            tick: this.sim.tick + 1,
            playerIdx,
            x, y,
        });
        return { ok: true };
    }
    /** Start tick loop. */
    start() {
        if (this.tickHandle || this.finished)
            return;
        this.tickHandle = setInterval(() => this.tick(), this.tickIntervalMs);
    }
    /** Force stop без match_ended. Используется при server shutdown. */
    stop() {
        if (this.tickHandle) {
            clearInterval(this.tickHandle);
            this.tickHandle = null;
        }
        this.finished = true;
    }
    /** Принудительное завершение с указанием победителя. Disconnect handler. */
    endWith(winnerIndex, reason) {
        if (this.finished)
            return;
        const result = this.makeResult(winnerIndex, reason);
        this.finishAndBroadcast(result);
    }
    get currentTick() { return this.sim.tick; }
    get isFinished() { return this.finished; }
    get simState() { return this.sim; }
    // ─── private ─────────────────────────────────────────────────────────────
    tick() {
        if (this.finished)
            return;
        // 1. Step engine
        stepLangton(this.sim);
        // 2. Apply queued deploys для этого тика
        // pendingDeploys были помечены tick = sim.tick (next после validateAndQueue)
        const appliedThisTick = [];
        for (const dep of this.pendingDeploys) {
            if (dep.tick === this.sim.tick) {
                if (this.applyDeploy(dep)) {
                    appliedThisTick.push(dep);
                    this.deployTimeline.push(dep);
                }
            }
        }
        // Очищаем applied + просроченные (< current tick)
        this.pendingDeploys = this.pendingDeploys.filter((d) => d.tick > this.sim.tick);
        // 3. Broadcast match_tick (с deploys этого тика для client-side prediction)
        this.room.broadcast({
            type: 'match_tick',
            tick: this.sim.tick,
            deploys: appliedThisTick,
        });
        // 4. Win condition check.
        // Day 11: at time_expired — winner = most territory; tie если равные.
        const wc = this.config.winCondition;
        if (wc.kind === 'time' && this.sim.tick >= wc.threshold) {
            const { winnerIdx, territory } = computeWinnerByTerritory(this.sim, this.config.players);
            const reason = winnerIdx == null ? 'time_expired_tie' : 'time_expired';
            this.finishAndBroadcast(this.makeResult(winnerIdx, reason, territory));
        }
    }
    /**
     * Применить deploy на field. Адаптировано из frontend SandboxScreen.onDeployClick.
     * Возвращает true если применился (False = race condition, клетка занялась).
     */
    applyDeploy(action) {
        // Финальная проверка перед apply (race-safety)
        const v = canDeploy(action.x, action.y, action.playerIdx, this.sim, {
            deployRule: this.config.deployRule,
            deployRadius: this.config.deployRadius,
        });
        if (!v.ok)
            return false;
        // Stage 8 Day 9: shared apply logic — bit-identical client/server.
        return applyDeployAction(this.sim, action, this.config);
    }
    finishAndBroadcast(result) {
        this.finished = true;
        if (this.tickHandle) {
            clearInterval(this.tickHandle);
            this.tickHandle = null;
        }
        // Day 13: матч закончен — grace timers больше не нужны.
        for (const timer of this.room.graceTimers.values())
            clearTimeout(timer);
        this.room.graceTimers.clear();
        this.room.status = 'finished';
        // Day 12: payload replay inline. matchId уникальный → metadata.id уникален.
        const replay = buildReplayFromMatch({
            matchId: this.matchId,
            config: this.config,
            deployTimeline: this.deployTimeline,
            finishedAtTick: result.finishedAtTick,
            createdAt: Date.now(),
        });
        this.room.broadcast({
            type: 'match_ended',
            result,
            replayUrl: `/api/replays/${this.matchId}.json`, // deprecated, kept for backward compat
            replay,
        });
    }
    makeResult(winnerIdx, reason, territory) {
        const winner = winnerIdx != null ? this.config.players[winnerIdx] : null;
        return {
            finished: true,
            winnerId: winner?.id ?? null,
            winnerName: winner?.name ?? null,
            reason,
            finishedAtTick: this.sim.tick,
            bannerVisible: true,
            ...(territory ? { territory } : {}),
        };
    }
    buildSim() {
        const ants = buildAntsFromConfig(this.config);
        const birthConfig = buildBirthConfig(this.config);
        return makeLangtonState({
            w: this.config.width,
            h: this.config.height,
            ants,
            seed: this.config.seed,
            collisionCooldownTicks: this.config.collisionCooldownTicks,
            hpEnabled: this.config.hpEnabled,
            damageCapEnabled: this.config.damageCapEnabled,
            birthConfig,
            topology: this.config.topology,
        });
    }
}
// ─── Helpers (re-export для тестов backward-compat) ──────────────────────────
// Stage 8 Day 8: реализации переехали в @langton/core. Эти re-export'ы
// сохраняют обратную совместимость для уже написанных тестов.
export function buildAntsFromConfig(config) {
    return coreBuildAntsFromConfig(config);
}
export function buildBirthConfig(c) {
    return coreBuildBirthConfig(c);
}
/** Метаданные для match_started message. */
export function serverEngineMeta() {
    return { version: SERVER_ENGINE_VERSION };
}
//# sourceMappingURL=match.js.map