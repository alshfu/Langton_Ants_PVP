// services/ws-gateway/src/backpressure.ts
//
// Если клиент медленный (плохая сеть, занят клиент-процесс) — буфер исходящих
// растёт. Если не контролировать → процесс упадёт от OOM.
//
// Стратегия:
// 1. Каждый Client имеет outgoing queue с лимитом N сообщений.
// 2. При переполнении — дропаем самые старые match:tick (можно — они дельты)
//    и сохраняем самые новые + критичные события (match:end, match:event с
//    важными типами).
// 3. Если очередь не уменьшается X секунд → close с кодом 1013 ("try again later").

import type { WebSocket } from 'ws';

export interface OutgoingQueue {
  buffer: Uint8Array[];
  maxSize: number;
  droppedCount: number;
}

export function createQueue(maxSize = 256): OutgoingQueue {
  return { buffer: [], maxSize, droppedCount: 0 };
}

export function tryEnqueue(q: OutgoingQueue, msg: Uint8Array, critical = false): void {
  if (q.buffer.length < q.maxSize) {
    q.buffer.push(msg);
    return;
  }
  if (critical) {
    // Дропаем самый старый не-критичный, делаем место для критичного.
    q.buffer.shift();
    q.buffer.push(msg);
    q.droppedCount++;
    return;
  }
  // Не-критичное в переполненную очередь — просто дропаем.
  q.droppedCount++;
}

export function drain(ws: WebSocket, q: OutgoingQueue): void {
  // ws.bufferedAmount показывает сколько байт ждёт отправки на сокете.
  // Если >1MB — пауза. Иначе шлём всё что есть.
  if (ws.bufferedAmount > 1_000_000) return;
  while (q.buffer.length > 0) {
    const msg = q.buffer.shift()!;
    ws.send(msg);
    if (ws.bufferedAmount > 1_000_000) break;
  }
}
