// src/screens/sandbox/MutationsTab.tsx
//
// Mutation conditions (halo / mirror / path) + Win condition selector.
// Live progress индикатор для текущего win condition.

import { useTheme } from '@theme/ThemeProvider';
import { useAppState } from '@state/AppStateProvider';
import { useLiveStats } from '@state/LiveStatsContext';
import { Slider } from '@ui/Slider';
import { Toggle } from '@ui/Toggle';
import { Section, Field, Select } from './_shared';
import { describeWinProgress } from '@lib/computeMatchResult';
import type { WinConditionKind } from '@core/contract/state';

export function MutationsTab() {
  const { tokens: T } = useTheme();
  const { state, sandbox: sx } = useAppState();
  const stats = useLiveStats();
  const cfg = state.sandbox;
  const m = cfg.mutation;
  const w = cfg.winCondition;

  const patchMutation = (patch: Partial<typeof m>) => {
    sx.patchSandbox({ mutation: { ...m, ...patch } });
  };
  const patchWin = (patch: Partial<typeof w>) => {
    sx.patchSandbox({ winCondition: { ...w, ...patch } });
  };

  // Какие условия включены — для индикатора
  const enabledCount = [m.haloEnabled, m.mirrorEnabled, m.pathEnabled].filter(Boolean).length;

  return (
    <div>
      <Section title="Master toggle">
        <Toggle
          on={m.enabled}
          onChange={(v) => patchMutation({ enabled: v })}
          label={m.enabled
            ? `Mutations ON · ${enabledCount}/3 conditions active`
            : 'Mutations OFF — no mutants will be born'}
        />
        {m.enabled && enabledCount === 0 && (
          <div style={{
            marginTop: 6, padding: 8,
            background: T.warning + '15',
            border: `1px dashed ${T.warning}`,
            borderRadius: T.radiusSm,
            fontSize: 10, color: T.textMuted,
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            ⚠ Master toggle ON but all conditions OFF — enable at least one below.
          </div>
        )}
      </Section>

      <Section title="Halo · corona">
        <Toggle
          on={m.haloEnabled}
          onChange={(v) => patchMutation({ haloEnabled: v })}
          label={`Halo condition${m.enabled ? '' : ' (master OFF)'}`}
        />
        <div style={{
          marginTop: 4, fontSize: 10,
          color: T.textMuted,
          fontFamily: 'JetBrains Mono, monospace',
          lineHeight: 1.4,
        }}>
          Mutant born if ≥{m.haloMinNeighbors} of 8 cells around birth spot are own.
        </div>
        <Field label="Min own neighbors" hint={`${m.haloMinNeighbors} of 8`}>
          <Slider
            value={m.haloMinNeighbors} min={4} max={8} step={1}
            onChange={(v) => patchMutation({ haloMinNeighbors: Math.round(v) })}
          />
        </Field>
      </Section>

      <Section title="Mirror · reflection">
        <Toggle
          on={m.mirrorEnabled}
          onChange={(v) => patchMutation({ mirrorEnabled: v })}
          label={`Mirror condition${m.enabled ? '' : ' (master OFF)'}`}
        />
        <div style={{
          marginTop: 4, fontSize: 10,
          color: T.textMuted,
          fontFamily: 'JetBrains Mono, monospace',
          lineHeight: 1.4,
        }}>
          Mutant born if birth spot is symmetric to parent through enemy ant (Chebyshev radius {m.mirrorRadius}).
        </div>
        <Field label="Mirror radius" hint={`${m.mirrorRadius}`}>
          <Slider
            value={m.mirrorRadius} min={1} max={4} step={1}
            onChange={(v) => patchMutation({ mirrorRadius: Math.round(v) })}
          />
        </Field>
      </Section>

      <Section title="Path · stable parent">
        <Toggle
          on={m.pathEnabled}
          onChange={(v) => patchMutation({ pathEnabled: v })}
          label={`Path condition${m.enabled ? '' : ' (master OFF)'}`}
        />
        <div style={{
          marginTop: 4, fontSize: 10,
          color: T.textMuted,
          fontFamily: 'JetBrains Mono, monospace',
          lineHeight: 1.4,
        }}>
          Mutant born if parent survived ≥{m.pathStraightTicks} ticks without taking damage.
        </div>
        <Field label="Min ticks without damage" hint={`${m.pathStraightTicks}t`}>
          <Slider
            value={m.pathStraightTicks} min={3} max={30} step={1}
            onChange={(v) => patchMutation({ pathStraightTicks: Math.round(v) })}
          />
        </Field>
      </Section>

      <Section title="Win condition">
        <Field label="Type">
          <Select
            value={w.kind}
            onChange={(v) => patchWin({ kind: v as WinConditionKind })}
            options={[
              { value: 'none',              label: 'None — keep watching' },
              { value: 'time',              label: 'Time — territory leader at tick N' },
              { value: 'first_mutant',      label: 'First mutant — race to first mutation' },
              { value: 'n_mutants_total',   label: 'N mutants total — accumulate N over match' },
              { value: 'n_mutants_single',  label: 'N mutants alive — N simultaneously alive' },
              { value: 'survival',          label: 'Survival — last player standing' },
            ]}
          />
        </Field>

        {(w.kind === 'time' ||
          w.kind === 'n_mutants_total' ||
          w.kind === 'n_mutants_single') && (
          <Field
            label="Threshold"
            hint={
              w.kind === 'time' ? `${w.threshold} ticks` : `${w.threshold} mutants`
            }
          >
            <Slider
              value={w.threshold}
              min={w.kind === 'time' ? 50 : 1}
              max={w.kind === 'time' ? 5000 : 50}
              step={w.kind === 'time' ? 10 : 1}
              onChange={(v) => patchWin({ threshold: Math.round(v) })}
            />
          </Field>
        )}

        {/* Live progress / match status */}
        <div style={{
          marginTop: 10, padding: 10,
          background: T.bgOverlay,
          border: `1px solid ${T.border}`,
          borderRadius: T.radiusSm,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
        }}>
          {stats.match.finished ? (
            <>
              <div style={{ color: '#FFD60A', fontWeight: 700 }}>
                🏆 {stats.match.winnerName ?? 'Draw'} won
              </div>
              <div style={{ marginTop: 4, fontSize: 10, color: T.textMuted }}>
                {stats.match.reason} · tick {stats.match.finishedAtTick}
              </div>
            </>
          ) : (
            <div style={{ color: T.textPrimary }}>
              {describeWinProgress(
                w,
                stats.perPlayer,
                cfg.players.map((p) => ({ id: p.id, name: p.name })),
                stats.tick,
              )}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
