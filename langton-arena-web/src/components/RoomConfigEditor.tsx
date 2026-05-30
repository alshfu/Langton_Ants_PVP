// src/components/RoomConfigEditor.tsx
//
// Stage 9.1 Day 2: host-only config selector в Lobby.
//
// Host (первый присоединившийся) видит editable dropdowns + inputs.
// Non-host (joining) видит readonly preview через MatchPreviewCard.
//
// Send `set_room_config` на каждый change — server validate'ит и
// broadcast'ит room_config_updated всем.

import { useState } from 'react';
import { useTheme } from '@theme/ThemeProvider';

export interface RoomConfigPatch {
  width?: number;
  height?: number;
  topology?: 'torus' | 'wall' | 'void' | 'bounce';
  baseTps?: number;
  winCondition?: { kind: string; threshold?: number; holdTicks?: number };
}

export interface RoomConfigEditorProps {
  /** Current config values (read из room_config_updated). */
  current: {
    width: number;
    height: number;
    topology: string;
    baseTps: number;
    winCondition: { kind: string; threshold: number; holdTicks?: number };
  };
  /** Я host? Если нет — UI readonly. */
  isHost: boolean;
  /** Callback на change. Caller (LobbyView) шлёт set_room_config через WS. */
  onChange: (patch: RoomConfigPatch) => void;
}

const GRID_SIZES = [
  { label: '40×40 (fast)', value: 40 },
  { label: '60×60 (default)', value: 60 },
  { label: '80×80 (medium)', value: 80 },
  { label: '100×100 (large)', value: 100 },
];

const TOPOLOGIES = ['torus', 'wall', 'void', 'bounce'] as const;

const WIN_CONDITION_PRESETS = [
  { label: 'Time — most territory in 30s', kind: 'time', threshold: 300 },
  { label: 'Hold — first to >50% for 50s', kind: 'hold_majority', threshold: 50, holdTicks: 500 },
  { label: 'Hold — first to >50% for 100s (long)', kind: 'hold_majority', threshold: 50, holdTicks: 1000 },
  { label: 'Hold — dominate >75% for 30s', kind: 'hold_majority', threshold: 75, holdTicks: 300 },
];

export function RoomConfigEditor({ current, isHost, onChange }: RoomConfigEditorProps) {
  const { tokens: T } = useTheme();
  const [expanded, setExpanded] = useState(false);

  // Find which preset matches current winCondition (если есть)
  const currentPresetIdx = WIN_CONDITION_PRESETS.findIndex(
    (p) => p.kind === current.winCondition.kind
       && p.threshold === current.winCondition.threshold
       && (p.holdTicks ?? null) === (current.winCondition.holdTicks ?? null),
  );

  return (
    <div
      data-testid="room-config-editor"
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
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{
          fontSize: 10, color: T.textMuted, letterSpacing: 1.5,
          textTransform: 'uppercase', fontWeight: 700,
        }}>
          {isHost ? '🎛 Host Settings' : '🔒 Settings (host-only)'}
        </span>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'transparent', border: 'none',
            color: T.textMuted, cursor: 'pointer',
            fontSize: 10, padding: 0,
          }}
        >
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Win condition preset */}
          <ConfigRow T={T} label="Win condition">
            <select
              data-testid="config-win-kind"
              disabled={!isHost}
              value={currentPresetIdx >= 0 ? currentPresetIdx : 0}
              onChange={(e) => {
                const idx = parseInt(e.target.value, 10);
                const preset = WIN_CONDITION_PRESETS[idx]!;
                onChange({
                  winCondition: {
                    kind: preset.kind,
                    threshold: preset.threshold,
                    ...(preset.holdTicks ? { holdTicks: preset.holdTicks } : {}),
                  },
                });
              }}
              style={selectStyle(T, !isHost)}
            >
              {WIN_CONDITION_PRESETS.map((p, i) => (
                <option key={i} value={i}>{p.label}</option>
              ))}
            </select>
          </ConfigRow>

          {/* Grid size */}
          <ConfigRow T={T} label="Field size">
            <select
              data-testid="config-grid-size"
              disabled={!isHost}
              value={current.width}
              onChange={(e) => {
                const size = parseInt(e.target.value, 10);
                onChange({ width: size, height: size });
              }}
              style={selectStyle(T, !isHost)}
            >
              {GRID_SIZES.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </ConfigRow>

          {/* Topology */}
          <ConfigRow T={T} label="Topology">
            <select
              data-testid="config-topology"
              disabled={!isHost}
              value={current.topology}
              onChange={(e) => onChange({ topology: e.target.value as 'torus' | 'wall' | 'void' | 'bounce' })}
              style={selectStyle(T, !isHost)}
            >
              {TOPOLOGIES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </ConfigRow>

          {/* TPS */}
          <ConfigRow T={T} label="Tempo (TPS)">
            <input
              data-testid="config-tps"
              type="number"
              disabled={!isHost}
              min={5}
              max={20}
              value={current.baseTps}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) onChange({ baseTps: v });
              }}
              style={inputStyle(T, !isHost)}
            />
          </ConfigRow>
        </div>
      )}
    </div>
  );
}

function ConfigRow({ T, label, children }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T: any;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 11,
    }}>
      <span style={{
        flex: '0 0 90px',
        color: T.textMuted, letterSpacing: 0.5,
        textTransform: 'uppercase', fontSize: 9,
      }}>
        {label}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function selectStyle(T: any, disabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '4px 8px',
    background: disabled ? `${T.bg}66` : T.bg,
    color: disabled ? T.textMuted : T.textPrimary,
    border: `1px solid ${T.border}`,
    borderRadius: T.radiusSm,
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 11,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inputStyle(T: any, disabled: boolean): React.CSSProperties {
  return {
    ...selectStyle(T, disabled),
    cursor: disabled ? 'not-allowed' : 'text',
  };
}
