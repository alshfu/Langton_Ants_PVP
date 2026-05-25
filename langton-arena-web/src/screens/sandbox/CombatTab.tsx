// src/screens/sandbox/CombatTab.tsx

import { useAppState } from '@state/AppStateProvider';
import { Slider } from '@ui/Slider';
import { Toggle } from '@ui/Toggle';
import { Section, Field } from './_shared';

export function CombatTab() {
  const { state, sandbox: sx } = useAppState();
  const cfg = state.sandbox;

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
    </div>
  );
}
