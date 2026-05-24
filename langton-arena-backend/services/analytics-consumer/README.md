# services/analytics-consumer

Читает события из Redpanda (Kafka) → пишет в ClickHouse.

## Зачем

Game Workers и API Gateway пишут события в Redpanda topic `events` (асинхронно, не блокируя горячий путь).
Этот сервис — фоновый consumer, перекладывает batched-вставкой в ClickHouse.

## Стек

- Consumer: kafkajs
- Writer: @clickhouse/client

## Стратегия

- Pulling batch'и по 1000 событий или каждые 2 секунды (что наступит раньше)
- INSERT в ClickHouse одной транзакцией (это быстрее чем по одному)
- При ошибке — retry до 5 раз, затем dead letter queue (отдельный topic)
