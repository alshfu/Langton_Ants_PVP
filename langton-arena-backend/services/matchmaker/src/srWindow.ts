// services/matchmaker/src/srWindow.ts
//
// Окно SR-поиска: расширяется со временем ожидания.

export function getSrWindow(waitMs: number): number {
  const initial   = parseInt(process.env.MM_SR_WINDOW_INITIAL || '50', 10);
  const max       = parseInt(process.env.MM_SR_WINDOW_MAX || '500', 10);
  const expandAt  = parseInt(process.env.MM_SR_WINDOW_EXPAND_AFTER_MS || '10000', 10);

  if (waitMs < expandAt) return initial;
  if (waitMs < expandAt * 3) return Math.min(150, max);
  if (waitMs < expandAt * 6) return Math.min(300, max);
  return max;
}
