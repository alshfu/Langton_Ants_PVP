// src/lib/computeMatchResult.ts
//
// Алгоритмы детекции победы. 5 типов win conditions.
// Каждый вызывается в onTick, возвращает обновлённый MatchResult.
//
// Все чистые функции — легко тестируются.

import type {
  MatchResult,
  PlayerLiveStats,
  WinCondition,
} from '@core/contract/state';

interface PlayerRef {
  id: string;
  name: string;
}

interface ComputeArgs {
  currentTick: number;
  winCondition: WinCondition;
  perPlayer: Record<string, PlayerLiveStats>;
  players: PlayerRef[];
  /** Текущий MatchResult — если уже finished, возвращаем как есть. */
  prevMatch: MatchResult;
}

/**
 * Главная функция: проверяет все 5 win conditions.
 * Если матч уже finished — возвращает prev (не пересчитываем).
 * Иначе — проверяет соответствующее условие и возвращает обновлённый match.
 */
export function computeMatchResult(args: ComputeArgs): MatchResult {
  const { currentTick, winCondition, perPlayer, players, prevMatch } = args;

  // Уже закончилось — не трогаем
  if (prevMatch.finished) return prevMatch;

  // Нет условия — никогда не заканчивается
  if (winCondition.kind === 'none') return prevMatch;

  switch (winCondition.kind) {
    case 'time':
      return computeTime(currentTick, winCondition.threshold, perPlayer, players);

    case 'first_mutant':
      return computeFirstMutant(currentTick, perPlayer, players);

    case 'n_mutants_total':
      return computeNMutantsTotal(currentTick, winCondition.threshold, perPlayer, players);

    case 'n_mutants_single':
      return computeNMutantsSingle(currentTick, winCondition.threshold, perPlayer, players);

    case 'survival':
      return computeSurvival(currentTick, perPlayer, players);
  }
}

// ─── Time: через N тиков победитель по territory% ────────────────────────────
function computeTime(
  currentTick: number,
  threshold: number,
  perPlayer: Record<string, PlayerLiveStats>,
  players: PlayerRef[],
): MatchResult {
  if (currentTick < threshold) return notFinished();

  // Найти лидера по territoryPct. При равенстве — наименьший индекс (стабильно).
  let bestId: string | null = null;
  let bestName: string | null = null;
  let bestPct = -1;

  for (const p of players) {
    const ps = perPlayer[p.id];
    if (!ps) continue;
    if (ps.territoryPct > bestPct) {
      bestPct = ps.territoryPct;
      bestId = p.id;
      bestName = p.name;
    }
  }

  if (!bestId) return notFinished();

  return {
    finished: true,
    winnerId: bestId,
    winnerName: bestName,
    reason: `Time limit · ${bestName} leads with ${(bestPct * 100).toFixed(1)}%`,
    finishedAtTick: currentTick,
    bannerVisible: true,
  };
}

// ─── First mutant: первый игрок чей mutants > 0 ──────────────────────────────
function computeFirstMutant(
  currentTick: number,
  perPlayer: Record<string, PlayerLiveStats>,
  players: PlayerRef[],
): MatchResult {
  for (const p of players) {
    const ps = perPlayer[p.id];
    if (!ps) continue;
    if (ps.mutants > 0) {
      return {
        finished: true,
        winnerId: p.id,
        winnerName: p.name,
        reason: `First mutant`,
        finishedAtTick: currentTick,
        bannerVisible: true,
      };
    }
  }
  return notFinished();
}

// ─── N mutants total: первый достигший N родившихся мутантов ─────────────────
function computeNMutantsTotal(
  currentTick: number,
  threshold: number,
  perPlayer: Record<string, PlayerLiveStats>,
  players: PlayerRef[],
): MatchResult {
  for (const p of players) {
    const ps = perPlayer[p.id];
    if (!ps) continue;
    if (ps.mutants >= threshold) {
      return {
        finished: true,
        winnerId: p.id,
        winnerName: p.name,
        reason: `${threshold} mutants total`,
        finishedAtTick: currentTick,
        bannerVisible: true,
      };
    }
  }
  return notFinished();
}

// ─── N mutants single: первый чей mutantsAlive >= N одновременно ─────────────
function computeNMutantsSingle(
  currentTick: number,
  threshold: number,
  perPlayer: Record<string, PlayerLiveStats>,
  players: PlayerRef[],
): MatchResult {
  for (const p of players) {
    const ps = perPlayer[p.id];
    if (!ps) continue;
    if (ps.mutantsAlive >= threshold) {
      return {
        finished: true,
        winnerId: p.id,
        winnerName: p.name,
        reason: `${threshold} mutants alive simultaneously`,
        finishedAtTick: currentTick,
        bannerVisible: true,
      };
    }
  }
  return notFinished();
}

// ─── Survival: когда у всех кроме одного alive=0 ─────────────────────────────
function computeSurvival(
  currentTick: number,
  perPlayer: Record<string, PlayerLiveStats>,
  players: PlayerRef[],
): MatchResult {
  // Нужно хотя бы 2 игрока чтобы определить survival
  if (players.length < 2) return notFinished();

  const alivePlayers = players.filter((p) => (perPlayer[p.id]?.alive ?? 0) > 0);

  // Все мертвы — ничья
  if (alivePlayers.length === 0) {
    return {
      finished: true,
      winnerId: null,
      winnerName: null,
      reason: `All players eliminated`,
      finishedAtTick: currentTick,
      bannerVisible: true,
    };
  }

  // Один живой — победитель
  if (alivePlayers.length === 1) {
    const winner = alivePlayers[0]!;
    return {
      finished: true,
      winnerId: winner.id,
      winnerName: winner.name,
      reason: `Last survivor`,
      finishedAtTick: currentTick,
      bannerVisible: true,
    };
  }

  return notFinished();
}

function notFinished(): MatchResult {
  return {
    finished: false,
    winnerId: null,
    winnerName: null,
    reason: '',
    finishedAtTick: 0,
    bannerVisible: false,
  };
}

/**
 * Helper для UI: human-readable progress текущего win condition.
 * Возвращает строку типа "5 mutants total: P2 leads 3/5".
 */
export function describeWinProgress(
  winCondition: WinCondition,
  perPlayer: Record<string, PlayerLiveStats>,
  players: PlayerRef[],
  currentTick: number,
): string {
  if (winCondition.kind === 'none') return 'No win condition set';

  if (winCondition.kind === 'time') {
    return `Time limit: ${currentTick}/${winCondition.threshold} ticks`;
  }

  if (winCondition.kind === 'first_mutant') {
    return `First mutant wins`;
  }

  if (winCondition.kind === 'n_mutants_total' || winCondition.kind === 'n_mutants_single') {
    const field = winCondition.kind === 'n_mutants_total' ? 'mutants' : 'mutantsAlive';
    const label = winCondition.kind === 'n_mutants_total' ? 'total' : 'alive';
    let leader = '?';
    let leaderValue = 0;
    for (const p of players) {
      const v = (perPlayer[p.id]?.[field] ?? 0);
      if (v > leaderValue) {
        leaderValue = v;
        leader = p.name;
      }
    }
    return `${winCondition.threshold} mutants ${label}: ${leader} ${leaderValue}/${winCondition.threshold}`;
  }

  if (winCondition.kind === 'survival') {
    const alive = players.filter((p) => (perPlayer[p.id]?.alive ?? 0) > 0).length;
    return `Survival: ${alive}/${players.length} players alive`;
  }

  return '';
}
