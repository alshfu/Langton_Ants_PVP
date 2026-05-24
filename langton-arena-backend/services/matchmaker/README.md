# services/matchmaker

Подбор противников в очередях. Один процесс на регион.

## Алгоритм

См. `docs/backend-architecture.md §6`.

Кратко:
1. Игроки приходят через `mm:join` → попадают в Redis SORTED SET `mm:queue:{region}` (score = SR).
2. Каждые 500 мс (`MM_TICK_INTERVAL_MS`) делается попытка собрать матчи:
   - Сортируем по joinedAt
   - Для каждого ищем ближайших по SR в окне (expanding window)
   - Когда группа набралась — создаём лобби
3. Окно поиска расширяется со временем: 0-10s = ±50, 10-30s = ±150, 30-60s = ±300, 60+ = ±500.

## Состояние

In-memory очереди + backup в Redis для failover.

## Endpoints (через WS)

- `mm:join` → добавить в очередь
- `mm:leave` → удалить
- `mm:accept` → подтвердить найденный матч
