// services/matchmaker/src/backfill.ts
//
// Backfill — если в матче кто-то DC до старта, ищем замену в очереди в течение 30 сек.

export async function findBackfill(_lobbyId: string): Promise<string | null> {
  // TODO: посмотреть в getQueue, найти ближайшего по SR к составу лобби, удалить из очереди
  return null;
}
