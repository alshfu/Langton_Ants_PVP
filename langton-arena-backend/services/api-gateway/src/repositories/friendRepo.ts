// services/api-gateway/src/repositories/friendRepo.ts
//
// SQL для friendships. Изначально пара хранится (a, b) с CHECK a < b чтобы избежать дубликатов.

import type { Pool } from 'pg';

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

export class FriendRepo {
  constructor(private readonly pool: Pool) {}

  /** Нормализовать пару (a, b) → (min, max) для запросов и записей. */
  private order(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
  }

  /** Послать заявку в друзья. */
  async sendRequest(_from: string, _to: string): Promise<void> {
    // TODO: INSERT INTO friendships (user_a, user_b, status, created_at) ... ON CONFLICT DO NOTHING
    // status зависит от того, кто отправил: если from=user_a → 'pending', иначе ...
  }

  async accept(_a: string, _b: string): Promise<void> { /* TODO */ }
  async remove(_a: string, _b: string): Promise<void> { /* TODO */ }
  async block(_blocker: string, _blocked: string): Promise<void> { /* TODO */ }

  /** Список друзей пользователя в статусе 'accepted'. */
  async listFriends(_userId: string): Promise<unknown[]> {
    // TODO
    return [];
  }
}
