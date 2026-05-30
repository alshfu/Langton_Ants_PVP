// src/connection.ts
//
// Wrapper над WebSocket — per-client state + safe send/close helpers.
// В Stage 8 Day 2 — только базовая инфраструктура. Room/Match links
// добавятся в Day 3/4.
import { randomUUID, randomBytes } from 'node:crypto';
import { t, normalizeLocale, DEFAULT_LOCALE } from './i18n.js';
export class Connection {
    ws;
    /** Уникальный идентификатор клиента (per WS connection). */
    clientId;
    /** Когда клиент подключился (ms since epoch). */
    connectedAt;
    /** Локаль для error messages — устанавливается в join_room handler. */
    locale;
    /** Код комнаты если клиент в room (null до join_room). */
    roomCode;
    /** Nickname игрока — устанавливается в join_room. Day 3+. */
    nickname;
    /** Готов ли игрок (set_ready handler). Day 3+. */
    ready;
    /** Закрыто ли соединение со стороны сервера/клиента. */
    closed;
    /** Stage 8 Day 13: resume token для reconnect within grace period.
     *  Генерируется один раз, отправляется client в room_joined,
     *  client персистит в sessionStorage по roomCode. */
    resumeToken;
    /** Day 13: помечен ли connection как disconnected (grace period active).
     *  Остаётся в room.players до grace expire / resume. */
    disconnected;
    constructor(ws) {
        this.ws = ws;
        this.clientId = randomUUID();
        this.connectedAt = Date.now();
        this.locale = DEFAULT_LOCALE;
        this.roomCode = null;
        this.nickname = '';
        this.ready = false;
        this.closed = false;
        this.resumeToken = randomBytes(16).toString('hex');
        this.disconnected = false;
    }
    /** Day 13: усыновить state от старого Connection при resume. Сохраняем
     *  всё что должно остаться стабильным (clientId, nickname, locale, ready,
     *  resumeToken, roomCode) — но ws/closed/disconnected обновляются. */
    adoptFrom(old) {
        this.clientId = old.clientId;
        this.locale = old.locale;
        this.roomCode = old.roomCode;
        this.nickname = old.nickname;
        this.ready = old.ready;
        this.resumeToken = old.resumeToken;
        this.disconnected = false;
        this.closed = false;
    }
    /** Установить локаль клиента (вызывается из join_room handler). */
    setLocale(input) {
        this.locale = normalizeLocale(input);
    }
    /** Отправить server message. JSON serialize. No-op если соединение закрыто. */
    send(msg) {
        if (this.closed)
            return;
        if (this.ws.readyState !== 1 /* OPEN */)
            return;
        try {
            this.ws.send(JSON.stringify(msg));
        }
        catch {
            // Swallow — отправка по закрытому соединению. Cleanup в onclose.
        }
    }
    /**
     * Отправить error с локализованным message. Безопасно по shape.
     * Day 10: опциональный context для client-side prediction reconciliation.
     * Когда передан — client сможет сопоставить error с конкретным pending
     * deploy (через x/y) и rollback его ghost.
     */
    sendError(code, context) {
        this.send({
            type: 'error',
            code,
            message: t(this.locale, code),
            locale: this.locale,
            ...(context ? { context } : {}),
        });
    }
    /** Закрыть соединение. Idempotent. */
    close(reason) {
        if (this.closed)
            return;
        this.closed = true;
        try {
            this.ws.close(1000, reason ?? 'server-initiated');
        }
        catch {
            /* swallow */
        }
    }
}
//# sourceMappingURL=connection.js.map