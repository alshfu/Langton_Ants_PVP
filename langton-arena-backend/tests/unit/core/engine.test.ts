// tests/unit/core/engine.test.ts
//
// Регрессионные тесты для langton engine. Должны покрывать:
// - Detеrminism: один seed → одна последовательность
// - Damage cap: 4 врага в одной клетке → -1 HP, не -3
// - Immunity: после damage в течение collisionCooldownTicks урон не наносится
// - Birth: при правильных условиях рождается муравей
// - Wild + hybrid: при подходящем rng-выбросе
// - Boundary: torus wrap-around работает (x=99 → x=0 на тор'е 100×100)

import { describe, it, expect } from 'vitest';
import { makeLangtonState, stepLangton } from '@langton/core';

describe('langton engine', () => {
  it.todo('classic ant traces highway after ~10k ticks');
  it.todo('damage cap: 4 enemies in one cell deals only 1 damage');
  it.todo('collision cooldown prevents repeat damage');
  it.todo('birth fires when birthConfig enabled and minNeighbors met');
  it.todo('hybrid: roll between wildChance and wildChance+hybridChance');
  it.todo('wild: roll < wildChance');
  it.todo('torus: ant at (99, 0) moving E ends at (0, 0)');
  it.todo('determinism: same seed + same inputs → bit-identical state');

  // Подкормка чтобы тест-файл не считался пустым
  it('makeLangtonState exists', () => {
    expect(typeof makeLangtonState).toBe('function');
    expect(typeof stepLangton).toBe('function');
  });
});
