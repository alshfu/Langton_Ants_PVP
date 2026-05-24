-- infra/postgres/seed.sql
-- Тестовые данные для dev. Применяется через scripts/seed.sh.
-- ВНИМАНИЕ: не применять в production!

INSERT INTO users (id, username, username_lower, email, password_hash, color_id, is_guest)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'TestPlayer1', 'testplayer1', 'p1@test.local', '$argon2id$DEV_HASH_1', 0, FALSE),
  ('22222222-2222-2222-2222-222222222222', 'TestPlayer2', 'testplayer2', 'p2@test.local', '$argon2id$DEV_HASH_2', 1, FALSE),
  ('33333333-3333-3333-3333-333333333333', 'BotEasy',     'botesy',      NULL,              NULL, 2, TRUE);

INSERT INTO user_progress (user_id, level, xp, sr, matches_played, wins)
VALUES
  ('11111111-1111-1111-1111-111111111111', 5, 1200, 1450, 23, 12),
  ('22222222-2222-2222-2222-222222222222', 8, 3400, 1820, 47, 28),
  ('33333333-3333-3333-3333-333333333333', 1,    0,  800,  0,  0);
