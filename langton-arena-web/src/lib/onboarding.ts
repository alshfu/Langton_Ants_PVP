// src/lib/onboarding.ts
//
// Stage 8 Day 24: lightweight onboarding hint state.
//
// API:
//   hasSeenHint(id): boolean    — показывал ли раньше
//   markHintSeen(id)            — записать что показано (persist)
//   resetAllHints()             — debug: сбросить все hints
//
// Каждая hint показывается ровно один раз за всё время пользования
// приложением. State хранится в localStorage под `langton.onboarding.seen`
// как JSON массив id'шников.
//
// Невидимый failure mode: если localStorage недоступен (private mode,
// quota exceeded) — hints будут показываться каждый раз. Это OK для
// onboarding (хуже было бы скрыть навсегда из-за storage issue).

export type HintId =
  | 'match_lobby'      // Lobby: объясняем Ready + share URL
  | 'match_playing'    // Playing: "click to deploy your ant"
  | 'match_finished';  // Finished: rematch button

const STORAGE_KEY = 'langton.onboarding.seen';

/** Read set из localStorage. Defensive — catch all errors. */
function readSeen(): Set<string> {
  try {
    if (typeof window === 'undefined') return new Set();
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === 'string'));
  } catch { return new Set(); }
}

function writeSeen(seen: Set<string>): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(seen)));
  } catch { /* quota / private mode — silently no-op */ }
}

/** Возвращает true если этот hint уже показывался пользователю. */
export function hasSeenHint(id: HintId): boolean {
  return readSeen().has(id);
}

/** Запомнить что hint показан — больше не показывать. */
export function markHintSeen(id: HintId): void {
  const seen = readSeen();
  if (seen.has(id)) return;
  seen.add(id);
  writeSeen(seen);
}

/** Debug helper: сбросить все hints (на следующей сессии покажутся снова). */
export function resetAllHints(): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(STORAGE_KEY);
  } catch { /* */ }
}

/** Test-only: alias resetAllHints для clarity. */
export const _resetOnboardingForTest = resetAllHints;
