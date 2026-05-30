import type { SandboxConfig, MatchResult } from '../contract/state.js';
import type { Replay } from '../contract/replay.js';
/** Информация об игроке в lobby/match. */
export interface PlayerInfo {
    clientId: string;
    nickname: string;
    /** Индекс игрока в Room (0 или 1 в MVP — 2 player max). */
    index: number;
    ready: boolean;
    /** Локаль игрока для error messages. */
    locale: string;
    /** Day 13: true если игрок сейчас отключён (grace period). UI показывает
     *  "Opponent reconnecting..." вместо "Ready". */
    disconnected?: boolean;
}
/** Атомарное действие deploy в match. */
export interface DeployAction {
    tick: number;
    playerIdx: number;
    x: number;
    y: number;
}
export type ClientMessage = {
    type: 'join_room';
    roomCode: string;
    nickname: string;
    locale: string;
    /** Day 13: optional resume token — если client'у выдан токен ранее
     *  (room_joined.resumeToken) и connection теперь reconnect, шлёт его.
     *  Server найдёт matching disconnected slot и восстановит. */
    resumeToken?: string;
} | {
    type: 'leave_room';
} | {
    type: 'set_ready';
    ready: boolean;
} | {
    type: 'deploy';
    x: number;
    y: number;
    tick: number;
} | {
    type: 'ping';
    t: number;
}
/** Day 23: rematch request — после match_ended клиент шлёт это
 *  чтобы выразить намерение сыграть ещё. Server ждёт оба намерения
 *  (60s timeout), затем resetMatch() → room возвращается в lobby. */
 | {
    type: 'request_rematch';
};
/** Discriminator-strings, удобно для switch routing. */
export type ClientMessageType = ClientMessage['type'];
export type ServerMessage = {
    type: 'room_joined';
    roomCode: string;
    clientId: string;
    players: PlayerInfo[];
    /** Day 13: resume token — client персистит для будущего reconnect. */
    resumeToken: string;
    /** Day 13: true если client уже был в этой комнате и просто восстановился. */
    resumed?: boolean;
} | {
    type: 'room_updated';
    players: PlayerInfo[];
} | {
    type: 'match_resume_state';
    matchId: string;
    tick: number;
    config: SandboxConfig;
    seed: number;
    deployTimeline: DeployAction[];
} | {
    type: 'match_starting';
    countdownMs: number;
    config: SandboxConfig;
    seed: number;
    matchId: string;
} | {
    type: 'match_started';
    matchId: string;
    startedAt: number;
    serverEngineVersion: string;
} | {
    type: 'match_tick';
    tick: number;
    deploys: DeployAction[];
    checksum?: string;
} | {
    type: 'match_ended';
    result: MatchResult;
    replayUrl: string;
    /** Day 12: inline replay payload — client может сразу сохранить
     *  в local storage без HTTP fetch (mvp-server WebSocket-only). */
    replay?: Replay;
} | {
    type: 'pong';
    t: number;
    serverT: number;
}
/** Day 23: rematch status — broadcast когда любой игрок просит rematch.
 *  Client показывает "Opponent wants rematch" или "Waiting for opponent". */
 | {
    type: 'rematch_status';
    bothAgreed: boolean;
    /** clientId'ы тех кто уже согласился. Client сравнивает со своим
     *  чтобы понять "я уже согласился" vs "оппонент уже согласился". */
    agreedClientIds: string[];
}
/** Day 23: server reset'нул match — комната снова в lobby, оба игрока
 *  unready. Client сбрасывает phase в 'lobby' и matchResult/scoreboard. */
 | {
    type: 'rematch_reset';
} | {
    type: 'error';
    code: string;
    message: string;
    locale: string;
    /** Day 10: контекст rejected действия — для client-side prediction
     *  reconciliation. Опционально, заполняется только когда есть смысл
     *  (INVALID_DEPLOY/INPUT_TOO_OLD → координаты + tick). */
    context?: {
        x?: number;
        y?: number;
        tick?: number;
    };
};
export type ServerMessageType = ServerMessage['type'];
export declare const ERROR_CODES: {
    readonly MALFORMED_MESSAGE: "MALFORMED_MESSAGE";
    readonly UNKNOWN_MESSAGE_TYPE: "UNKNOWN_MESSAGE_TYPE";
    readonly RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED";
    readonly ROOM_FULL: "ROOM_FULL";
    readonly ROOM_TIMEOUT: "ROOM_TIMEOUT";
    readonly ROOM_NOT_FOUND: "ROOM_NOT_FOUND";
    readonly NOT_IN_ROOM: "NOT_IN_ROOM";
    readonly MATCH_NOT_ACTIVE: "MATCH_NOT_ACTIVE";
    readonly INVALID_DEPLOY: "INVALID_DEPLOY";
    readonly INPUT_TOO_OLD: "INPUT_TOO_OLD";
    readonly FIELD_TOO_LARGE_FOR_PVP: "FIELD_TOO_LARGE_FOR_PVP";
    readonly ENGINE_VERSION_MISMATCH: "ENGINE_VERSION_MISMATCH";
    readonly RESUME_TOKEN_EXPIRED: "RESUME_TOKEN_EXPIRED";
};
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
/** Безопасная проверка что object — ClientMessage. */
export declare function isClientMessage(obj: unknown): obj is ClientMessage;
//# sourceMappingURL=stage8.d.ts.map