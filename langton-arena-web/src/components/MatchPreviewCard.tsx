// src/components/MatchPreviewCard.tsx
//
// Stage 8 Day 30: показывает что играть до клика Ready в lobby.
//
// Принимает упрощённый MatchPreviewData объект (для Stage 8 хардкод
// в LobbyView, Stage 9 будет приходить от server в room_joined message).
// Render — compact info grid с иконками + labels + values.

import { useTheme } from '@theme/ThemeProvider';

export interface MatchPreviewData {
  /** Размер поля. */
  width: number;
  height: number;
  /** Тип топологии (torus / wall / void / bounce). */
  topology: 'torus' | 'wall' | 'void' | 'bounce';
  /** Тип сетки (Stage 8 multi-grid). */
  gridType: 'square' | 'triangle' | 'hexagonal';
  /** Кол-во ants на player в начале матча. */
  antsPerPlayer: number;
  /** Сколько игроков max. */
  maxPlayers: number;
  /** Display name правила (Classic, Spiral, etc). */
  ruleLabel: string;
  /** Включены ли mutations (Halo, Mirror, Path). */
  mutationsEnabled: boolean;
  /** Длительность матча в секундах (если time-based). */
  durationSeconds?: number;
  /** Win condition display ("Most territory in 30s" etc). */
  winLabel: string;
}

export function MatchPreviewCard({ data }: { data: MatchPreviewData }) {
  const { tokens: T } = useTheme();

  // Сетка labels — две колонки key/value по N rows.
  const rows: Array<{ icon: string; label: string; value: string }> = [
    { icon: '🗺', label: 'Field',
      value: `${data.width}×${data.height} ${data.gridType}` },
    { icon: '⏱', label: 'Duration',
      value: data.durationSeconds ? `${data.durationSeconds}s` : '—' },
    { icon: '🐜', label: 'Ants',
      value: `${data.antsPerPlayer} per player` },
    { icon: '👥', label: 'Players',
      value: `up to ${data.maxPlayers}` },
    { icon: '🔁', label: 'Topology',
      value: data.topology },
    { icon: '⚙️', label: 'Rule',
      value: data.ruleLabel },
    { icon: '🧬', label: 'Mutations',
      value: data.mutationsEnabled ? 'On (Halo)' : 'Off' },
    { icon: '🏆', label: 'Win',
      value: data.winLabel },
  ];

  return (
    <div
      data-testid="match-preview-card"
      style={{
        padding: 14,
        background: T.bgOverlay,
        border: `1px solid ${T.border}`,
        borderRadius: T.radiusSm,
        display: 'flex', flexDirection: 'column', gap: 10,
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      <div style={{
        fontSize: 10, color: T.textMuted, letterSpacing: 1.5,
        textTransform: 'uppercase', fontWeight: 700,
      }}>
        Match preview
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px 16px',
      }}>
        {rows.map((row) => (
          <div
            key={row.label}
            data-testid={`preview-${row.label.toLowerCase()}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              minWidth: 0,
            }}
          >
            <span aria-hidden="true" style={{
              fontSize: 14, opacity: 0.75, lineHeight: 1,
              flexShrink: 0,
            }}>
              {row.icon}
            </span>
            <div style={{
              display: 'flex', flexDirection: 'column',
              minWidth: 0, flex: 1,
            }}>
              <span style={{
                fontSize: 9, color: T.textMuted, letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}>
                {row.label}
              </span>
              <span
                title={row.value}
                style={{
                  fontSize: 11, color: T.textPrimary, fontWeight: 600,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {row.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Stage 8 default config preview — соответствует
 * langton-arena-backend/services/mvp-server/src/matchConfig.ts.
 * Stage 9: будет приходить от server в room_joined.
 */
export const STAGE8_DEFAULT_PREVIEW: MatchPreviewData = {
  width: 60,
  height: 60,
  topology: 'torus',
  gridType: 'square',
  antsPerPlayer: 3,
  maxPlayers: 2,
  ruleLabel: 'Classic (RL)',
  mutationsEnabled: true,
  durationSeconds: 30,  // 300 ticks / 10 TPS
  winLabel: 'Most territory',
};
