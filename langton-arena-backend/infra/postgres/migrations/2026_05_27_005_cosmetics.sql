-- 2026_05_27_005_cosmetics.sql
-- Косметика, достижения.

CREATE TABLE user_items (
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  item_id         VARCHAR(64) NOT NULL,
  acquired_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source          VARCHAR(32),
  equipped        BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_id, item_id)
);
CREATE INDEX idx_user_items_equipped ON user_items(user_id) WHERE equipped = TRUE;

CREATE TABLE user_achievements (
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  achievement_id  VARCHAR(64) NOT NULL,
  progress        INTEGER NOT NULL DEFAULT 0,
  unlocked_at     TIMESTAMPTZ,
  PRIMARY KEY (user_id, achievement_id)
);
