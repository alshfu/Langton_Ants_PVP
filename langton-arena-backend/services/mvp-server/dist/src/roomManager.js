// src/roomManager.ts
//
// RoomManager — owner всех активных Room. Stage 8 Day 3.
// Один instance на MvpServer. Lifecycle:
//   1. join_room с новым кодом → getOrCreate() создаёт Room
//   2. join_room с существующим кодом → reuse same Room
//   3. removePlayer → если room.isEmpty() → delete() из manager
import { Room } from './room.js';
export class RoomManager {
    rooms = new Map();
    /** Найти существующую или создать новую. */
    getOrCreate(code) {
        let room = this.rooms.get(code);
        if (!room) {
            room = new Room(code);
            this.rooms.set(code, room);
        }
        return room;
    }
    /** Найти существующую. Null если нет. */
    get(code) {
        return this.rooms.get(code);
    }
    /** Удалить room (после того как все игроки вышли). */
    delete(code) {
        return this.rooms.delete(code);
    }
    /** Все активные rooms — для monitoring/tests. */
    get all() {
        return [...this.rooms.values()];
    }
    /** Количество активных rooms. */
    get size() {
        return this.rooms.size;
    }
    /** Очистить (для тестов). */
    clear() {
        this.rooms.clear();
    }
}
//# sourceMappingURL=roomManager.js.map