// src/screens/sandbox/HighlightCard.tsx
//
// Карточка highlight в StatsTab. Кликабельная если есть tickStart > 0.

import { useTheme } from '@theme/ThemeProvider';
import { useAppState } from '@state/AppStateProvider';
import type { Highlight, HighlightType } from '@core/contract/state';

interface HighlightCardProps {
  highlight: Highlight;
  onJumpTo: (tick: number) => void;
}

const ICONS: Record<HighlightType, string> = {
  biggest_fight:    '🔥',
  peak_territory:   '🏆',
  longest_streak:   '⏱',
  first_death:      '💀',
  most_kills_clash: '⚔',
};

const ACCENTS: Record<HighlightType, string> = {
  biggest_fight:    '#FF6B35',
  peak_territory:   '#FFD60A',
  longest_streak:   '#00C2A8',
  first_death:      '#FF3B30',
  most_kills_clash: '#C77DFF',
};

export function HighlightCard({ highlight, onJumpTo }: HighlightCardProps) {
  const { tokens: T } = useTheme();
  const { state } = useAppState();
  const players = state.sandbox.players;

  const accent = ACCENTS[highlight.type];
  const icon = ICONS[highlight.type];
  const canJump = highlight.tickStart > 0;

  // Цвет игрока если highlight привязан к одному
  const playerColor = highlight.ownerIdx !== undefined && highlight.ownerIdx >= 0
    && highlight.ownerIdx < players.length
    ? players[highlight.ownerIdx]!.color
    : null;

  return (
    <button
      onClick={() => canJump && onJumpTo(highlight.tickStart)}
      disabled={!canJump}
      title={canJump ? `Click to step back to tick ${highlight.tickStart}` : undefined}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: 10,
        background: T.bgOverlay,
        border: `1px solid ${T.border}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: T.radiusSm,
        cursor: canJump ? 'pointer' : 'default',
        textAlign: 'left',
        opacity: canJump ? 1 : 0.85,
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: T.textPrimary,
          marginBottom: 2,
        }}>{highlight.title}</div>
        <div style={{
          fontSize: 10, color: T.textMuted,
          fontFamily: 'JetBrains Mono, monospace',
          lineHeight: 1.4,
        }}>
          {playerColor && (
            <span style={{
              display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
              background: playerColor, marginRight: 5, verticalAlign: 'middle',
            }}/>
          )}
          {highlight.description}
        </div>
        {canJump && (
          <div style={{
            marginTop: 4, fontSize: 9, color: T.textDim,
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            ↶ click to step back
          </div>
        )}
      </div>
    </button>
  );
}
