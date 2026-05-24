// tests/load/k6/basic.js
//
// k6 нагрузочный сценарий: 1000 одновременных WS connections.
// Запуск: k6 run tests/load/k6/basic.js

import ws from 'k6/ws';
import { check } from 'k6';

export const options = {
  vus: 1000,
  duration: '60s',
  thresholds: {
    ws_connecting: ['p(95)<500'],
  },
};

export default function () {
  const url = `${__ENV.WS_URL || 'ws://localhost:3001'}`;
  const res = ws.connect(url, {}, (socket) => {
    socket.on('open', () => {
      // TODO: послать auth:hello с тестовым JWT
    });
    socket.setTimeout(() => socket.close(), 30000);
  });
  check(res, { 'status is 101': (r) => r && r.status === 101 });
}
