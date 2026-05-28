// src/messages.ts
//
// Stage 8 Day 6: типы переехали в @langton/core/protocol/stage8.
// Этот файл — barrel re-export для обратной совместимости.

export {
  ERROR_CODES,
  isClientMessage,
} from '@langton/core';

export type {
  PlayerInfo,
  DeployAction,
  ClientMessage,
  ClientMessageType,
  ServerMessage,
  ServerMessageType,
  ErrorCode,
} from '@langton/core';
