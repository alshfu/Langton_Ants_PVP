// src/screens/sandbox/VisualTab.tsx

import { useAppState } from '@state/AppStateProvider';
import { Slider } from '@ui/Slider';
import { Toggle } from '@ui/Toggle';
import { Section, Field, Select } from './_shared';

export function VisualTab() {
  const { state, sandbox: sx } = useAppState();
  const cfg = state.sandbox;

  return (
    <div>
      <Section title="Skins">
        <Field label="Skin pack">
          <Select
            value={cfg.skinPack}
            onChange={(v) => sx.patchSandbox({ skinPack: v as 'shape' | 'kenney' })}
            options={[
              { value: 'shape',  label: 'Shapes — geometric (always works)' },
              { value: 'kenney', label: 'Kenney CC0 — animal sprites (fallback if missing)' },
            ]}
          />
        </Field>
      </Section>

      <Section title="Effects">
        <Toggle on={cfg.showGlow}    onChange={(v) => sx.patchSandbox({ showGlow: v })}    label="Glow halo" />
        <Toggle on={cfg.showTrails}  onChange={(v) => sx.patchSandbox({ showTrails: v })}  label="Capture trails" />
        <Toggle on={cfg.showHpDots}  onChange={(v) => sx.patchSandbox({ showHpDots: v })}  label="HP dots above ants" />
        <Toggle on={cfg.showDirectionArrows} onChange={(v) => sx.patchSandbox({ showDirectionArrows: v })} label="Direction arrows" />
        <Toggle on={cfg.showCellState} onChange={(v) => sx.patchSandbox({ showCellState: v })} label="Show cell day/night" />
      </Section>

      <Section title="Heatmap overlay">
        <Field label="Mode">
          <Select
            value={cfg.heatmapMode}
            onChange={(v) => sx.patchSandbox({ heatmapMode: v as 'off' | 'deaths' | 'captures' | 'contested' })}
            options={[
              { value: 'off',       label: 'Off' },
              { value: 'deaths',    label: 'Deaths — where ants die' },
              { value: 'captures',  label: 'Captures — productive zones' },
              { value: 'contested', label: 'Contested — clash zones' },
            ]}
          />
        </Field>
        {cfg.heatmapMode !== 'off' && (
          <Field label="Opacity" hint={`${Math.round(cfg.heatmapOpacity * 100)}%`}>
            <Slider
              value={cfg.heatmapOpacity} min={0.1} max={1} step={0.05}
              onChange={(v) => sx.patchSandbox({ heatmapOpacity: v })}
            />
          </Field>
        )}
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
