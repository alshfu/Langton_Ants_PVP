-- 2026_05_27_004_social.sql
-- Дружбы, блокировки.

CREATE TABLE friendships (
  user_a          UUID REFERENCES users(id) ON DELETE CASCADE,
  user_b          UUID REFERENCES users(id) ON DELETE CASCADE,
  status          VARCHAR(16) NOT NULL CHECK (status IN ('pending','accepted','blocked')),
  initiator       UUID REFERENCES users(id),    -- кто послал заявку (для pending)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at     TIMESTAMPTZ,
  PRIMARY KEY (user_a, user_b),
  CONSTRAINT pair_ordered CHECK (user_a < user_b)
);
CREATE INDEX idx_friendships_status ON friendships(status);

CREATE TABLE reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     UUID REFERENCES users(id),
  reported_id     UUID REFERENCES users(id),
  match_id        UUID REFERENCES matches(id),
  reason          VARCHAR(64) NOT NULL,
  details         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          VARCHAR(16) NOT NULL DEFAULT 'pending',
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES users(id)
);
CREATE INDEX idx_reports_status ON reports(status, created_at);
