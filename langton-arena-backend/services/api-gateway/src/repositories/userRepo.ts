// services/api-gateway/src/repositories/userRepo.ts
//
// Все SQL-запросы к таблицам users + user_progress + user_items + user_achievements.
// Принцип: сырой SQL через node-postgres (никакого ORM).
//
// Все методы принимают `pool: Pool` снаружи (DI) — это упрощает тестирование.
// В тестах можно подсунуть mock-pool с in-memory данными.

import type { Pool } from 'pg';

export interface UserRow {
  id: string;
  username: string;
  username_lower: string;
  email: string | null;
  color_id: number;
  shape_id: number;
  created_at: Date;
  last_login_at: Date | null;
  is_guest: boolean;
  is_banned: boolean;
}

export interface UserProgressRow {
  user_id: string;
  level: number;
  xp: number;
  total_xp: number;
  sr: number;
  peak_sr: number;
  matches_played: number;
  wins: number;
  current_streak: number;
  best_streak: number;
}

export class UserRepo {
  constructor(private readonly pool: Pool) {}

  /**
   * Найти пользователя по ID. Используется почти везде.
   * @returns null если не найден или забанен (для большинства запросов это эквивалентно).
   */
  async findById(_id: string): Promise<UserRow | null> {
    // TODO: SELECT * FROM users WHERE id = $1 AND NOT is_banned
    throw new Error('not implemented');
  }

  /** Найти по case-insensitive username (используем username_lower). */
  async findByUsername(_username: string): Promise<UserRow | null> {
    // TODO
    throw new Error('not implemented');
  }

  async findByEmail(_email: string): Promise<UserRow | null> {
    // TODO
    throw new Error('not implemented');
  }

  /**
   * Создать нового пользователя + user_progress в одной транзакции.
   * Хеширование пароля — снаружи (utils/password.ts), сюда уже приходит hash.
   */
  async create(_data: {
    username: string;
    email: string | null;
    passwordHash: string | null;
    isGuest: boolean;
  }): Promise<UserRow> {
    // TODO: BEGIN; INSERT users; INSERT user_progress; COMMIT;
    throw new Error('not implemented');
  }

  async updateLastLogin(_id: string): Promise<void> {
    // TODO: UPDATE users SET last_login_at = NOW() WHERE id = $1
  }

  async getProgress(_userId: string): Promise<UserProgressRow | null> {
    // TODO
    throw new Error('not implemented');
  }

  /** Атомарно изменить SR и связанные счётчики после матча. */
  async applyMatchResult(_userId: string, _result: {
    srDelta: number;
    xpDelta: number;
    isWin: boolean;
  }): Promise<void> {
    // TODO: UPDATE user_progress SET sr = sr + $2, xp = xp + $3, matches_played = matches_played + 1, ...
  }
}
