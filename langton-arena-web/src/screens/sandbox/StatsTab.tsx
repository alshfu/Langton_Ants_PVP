// src/screens/sandbox/StatsTab.tsx
//
// Live статистика симуляции — Day 3 (финал Этапа 2).
// Содержит: totals секция, territory chart, per-player карточки со sparkline.

import { useMemo } from 'react';
import { useTheme } from '@theme/ThemeProvider';
import { useAppState } from '@state/AppStateProvider';
import { useLiveStats } from '@state/LiveStatsContext';
import { TerritoryChart } from '@components/TerritoryChart';
import { Sparkline } from '@components/Sparkline';
import { Section, PlayerSwatch } from './_shared';
import { HighlightCard } from './HighlightCard';

interface StatsTabProps {
  /** При клике на highlight — откатиться к его tick. */
  onJumpTo?: (tick: number) => void;
}

export function StatsTab({ onJumpTo }: StatsTabProps = {}) {
  const { tokens: T } = useTheme();
  const { state } = useAppState();
  const stats = useLiveStats();
  const { players } = state.sandbox;
  const isRunning = state.sandboxRuntime.mode === 'run';

  // Цвета игроков для chart
  const playerInfo = useMemo(
    () => players.map((p) => ({ id: p.id, color: p.color, name: p.name })),
    [players],
  );

  return (
    <div>
      {!isRunning && stats.tick === 0 && (
        <div style={{
          padding: 12, fontSize: 11, color: T.textMuted,
          fontFamily: 'JetBrains Mono, monospace',
          background: T.bgOverlay, borderRadius: T.radiusSm,
          border: `1px dashed ${T.border}`,
          marginBottom: 16,
          textAlign: 'center',
        }}>
          Run the simulation to see live statistics.
        </div>
      )}

      <Section title={`Totals · tick ${stats.tick.toLocaleString()}`}>
        <StatRow label="Births"   value={stats.totals.births}   color={T.success} />
        <StatRow label="Deaths"   value={stats.totals.deaths}   color={T.danger} />
        <StatRow label="Captures" value={stats.totals.captures} color={T.info} />
        <StatRow label="Clashes"  value={stats.totals.clashes}  color={T.warning} />
        <StatRow label="Hybrids"  value={stats.totals.hybrids}  color="#C77DFF" />
        <StatRow label="Wilds"    value={stats.totals.wilds}    color="#8E8E93" />
      </Section>

      <Section title={`Territory over time · ${stats.territoryHistory.length} samples`}>
        <div style={{
          padding: 8,
          background: T.bg, borderRadius: T.radiusSm,
          border: `1px solid ${T.border}`,
        }}>
          <TerritoryChart
            history={stats.territoryHistory}
            players={playerInfo}
            width={288}
            height={140}
            fg={T.textMuted}
          />
        </div>
      </Section>

      {stats.highlights.length > 0 && (
        <Section title={`Highlights · ${stats.highlights.length}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stats.highlights.map((h) => (
              <HighlightCard
                key={h.id}
                highlight={h}
                onJumpTo={onJumpTo ?? (() => {})}
              />
            ))}
          </div>
        </Section>
      )}

      <Section title="By player">
        {players.map((p) => {
          const ps = stats.perPlayer[p.id];
          // История этого игрока для sparkline
          const playerHistory = stats.territoryHistory
            .map((pt) => pt.byPlayer[p.id] ?? 0);

          if (!ps) {
            return (
              <PlayerCard key={p.id} color={p.color} name={p.name} ruleId={p.ruleId}>
                <div style={{ fontSize: 11, color: T.textMuted, fontFamily: 'JetBrains Mono, monospace' }}>
                  No data yet
                </div>
              </PlayerCard>
            );
          }

          return (
            <PlayerCard key={p.id} color={p.color} name={p.name} ruleId={p.ruleId}>
              {/* Territory progress bar */}
              <div style={{
                marginTop: 4, height: 4, borderRadius: 2,
                background: T.bgOverlay, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, ps.territoryPct * 100)}%`,
                  background: p.color,
                  transition: 'width .2s',
                }}/>
              </div>

              {/* Mini sparkline of territory history */}
              {playerHistory.length > 1 && (
                <div style={{ marginTop: 6 }}>
                  <Sparkline
                    values={playerHistory}
                    color={p.color}
                    width={300}
                    height={28}
                  />
                </div>
              )}

              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
                marginTop: 8, fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
              }}>
                <Mini label="terr"   value={`${(ps.territoryPct * 100).toFixed(1)}%`} accent={p.color} />
                <Mini label="alive"  value={ps.alive.toString()} />
                <Mini label="cells"  value={ps.cellsOwned.toLocaleString()} />
                <Mini label="born"   value={ps.born.toString()} color={T.success} />
                <Mini label="lost"   value={ps.lost.toString()} color={T.danger} />
                <Mini label="kills"  value={ps.kills.toString()} color={T.warning} />
              </div>
            </PlayerCard>
          );
        })}
      </Section>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  const { tokens: T } = useTheme();
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '4px 8px',
      background: T.bgOverlay, borderRadius: T.radiusSm,
      fontFamily: 'JetBrains Mono, monospace',
    }}>
      <span style={{ fontSize: 11, color: T.textMuted }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color }}>{value.toLocaleString()}</span>
    </div>
  );
}

function PlayerCard({
  color, name, ruleId, children,
}: {
  color: string;
  name: string;
  ruleId: string;
  children: React.ReactNode;
}) {
  const { tokens: T } = useTheme();
  return (
    <div style={{
      padding: 10,
      background: T.bgOverlay, borderRadius: T.radiusSm,
      border: `1px solid ${T.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <PlayerSwatch color={color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>{name}</div>
          <div style={{ fontSize: 10, color: T.textMuted, fontFamily: 'JetBrains Mono, monospace' }}>
            {ruleId}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

function Mini({
  label, value, color, accent,
}: {
  label: string;
  value: string;
  color?: string;
  accent?: string;
}) {
  const { tokens: T } = useTheme();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      padding: '4px 6px',
      background: T.bg, borderRadius: 3,
      borderLeft: accent ? `2px solid ${accent}` : undefined,
    }}>
      <span style={{ fontSize: 9, color: T.textDim, letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: color ?? T.textPrimary }}>{value}</span>
    </div>
  );
}
