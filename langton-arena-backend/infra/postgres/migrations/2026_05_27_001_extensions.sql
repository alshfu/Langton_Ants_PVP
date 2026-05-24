-- 2026_05_27_001_extensions.sql
-- Включаем нужные extensions Postgres. Применяется один раз.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- для gen_random_uuid() — используем встроенный
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- для gen_random_uuid() и password hashing если нужно
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- для поиска по username с LIKE
