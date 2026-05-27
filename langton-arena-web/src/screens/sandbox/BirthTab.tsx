// src/screens/sandbox/BirthTab.tsx

import { useAppState } from '@state/AppStateProvider';
import { useTheme } from '@theme/ThemeProvider';
import { Slider } from '@ui/Slider';
import { Toggle } from '@ui/Toggle';
import { Section, Field, Select } from './_shared';

export function BirthTab() {
  const { tokens: T } = useTheme();
  const { state, sandbox: sx } = useAppState();
  const cfg = state.sandbox;

  return (
    <div>
      <Section title="Birth">
        <Toggle on={cfg.birthEnabled} onChange={(v) => sx.patchSandbox({ birthEnabled: v })} label="Enabled" />

        <Field label="Min own neighbours" hint={`${cfg.birthMinNeighbors}`}>
          <Slider
            value={cfg.birthMinNeighbors} min={1} max={8}
            onChange={(v) => sx.patchSandbox({ birthMinNeighbors: Math.round(v) })}
          />
        </Field>
        <Field label="Cooldown per owner" hint={`${cfg.birthCooldownTicks}t`}>
          <Slider
            value={cfg.birthCooldownTicks} min={10} max={300}
            onChange={(v) => sx.patchSandbox({ birthCooldownTicks: Math.round(v) })}
          />
        </Field>
      </Section>

      <Section title="Population limit">
        <Toggle
          on={cfg.unlimitedAnts}
          onChange={(v) => sx.patchSandbox({ unlimitedAnts: v })}
          label="Unlimited (cap = field size)"
        />
        <Field
          label="Max ants per player"
          hint={cfg.unlimitedAnts ? 'disabled by Unlimited' : `${cfg.maxAntsPerPlayer}`}
        >
          <div style={{ opacity: cfg.unlimitedAnts ? 0.4 : 1, pointerEvents: cfg.unlimitedAnts ? 'none' : 'auto' }}>
            <Slider
              value={cfg.maxAntsPerPlayer} min={1} max={50}
              onChange={(v) => sx.patchSandbox({ maxAntsPerPlayer: Math.round(v) })}
            />
          </div>
        </Field>
        {cfg.unlimitedAnts && (
          <div style={{
            padding: 8, fontSize: 10, color: T.warning,
            fontFamily: 'JetBrains Mono, monospace',
            background: T.bgOverlay, borderRadius: T.radiusSm,
            border: `1px solid ${T.warning}33`,
          }}>
            ⚠ Unlimited: total may grow up to {cfg.width * cfg.height - 1} ants.
            Performance may drop above ~1000.
          </div>
        )}
      </Section>

      <Section title="Mutations">
        <Field label="Hybrid chance" hint={`${Math.round(cfg.hybridChance * 100)}%`}>
          <Slider
            value={cfg.hybridChance} min={0} max={1} step={0.01}
            onChange={(v) => sx.patchSandbox({ hybridChance: v })}
          />
        </Field>
        <Field label="Wild chance" hint={`${Math.round(cfg.wildBirthChance * 100)}%`}>
          <Slider
            value={cfg.wildBirthChance} min={0} max={0.5} step={0.01}
            onChange={(v) => sx.patchSandbox({ wildBirthChance: v })}
          />
        </Field>
      </Section>

      <Section title="Reserve & Deploy">
        <Toggle
          on={cfg.reserveMode}
          onChange={(v) => sx.patchSandbox({ reserveMode: v })}
          label={cfg.reserveMode
            ? 'Reserve mode ON — births go to bag'
            : 'Reserve mode OFF — births appear on field'}
        />
        <div style={{
          marginTop: 4, fontSize: 10,
          color: T.textMuted,
          fontFamily: 'JetBrains Mono, monospace',
          lineHeight: 1.4,
        }}>
          When ON: newborns accumulate in player's bag. Use 📦 Deploy button
          in transport bar to release them onto field one at a time.
        </div>

        {cfg.reserveMode && (
          <>
            <Field label="Deploy rule">
              <Select
                value={cfg.deployRule}
                onChange={(v) => sx.patchSandbox({ deployRule: v as 'anywhere' | 'own_territory' | 'near_alive' })}
                options={[
                  { value: 'anywhere',       label: 'Anywhere — any empty cell' },
                  { value: 'own_territory',  label: 'Own territory — only colored by me' },
                  { value: 'near_alive',     label: 'Near alive — radius N from my ants' },
                ]}
              />
            </Field>

            {cfg.deployRule === 'near_alive' && (
              <Field label="Deploy radius" hint={`${cfg.deployRadius}`}>
                <Slider
                  value={cfg.deployRadius} min={1} max={10} step={1}
                  onChange={(v) => sx.patchSandbox({ deployRadius: Math.round(v) })}
                />
              </Field>
            )}
          </>
        )}
      </Section>
    </div>
  );
}
