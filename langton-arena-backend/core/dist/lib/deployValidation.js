// core/src/lib/deployValidation.ts
//
// Валидация deploy-клика: можно ли выпустить муравья в клетку (x, y)
// для игрока playerIdx согласно cfg.deployRule.
//
// Чистая функция — легко тестируется. Day 5 Stage 8: переехала из frontend
// в @langton/core — теперь используется и client (visual hint), и server
// (canonical validation в mvp-server).
/**
 * Проверка возможности выпустить муравья в (x, y).
 * Учитывает:
 *  - клетка свободна (нет живого муравья там)
 *  - правило расположения (anywhere / own_territory / near_alive)
 *
 * NOTE: не проверяет наличие в мешке — это делает caller (SandboxScreen).
 */
export function canDeploy(x, y, playerIdx, sim, cfg) {
    // 0. В границах поля
    if (x < 0 || x >= sim.w || y < 0 || y >= sim.h) {
        return { ok: false, reason: 'Outside the field' };
    }
    // 1. Клетка не занята живым муравьём
    for (const a of sim.ants) {
        if (!a.dead && a.x === x && a.y === y) {
            return { ok: false, reason: 'Cell occupied' };
        }
    }
    // 2. По правилу:
    switch (cfg.deployRule) {
        case 'anywhere':
            return { ok: true };
        case 'own_territory': {
            // owner-grid: 0 = neutral, owner+1 = player
            const cell = sim.owner[y * sim.w + x];
            if (cell !== playerIdx + 1) {
                return { ok: false, reason: 'Outside your territory' };
            }
            return { ok: true };
        }
        case 'near_alive': {
            // Чебышёв-радиус от любого своего живого с учётом torus
            const w = sim.w, h = sim.h;
            const R = cfg.deployRadius;
            for (const a of sim.ants) {
                if (a.dead || a.owner !== playerIdx)
                    continue;
                const dxRaw = Math.abs(x - a.x);
                const dyRaw = Math.abs(y - a.y);
                const dx = Math.min(dxRaw, w - dxRaw);
                const dy = Math.min(dyRaw, h - dyRaw);
                if (Math.max(dx, dy) <= R)
                    return { ok: true };
            }
            return { ok: false, reason: 'Too far from your live ants' };
        }
    }
}
//# sourceMappingURL=deployValidation.js.map