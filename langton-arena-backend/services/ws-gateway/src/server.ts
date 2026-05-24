// services/ws-gateway/src/server.ts
//
// WebSocket server на нативном ws.
// Слушает порт WS_PORT (default 3001), принимает соединения, делегирует connection.ts.

import { WebSocketServer } from 'ws';
import { handleConnection } from './connection';

export async function startServer(): Promise<void> {
  const port = parseInt(process.env.WS_PORT || '3001', 10);
  const wss = new WebSocketServer({ port, maxPayload: 64 * 1024 /* 64KB защита */ });

  wss.on('connection', (ws, req) => {
    // TODO: rate limit на новые connections per IP
    void handleConnection(ws, req);
  });

  wss.on('error', (err) => console.error('WSS error', err));
  console.log(`WS Gateway listening on :${port}`);
}
