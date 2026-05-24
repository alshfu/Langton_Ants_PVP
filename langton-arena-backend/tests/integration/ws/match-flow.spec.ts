// tests/integration/ws/match-flow.spec.ts
//
// Полный e2e: 2 fake клиента, очередь, лобби, матч, результат.

import { describe, it } from 'vitest';

describe('Full match flow', () => {
  it.todo('2 clients connect → join queue → matched → enter lobby → ready → match → result');
  it.todo('disconnect mid-match → reconnect → state resumed');
  it.todo('player forfeits → match ends with other winning');
});
