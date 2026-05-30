// tests/deploy.test.ts
//
// Stage 8 Day 5 — Match.validateAndQueueDeploy + apply на tick.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Match } from '../src/match';
import { defaultMatchConfig } from '../src/matchConfig';
import { Room } from '../src/room';
class MockConn {
    clientId;
    nickname;
    locale = 'en';
    ready = false;
    roomCode = null;
    closed = false;
    sent = [];
    constructor(id, nickname) {
        this.clientId = id;
        this.nickname = nickname;
    }
    send(m) { this.sent.push(m); }
    sendError() { }
    setLocale(l) { this.locale = l; }
    close() { this.closed = true; }
}
function makeRoomWith2Players() {
    const room = new Room('test');
    room.addPlayer(new MockConn('a', 'Alice'));
    room.addPlayer(new MockConn('b', 'Bob'));
    return room;
}
describe('Match.validateAndQueueDeploy', () => {
    let room;
    let m;
    beforeEach(() => {
        room = makeRoomWith2Players();
        const cfg = defaultMatchConfig(42);
        m = new Match(room, cfg, 'm1');
    });
    afterEach(() => { m.stop(); });
    it('valid deploy queues OK', () => {
        // Default deployRule='anywhere', deployRadius=3
        // Клетка (30, 30) свободна (нет ant'а)
        const v = m.validateAndQueueDeploy(0, 30, 30, 0);
        expect(v.ok).toBe(true);
    });
    it('out of bounds → reason "Outside the field"', () => {
        const v = m.validateAndQueueDeploy(0, -1, 30, 0);
        expect(v.ok).toBe(false);
        if (!v.ok)
            expect(v.reason).toMatch(/Outside/i);
        const v2 = m.validateAndQueueDeploy(0, 100, 30, 0);
        expect(v2.ok).toBe(false);
    });
    it('cell occupied (existing ant) → reason "Cell occupied"', () => {
        // Default config: P0 ant at (5, 5)
        const v = m.validateAndQueueDeploy(0, 5, 5, 0);
        expect(v.ok).toBe(false);
        if (!v.ok)
            expect(v.reason).toMatch(/occupied/i);
    });
    it('INPUT_TOO_OLD после нескольких ticks', async () => {
        m.start();
        // Run для ~30мс с tickInterval default 100 (1 tick)
        // Простой подход: создаём match с быстрым tick + ждём tick=10
        m.stop();
        const room2 = makeRoomWith2Players();
        const cfg = defaultMatchConfig(42);
        const fast = new Match(room2, cfg, 'm2', { tickIntervalMs: 5 });
        fast.start();
        await new Promise((r) => setTimeout(r, 80));
        const tickNow = fast.currentTick;
        // Шлём deploy с tick из прошлого (< current - 5)
        const v = fast.validateAndQueueDeploy(0, 30, 30, tickNow - 20);
        fast.stop();
        expect(v.ok).toBe(false);
        if (!v.ok)
            expect(v.reason).toMatch(/too old/i);
    });
    it('finished match → reason "Match not active"', () => {
        m.endWith(0, 'forced');
        const v = m.validateAndQueueDeploy(0, 30, 30, 0);
        expect(v.ok).toBe(false);
        if (!v.ok)
            expect(v.reason).toMatch(/not active/i);
    });
});
describe('Match — deploy applied on next tick', () => {
    it('valid deploy → ant появляется на field на следующем tick', async () => {
        const room = makeRoomWith2Players();
        const cfg = defaultMatchConfig(42);
        const m = new Match(room, cfg, 'm', { tickIntervalMs: 5 });
        m.start();
        await new Promise((r) => setTimeout(r, 30));
        const tickBefore = m.currentTick;
        const antsBefore = m.simState.ants.length;
        const v = m.validateAndQueueDeploy(0, 30, 30, tickBefore);
        expect(v.ok).toBe(true);
        // Ждём 2 ticks чтобы apply прошло (queue на tick+1)
        await new Promise((r) => setTimeout(r, 30));
        m.stop();
        expect(m.simState.ants.length).toBeGreaterThan(antsBefore);
        // ant — самый поздний bornAt (новый deploy). Не по (30,30) т.к. он уже
        // мог сделать несколько шагов за 30ms wait (race-tolerant matching).
        const sorted = [...m.simState.ants].sort((a, b) => b.bornAt - a.bornAt);
        const newAnt = sorted[0];
        expect(newAnt).toBeDefined();
        expect(newAnt.owner).toBe(0);
        expect(newAnt.id).toContain('_deploy_');
    });
    it('deployTimeline накапливает applied deploys', async () => {
        const room = makeRoomWith2Players();
        const cfg = defaultMatchConfig(42);
        const m = new Match(room, cfg, 'm', { tickIntervalMs: 5 });
        m.start();
        await new Promise((r) => setTimeout(r, 30));
        m.validateAndQueueDeploy(0, 30, 30, m.currentTick);
        m.validateAndQueueDeploy(1, 40, 40, m.currentTick);
        await new Promise((r) => setTimeout(r, 30));
        m.stop();
        expect(m.deployTimeline.length).toBe(2);
        expect(m.deployTimeline[0].playerIdx).toBe(0);
        expect(m.deployTimeline[1].playerIdx).toBe(1);
    });
    it('match_tick.deploys содержит applied deploys', async () => {
        const room = makeRoomWith2Players();
        const cfg = defaultMatchConfig(42);
        const m = new Match(room, cfg, 'm', { tickIntervalMs: 5 });
        m.start();
        await new Promise((r) => setTimeout(r, 30));
        m.validateAndQueueDeploy(0, 30, 30, m.currentTick);
        await new Promise((r) => setTimeout(r, 30));
        m.stop();
        const a = room.players[0];
        const tickMsgsWithDeploys = a.sent.filter((s) => s.type === 'match_tick' && s.deploys.length > 0);
        expect(tickMsgsWithDeploys.length).toBeGreaterThanOrEqual(1);
        const deploy = tickMsgsWithDeploys[0].deploys[0];
        expect(deploy.playerIdx).toBe(0);
        expect(deploy.x).toBe(30);
        expect(deploy.y).toBe(30);
    });
});
//# sourceMappingURL=deploy.test.js.map