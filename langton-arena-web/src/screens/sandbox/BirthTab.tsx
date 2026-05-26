// src/screens/sandbox/BirthTab.tsx

import { useAppState } from '@state/AppStateProvider';
import { useTheme } from '@theme/ThemeProvider';
import { Slider } from '@ui/Slider';
import { Toggle } from '@ui/Toggle';
import { Section, Field } from './_shared';

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
    </div>
  );
}
