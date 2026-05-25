// src/screens/sandbox/VisualTab.tsx

import { useAppState } from '@state/AppStateProvider';
import { Slider } from '@ui/Slider';
import { Toggle } from '@ui/Toggle';
import { Section, Field } from './_shared';

export function VisualTab() {
  const { state, sandbox: sx } = useAppState();
  const cfg = state.sandbox;

  return (
    <div>
      <Section title="Effects">
        <Toggle on={cfg.showGlow}    onChange={(v) => sx.patchSandbox({ showGlow: v })}    label="Glow halo" />
        <Toggle on={cfg.showTrails}  onChange={(v) => sx.patchSandbox({ showTrails: v })}  label="Capture trails" />
        <Toggle on={cfg.showHpDots}  onChange={(v) => sx.patchSandbox({ showHpDots: v })}  label="HP dots above ants" />
        <Toggle on={cfg.showDirectionArrows} onChange={(v) => sx.patchSandbox({ showDirectionArrows: v })} label="Direction arrows" />
      </Section>

      <Section title="Trail decay">
        <Field label="Decay speed" hint={cfg.trailDecay.toFixed(2)}>
          <Slider
            value={cfg.trailDecay} min={0.85} max={0.99} step={0.01}
            onChange={(v) => sx.patchSandbox({ trailDecay: v })}
          />
        </Field>
      </Section>

      <Section title="Ants">
        <Field label="Ant scale" hint={cfg.antScale.toFixed(2)}>
          <Slider
            value={cfg.antScale} min={0.3} max={1.5} step={0.05}
            onChange={(v) => sx.patchSandbox({ antScale: v })}
          />
        </Field>
      </Section>
    </div>
  );
}
