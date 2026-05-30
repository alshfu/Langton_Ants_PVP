// tests/router.test.ts
//
// Stage 8 Day 2 + Day 3 — message routing с реальным RoomManager.
// Используется fake Connection чтобы не поднимать real WS.
import { describe, it, expect, beforeEach } from 'vitest';
import { routeMessage } from '../src/router';
import { ERROR_CODES } from '../src/messages';
import { RoomManager } from '../src/roomManager';
import { makeContext } from '../src/serverContext';
/** Минимальный mock Connection — собирает sent messages в массив. */
class MockConnection {
    clientId;
    locale = 'en';
    nickname = '';
    ready = false;
    roomCode = null;
    closed = false;
    sent = [];
    constructor(id = 'mock-client') { this.clientId = id; }
    send(msg) { this.sent.push(msg); }
    sendError(code) {
        this.sent.push({
            type: 'error',
            code,
            message: `error: ${code}`,
            locale: this.locale,
        });
    }
    setLocale(loc) { this.locale = loc; }
    close() { this.closed = true; }
}
describe('router.routeMessage', () => {
    let conn;
    let rooms;
    let ctx;
    beforeEach(() => {
        conn = new MockConnection();
        rooms = new RoomManager();
        // Day 4: countdown 100s (effectively disabled — tests stuck in lobby).
        // Чтобы тест не триггерил match_starting когда не нужно.
        ctx = makeContext({ rooms, matchCountdownMs: 100_000, matchTickIntervalMs: 100_000 });
    });
    // ─── Parse / validate ──────────────────────────────────────────────────────
    it('возвращает MALFORMED_MESSAGE на invalid JSON', () => {
        routeMessage(conn, 'not-a-json{', ctx);
        expect(conn.sent[0].type).toBe('error');
        expect(conn.sent[0].code).toBe(ERROR_CODES.MALFORMED_MESSAGE);
    });
    it('возвращает MALFORMED_MESSAGE если нет type field', () => {
        routeMessage(conn, JSON.stringify({ foo: 'bar' }), ctx);
        expect(conn.sent[0].code).toBe(ERROR_CODES.MALFORMED_MESSAGE);
    });
    it('возвращает UNKNOWN_MESSAGE_TYPE для unrecognized type', () => {
        routeMessage(conn, JSON.stringify({ type: 'evil_hack' }), ctx);
        expect(conn.sent[0].code).toBe(ERROR_CODES.UNKNOWN_MESSAGE_TYPE);
    });
    // ─── Ping ──────────────────────────────────────────────────────────────────
    it('ping → pong с теми же t + serverT', () => {
        const t0 = 1234567890;
        routeMessage(conn, JSON.stringify({ type: 'ping', t: t0 }), ctx);
        expect(conn.sent).toHaveLength(1);
        const pong = conn.sent[0];
        expect(pong.type).toBe('pong');
        expect(pong.t).toBe(t0);
        expect(typeof pong.serverT).toBe('number');
    });
    // ─── join_room ─────────────────────────────────────────────────────────────
    it('join_room → создаёт room, ack room_joined + broadcast room_updated', () => {
        routeMessage(conn, JSON.stringify({
            type: 'join_room',
            roomCode: 'abc123',
            nickname: 'BraveAnt-42',
            locale: 'ru',
        }), ctx);
        expect(conn.locale).toBe('ru');
        expect(conn.nickname).toBe('BraveAnt-42');
        expect(conn.roomCode).toBe('abc123');
        expect(rooms.size).toBe(1);
        // 2 message: room_joined + room_updated
        expect(conn.sent).toHaveLength(2);
        const ack = conn.sent[0];
        expect(ack.type).toBe('room_joined');
        expect(ack.roomCode).toBe('abc123');
        expect(ack.players).toHaveLength(1);
        const upd = conn.sent[1];
        expect(upd.type).toBe('room_updated');
        expect(upd.players).toHaveLength(1);
    });
    it('join_room — второй игрок попадает в тот же room', () => {
        const conn2 = new MockConnection('client-2');
        routeMessage(conn, JSON.stringify({
            type: 'join_room', roomCode: 'r1', nickname: 'A', locale: 'en',
        }), ctx);
        routeMessage(conn2, JSON.stringify({
            type: 'join_room', roomCode: 'r1', nickname: 'B', locale: 'en',
        }), ctx);
        expect(rooms.size).toBe(1);
        const room = rooms.get('r1');
        expect(room.players).toHaveLength(2);
        // Player A получил room_updated после прихода B
        const updates = conn.sent.filter((m) => m.type === 'room_updated');
        expect(updates.length).toBeGreaterThanOrEqual(2);
        expect(updates[updates.length - 1].players).toHaveLength(2);
    });
    it('join_room — третий → ROOM_FULL', () => {
        const c2 = new MockConnection('2');
        const c3 = new MockConnection('3');
        const joinMsg = (n) => JSON.stringify({
            type: 'join_room', roomCode: 'r', nickname: n, locale: 'en',
        });
        routeMessage(conn, joinMsg('A'), ctx);
        routeMessage(c2, joinMsg('B'), ctx);
        routeMessage(c3, joinMsg('C'), ctx);
        const lastFromC3 = c3.sent[c3.sent.length - 1];
        expect(lastFromC3.code).toBe(ERROR_CODES.ROOM_FULL);
    });
    it('join_room — invalid nickname → MALFORMED_MESSAGE', () => {
        routeMessage(conn, JSON.stringify({
            type: 'join_room', roomCode: 'r', nickname: '<script>', locale: 'en',
        }), ctx);
        expect(conn.sent[0].code).toBe(ERROR_CODES.MALFORMED_MESSAGE);
        expect(rooms.size).toBe(0);
    });
    it('join_room — empty roomCode → MALFORMED_MESSAGE', () => {
        routeMessage(conn, JSON.stringify({
            type: 'join_room', roomCode: '', nickname: 'A', locale: 'en',
        }), ctx);
        expect(conn.sent[0].code).toBe(ERROR_CODES.MALFORMED_MESSAGE);
    });
    // ─── leave_room ────────────────────────────────────────────────────────────
    it('leave_room — снимает с room + room удаляется если пуст', () => {
        routeMessage(conn, JSON.stringify({
            type: 'join_room', roomCode: 'r', nickname: 'A', locale: 'en',
        }), ctx);
        expect(rooms.size).toBe(1);
        routeMessage(conn, JSON.stringify({ type: 'leave_room' }), ctx);
        expect(conn.roomCode).toBe(null);
        expect(rooms.size).toBe(0);
    });
    it('leave_room — broadcast остальным, room сохраняется', () => {
        const c2 = new MockConnection('2');
        routeMessage(conn, JSON.stringify({
            type: 'join_room', roomCode: 'r', nickname: 'A', locale: 'en',
        }), ctx);
        routeMessage(c2, JSON.stringify({
            type: 'join_room', roomCode: 'r', nickname: 'B', locale: 'en',
        }), ctx);
        c2.sent = []; // reset
        routeMessage(conn, JSON.stringify({ type: 'leave_room' }), ctx);
        expect(rooms.size).toBe(1);
        expect(rooms.get('r').players).toHaveLength(1);
        // c2 получил room_updated
        const upd = c2.sent.find((m) => m.type === 'room_updated');
        expect(upd).toBeDefined();
        expect(upd.players).toHaveLength(1);
    });
    // ─── set_ready ─────────────────────────────────────────────────────────────
    it('set_ready до join → NOT_IN_ROOM', () => {
        routeMessage(conn, JSON.stringify({ type: 'set_ready', ready: true }), ctx);
        expect(conn.sent[0].code).toBe(ERROR_CODES.NOT_IN_ROOM);
    });
    it('set_ready после join — обновляет ready + broadcast', () => {
        routeMessage(conn, JSON.stringify({
            type: 'join_room', roomCode: 'r', nickname: 'A', locale: 'en',
        }), ctx);
        conn.sent = [];
        routeMessage(conn, JSON.stringify({ type: 'set_ready', ready: true }), ctx);
        expect(conn.ready).toBe(true);
        const upd = conn.sent.find((m) => m.type === 'room_updated');
        expect(upd).toBeDefined();
        expect(upd.players[0].ready).toBe(true);
    });
    // ─── deploy ────────────────────────────────────────────────────────────────
    it('deploy до join → NOT_IN_ROOM', () => {
        routeMessage(conn, JSON.stringify({ type: 'deploy', x: 5, y: 5, tick: 1 }), ctx);
        expect(conn.sent[0].code).toBe(ERROR_CODES.NOT_IN_ROOM);
    });
    it('deploy внутри room (lobby) → MATCH_NOT_ACTIVE (Day 5 stub)', () => {
        routeMessage(conn, JSON.stringify({
            type: 'join_room', roomCode: 'r', nickname: 'A', locale: 'en',
        }), ctx);
        conn.sent = [];
        routeMessage(conn, JSON.stringify({ type: 'deploy', x: 5, y: 5, tick: 1 }), ctx);
        expect(conn.sent[0].code).toBe(ERROR_CODES.MATCH_NOT_ACTIVE);
    });
});
//# sourceMappingURL=router.test.js.map