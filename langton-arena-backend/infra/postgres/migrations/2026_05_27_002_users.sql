-- 2026_05_27_002_users.sql
-- Identity & profile.
-- Соответствует backend §7.1.

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        VARCHAR(20) UNIQUE NOT NULL,
  username_lower  VARCHAR(20) UNIQUE NOT NULL,
  email           VARCHAR(255) UNIQUE,
  password_hash   VARCHAR(255),
  color_id        SMALLINT  NOT NULL DEFAULT 0,
  shape_id        SMALLINT  NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at   TIMESTAMPTZ,
  is_guest        BOOLEAN   NOT NULL DEFAULT FALSE,
  is_banned       BOOLEAN   NOT NULL DEFAULT FALSE,
  ban_reason      TEXT,
  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z][a-zA-Z0-9_]{2,19}$'),
  CONSTRAINT username_lower_matches CHECK (username_lower = LOWER(username))
);
CREATE INDEX idx_users_username_lower ON users(username_lower);
CREATE INDEX idx_users_last_login     ON users(last_login_at DESC);

CREATE TABLE user_progress (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  level           INTEGER NOT NULL DEFAULT 1,
  xp              BIGINT  NOT NULL DEFAULT 0,
  total_xp        BIGINT  NOT NULL DEFAULT 0,
  sr              INTEGER NOT NULL DEFAULT 1000,
  peak_sr         INTEGER NOT NULL DEFAULT 1000,
  matches_played  INTEGER NOT NULL DEFAULT 0,
  wins            INTEGER NOT NULL DEFAULT 0,
  current_streak  INTEGER NOT NULL DEFAULT 0,
  best_streak     INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_user_progress_sr ON user_progress(sr DESC);
