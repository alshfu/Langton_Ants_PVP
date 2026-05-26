// src/screens/sandbox/CombatTab.tsx

import { useTheme } from '@theme/ThemeProvider';
import { useAppState } from '@state/AppStateProvider';
import { useLiveStats } from '@state/LiveStatsContext';
import { Slider } from '@ui/Slider';
import { Toggle } from '@ui/Toggle';
import { Section, Field } from './_shared';

export function CombatTab() {
  const { tokens: T } = useTheme();
  const { state, sandbox: sx } = useAppState();
  const stats = useLiveStats();
  const cfg = state.sandbox;
  const isRunning = state.sandboxRuntime.mode === 'run';

  return (
    <div>
      <Section title="Combat">
        <Toggle
          on={cfg.hpEnabled}
          onChange={(v) => sx.patchSandbox({ hpEnabled: v })}
          label="HP enabled (ants can die)"
        />
        <Toggle
          on={cfg.damageCapEnabled}
          onChange={(v) => sx.patchSandbox({ damageCapEnabled: v })}
          label="Damage cap (max −1 HP per clash)"
        />
        <Field label="Collision cooldown" hint={`${cfg.collisionCooldownTicks} ticks`}>
          <Slider
            value={cfg.collisionCooldownTicks} min={0} max={50}
            onChange={(v) => sx.patchSandbox({ collisionCooldownTicks: Math.round(v) })}
          />
        </Field>
      </Section>

      {/* Visible state indicator — даёт обратную связь что toggle применился */}
      <Section title="Current behaviour">
        <div style={{
          padding: 10,
          background: T.bgOverlay,
          borderRadius: T.radiusSm,
          border: `1px solid ${cfg.hpEnabled ? T.danger : T.success}33`,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11, color: T.textPrimary,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 14 }}>{cfg.hpEnabled ? '⚔' : '🕊'}</span>
            <strong>{cfg.hpEnabled ? 'BATTLE MODE' : 'PEACE MODE'}</strong>
          </div>
          <div style={{ fontSize: 10, color: T.textMuted, lineHeight: 1.5 }}>
            {cfg.hpEnabled ? (
              <>
                Ants take damage on collision:{' '}
                <strong style={{ color: T.danger }}>
                  {cfg.damageCapEnabled ? '−1 HP per clash' : '−N HP (N = enemies in cell)'}
                </strong>
                <br/>
                Immunity {cfg.collisionCooldownTicks} ticks after damage.
              </>
            ) : (
              <>
                <strong style={{ color: T.success }}>No damage applied.</strong>{' '}
                Ants pass through each other freely.
                Clash events still recorded for analytics.
              </>
            )}
          </div>

          {isRunning && stats.tick > 0 && (
            <div style={{
              marginTop: 8, paddingTop: 8,
              borderTop: `1px dashed ${T.border}`,
              fontSize: 10, color: T.textDim,
            }}>
              Since simulation start:{' '}
              <strong style={{ color: T.textMuted }}>{stats.totals.clashes}</strong> clashes,{' '}
              <strong style={{ color: T.textMuted }}>{stats.totals.deaths}</strong> deaths
            </div>
          )}
        </div>

        {isRunning && !cfg.hpEnabled && stats.totals.deaths > 0 && (
          <div style={{
            padding: 8, marginTop: 6,
            background: T.warning + '15',
            border: `1px dashed ${T.warning}`,
            borderRadius: T.radiusSm,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10, color: T.textMuted, lineHeight: 1.5,
          }}>
            ⚠ Some ants died before HP was disabled. They stay dead until Reset.
          </div>
        )}
      </Section>
    </div>
  );
}
