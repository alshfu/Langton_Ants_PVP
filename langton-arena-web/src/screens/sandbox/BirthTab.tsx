// src/screens/sandbox/BirthTab.tsx

import { useAppState } from '@state/AppStateProvider';
import { Slider } from '@ui/Slider';
import { Toggle } from '@ui/Toggle';
import { Section, Field } from './_shared';

export function BirthTab() {
  const { state, sandbox: sx } = useAppState();
  const cfg = state.sandbox;
  const en = cfg.birthEnabled;

  return (
    <div>
      <Section title="Birth">
        <Toggle on={en} onChange={(v) => sx.patchSandbox({ birthEnabled: v })} label="Enabled" />
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
        <Field label="Max ants per player" hint={`${cfg.maxAntsPerPlayer}`}>
          <Slider
            value={cfg.maxAntsPerPlayer} min={1} max={30}
            onChange={(v) => sx.patchSandbox({ maxAntsPerPlayer: Math.round(v) })}
          />
        </Field>
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
