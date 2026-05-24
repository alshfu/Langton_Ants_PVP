-- 2026_05_27_003_matches.sql
-- Матчи и их участники. Соответствует backend §7.1.

CREATE TABLE matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode            VARCHAR(32) NOT NULL,
  region          VARCHAR(32) NOT NULL,
  status          VARCHAR(16) NOT NULL CHECK (status IN ('live','finished','aborted')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  duration_ticks  INTEGER,
  winner_id       UUID REFERENCES users(id),
  player_count    SMALLINT NOT NULL,
  seed            BIGINT NOT NULL,
  field_w         SMALLINT NOT NULL,
  field_h         SMALLINT NOT NULL,
  replay_s3_key   VARCHAR(255),
  server_version  VARCHAR(32) NOT NULL
);
CREATE INDEX idx_matches_status   ON matches(status);
CREATE INDEX idx_matches_finished ON matches(finished_at DESC);
CREATE INDEX idx_matches_winner   ON matches(winner_id, finished_at DESC);

CREATE TABLE match_participants (
  match_id        UUID REFERENCES matches(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id),
  slot_index      SMALLINT NOT NULL,
  color_id        SMALLINT NOT NULL,
  final_place     SMALLINT,
  cells_captured  INTEGER NOT NULL DEFAULT 0,
  kills           INTEGER NOT NULL DEFAULT 0,
  deaths          INTEGER NOT NULL DEFAULT 0,
  combo_max       INTEGER NOT NULL DEFAULT 0,
  sr_before       INTEGER NOT NULL,
  sr_after        INTEGER,
  xp_gained       INTEGER NOT NULL DEFAULT 0,
  forfeited       BOOLEAN NOT NULL DEFAULT FALSE,
  disconnected    BOOLEAN NOT NULL DEFAULT FALSE,
  squad_rules     JSONB   NOT NULL,
  PRIMARY KEY (match_id, user_id)
);
CREATE INDEX idx_mp_user ON match_participants(user_id, match_id);
