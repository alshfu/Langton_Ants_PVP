-- infra/clickhouse/schema.sql
-- Аналитические таблицы. Соответствует backend §7.3.

CREATE DATABASE IF NOT EXISTS arena_analytics;

-- Сырые события матчей.
CREATE TABLE IF NOT EXISTS arena_analytics.match_events (
  match_id        UUID,
  tick            UInt32,
  ts              DateTime64(3, 'UTC'),
  event_type      LowCardinality(String),
  actor_id        Nullable(UUID),
  target_id       Nullable(UUID),
  payload         String,        -- JSON
  region          LowCardinality(String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(ts)
ORDER BY (match_id, tick, ts)
TTL ts + INTERVAL 90 DAY;        -- автоудаление через 90 дней

-- Агрегаты по игроку и дню (для быстрых profile stats).
CREATE MATERIALIZED VIEW IF NOT EXISTS arena_analytics.player_match_stats
ENGINE = SummingMergeTree()
ORDER BY (user_id, day) AS
SELECT
  toDate(ts) AS day,
  actor_id   AS user_id,
  countIf(event_type = 'capture') AS captures,
  countIf(event_type = 'death')   AS deaths,
  countIf(event_type = 'kill')    AS kills
FROM arena_analytics.match_events
WHERE actor_id IS NOT NULL
GROUP BY day, user_id;

-- Глобальная мета: винрейты правил для balancing-метрик.
CREATE TABLE IF NOT EXISTS arena_analytics.rule_winrates (
  day             Date,
  rule_id         LowCardinality(String),
  matches         UInt32,
  wins            UInt32
) ENGINE = SummingMergeTree()
ORDER BY (day, rule_id);
