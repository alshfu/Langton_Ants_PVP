# services/game-worker

Game Worker — процесс, держащий **активные матчи в памяти** и тикающий симуляцию.

## Что делает

- Принимает CREATE_MATCH от Matchmaker (через Redis pub/sub)
- Создаёт MatchState в памяти (с импортом из @langton/core)
- Каждые 100 мс делает `stepLangton(sim)`
- Вычисляет дельты, рассылает через Redis pub/sub в канал `match:{id}`
- Записывает inputs в replay log
- Когда матч заканчивается — пишет финальные данные в Postgres, replay в S3, очищает память

## Capacity

Один процесс держит ~50 матчей одновременно (3000 тиков × 50 = 150k тиков/мин).
CPU: ~5-10% одного ядра. Память: ~512 МБ.

## Структура

```
src/
├── index.ts          bootstrap
├── worker.ts         главный процесс, принимает задания от Matchmaker
├── match.ts          один матч: lifecycle от create до finalize
├── tickLoop.ts       основной 10 TPS цикл
├── replayLog.ts      запись inputs для replay
├── deltaComputer.ts  вычисление дельт состояния
└── broadcast.ts      отправка дельт в Redis pub/sub
```

## Failover

В v1: если worker падает — все его матчи теряются. Допустимо для запуска.

В v2: snapshot в Redis каждые 10 тиков, при failover другой worker подхватывает.
