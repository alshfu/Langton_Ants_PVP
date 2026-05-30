// src/components/LiveHUD.tsx
//
// Stage 8 Day 36: shared HUD components — LiveScoreboard + MatchTimer.
// Extracted из MatchScreen.tsx для reuse в Sandbox.

import type { ScoreboardSummary } from '@lib/computeScoreboard';

interface ThemeShape {
  textPrimary: string;
  textMuted: string;
  bgOverlay: string;
  border: string;
  radiusSm: string | number;
  success: string;
  danger: string;
  warning: string;
}

/**
 * Day 20 (extracted Day 36): live territory scoreboard.
 * Per-player card с color dot, name, percent, ants alive, raw cells.
 * Leader подсвечивается. My slot — inset ring. Critical (<25%) — pulse.
 */
export function LiveScoreboard({
  T, summary, myPlayerIdx,
}: {
  T: ThemeShape;
  summary: ScoreboardSummary;
  myPlayerIdx: number | null;
}) {
  const leaderIdx = summary.entries[0]?.playerIdx ?? null;
  return (
    <div
      data-testid="live-scoreboard"
      style={{
        display: 'flex', gap: 8, flexWrap: 'wrap',
        justifyContent: 'center', alignItems: 'center',
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      {summary.entries.map((e) => {
        const isLeader = e.playerIdx === leaderIdx && summary.totalOwned > 0;
        const isMe = e.playerIdx === myPlayerIdx;
        const isCritical = e.percent > 0 && e.percent < 25 && summary.totalOwned > 0;
        const isEliminated = e.antsAlive === 0 && summary.totalOwned > 0;
        return (
          <div
            key={e.playerIdx}
            data-testid={`scoreboard-p${e.playerIdx}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px',
              background: isLeader ? `${e.color}1A`
                       : isCritical ? `${T.danger}12`
                       : T.bgOverlay,
              border: `1px solid ${
                isLeader ? e.color
                : isCritical ? `${T.danger}88`
                : T.border
              }`,
              borderRadius: T.radiusSm as string,
              boxShadow: isMe ? `0 0 0 1.5px ${e.color}66 inset` : 'none',
              transition: 'background 0.2s, border-color 0.2s',
              opacity: isEliminated ? 0.45 : 1,
              animation: isCritical
                ? 'scoreboard-critical-pulse 1.4s ease-in-out infinite'
                : undefined,
            }}
          >
            <span style={{
              display: 'inline-block',
              width: 10, height: 10,
              background: e.color,
              borderRadius: '50%',
              boxShadow: `0 0 6px ${e.color}99`,
            }} />
            <span style={{
              fontSize: 11, fontWeight: isMe ? 700 : 500,
              color: T.textPrimary, letterSpacing: 0.5,
              maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {e.name}{isMe ? ' (you)' : ''}
            </span>
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: isEliminated ? T.textMuted : e.color,
              minWidth: 32, textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {e.percent.toFixed(1)}%
            </span>
            <span
              data-testid={`scoreboard-p${e.playerIdx}-ants`}
              style={{
                fontSize: 11, fontWeight: 600,
                color: e.antsAlive === 0 ? T.danger : T.textMuted,
                letterSpacing: 0.3,
                fontVariantNumeric: 'tabular-nums',
                display: 'inline-flex', alignItems: 'center', gap: 2,
              }}
            >
              <span aria-hidden="true" style={{ opacity: 0.7 }}>🐜</span>
              {e.antsAlive}
            </span>
            <span style={{
              fontSize: 10, color: T.textMuted,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {e.cells}
            </span>
          </div>
        );
      })}
      <style>{`@keyframes scoreboard-critical-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(255,69,58,0); }
        50%      { box-shadow: 0 0 0 4px rgba(255,69,58,0.45); }
      }`}</style>
    </div>
  );
}

/**
 * Day 29 (extracted Day 36): match timer обратный отсчёт.
 * Pulse animation в последние 10 секунд (urgency).
 */
export function MatchTimer({
  T, ticksElapsed, threshold, tps,
}: {
  T: ThemeShape;
  ticksElapsed: number;
  threshold: number;
  tps: number;
}) {
  const ticksLeft = Math.max(0, threshold - ticksElapsed);
  const secondsLeft = Math.ceil(ticksLeft / tps);
  const total = Math.round(threshold / tps);
  const urgent = secondsLeft <= 10 && secondsLeft > 0;
  const color = urgent ? T.warning : T.textPrimary;
  return (
    <div
      data-testid="match-timer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px',
        background: T.bgOverlay,
        border: `1px solid ${urgent ? T.warning : T.border}`,
        borderRadius: T.radiusSm as string,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 12,
        color,
        fontVariantNumeric: 'tabular-nums',
        animation: urgent
          ? 'timer-urgent-pulse 0.6s ease-in-out infinite'
          : undefined,
      }}
    >
      <span aria-hidden="true" style={{ opacity: 0.7 }}>⏱</span>
      <span style={{ fontWeight: 700 }}>{secondsLeft}s</span>
      <span style={{ color: T.textMuted, fontSize: 10 }}>/ {total}s</span>
      <style>{`@keyframes timer-urgent-pulse {
        0%, 100% { transform: scale(1); }
        50%      { transform: scale(1.06); }
      }`}</style>
    </div>
  );
}
