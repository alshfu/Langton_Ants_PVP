// src/screens/sandbox/StatsTab.tsx
//
// Live статистика симуляции. Day 2 версия:
// - Totals секция (tick, births, deaths, captures, clashes, hybrids, wilds)
// - Per-player карточки (alive, territory %, kills, born, lost)
// - Sparkline и Territory chart — добавляются в Day 3

import { useTheme } from '@theme/ThemeProvider';
import { useAppState } from '@state/AppStateProvider';
import { useLiveStats } from '@state/LiveStatsContext';
import { Section, PlayerSwatch } from './_shared';

export function StatsTab() {
  const { tokens: T } = useTheme();
  const { state } = useAppState();
  const stats = useLiveStats();
  const { players } = state.sandbox;
  const isRunning = state.sandboxRuntime.mode === 'run';

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

      <Section title="By player">
        {players.map((p) => {
          const ps = stats.perPlayer[p.id];
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
              {/* Territory bar */}
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

      {stats.tick > 0 && (
        <Section title="History">
          <div style={{
            padding: 10, fontSize: 11, color: T.textMuted,
            fontFamily: 'JetBrains Mono, monospace',
            background: T.bgOverlay, borderRadius: T.radiusSm,
          }}>
            {stats.territoryHistory.length} samples · last {stats.territoryHistory.length * 5} ticks
            <br/>
            <span style={{ color: T.textDim }}>
              (chart will appear here — Day 3)
            </span>
          </div>
        </Section>
      )}
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
