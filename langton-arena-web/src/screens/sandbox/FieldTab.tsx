// src/screens/sandbox/FieldTab.tsx

import { useTheme } from '@theme/ThemeProvider';
import { useAppState } from '@state/AppStateProvider';
import type { Topology, GridType } from '@core/contract/state';
import { Slider } from '@ui/Slider';
import { Toggle } from '@ui/Toggle';
import { Section, Field } from './_shared';

const TOPOLOGY_OPTIONS: Array<{ value: Topology; label: string; hint: string }> = [
  { value: 'torus',  label: 'Torus',  hint: 'wrap-around' },
  { value: 'wall',   label: 'Wall',   hint: 'stop at edge' },
  { value: 'bounce', label: 'Bounce', hint: 'reflect off edge' },
  { value: 'void',   label: 'Void',   hint: 'fall off — die' },
];

const GRID_OPTIONS: Array<{ value: GridType; label: string; hint: string }> = [
  { value: 'square',     label: 'Square {4,4}',     hint: '4 neighbors · ±90° turns' },
  { value: 'triangle',   label: 'Triangle {3,6}',   hint: '3 neighbors · ±120° turns' },
  { value: 'hexagonal',  label: 'Hexagonal {6,3}',  hint: '6 neighbors · ±60° turns' },
];

const PRESET_BG_COLORS = [
  '#0A081A', '#000000', '#1a1a2e', '#0c1e2e',
  '#1a0c2e', '#0c2e1e', '#2e0c1e', '#FFFFFF',
];

export function FieldTab() {
  const { tokens: T } = useTheme();
  const { state, sandbox: sx } = useAppState();
  const cfg = state.sandbox;
  const inRun = state.sandboxRuntime.mode === 'run';

  return (
    <div>
      <Section title="Size">
        <Field label="Width" hint={`${cfg.width}`}>
          <Slider
            value={cfg.width} min={20} max={1000}
            onChange={(v) => sx.patchSandbox({ width: Math.round(v) })}
          />
        </Field>
        <Field label="Height" hint={`${cfg.height}`}>
          <Slider
            value={cfg.height} min={20} max={1000}
            onChange={(v) => sx.patchSandbox({ height: Math.round(v) })}
          />
        </Field>
        {cfg.width * cfg.height >= 250_000 && (
          <div style={{
            fontSize: 10, color: T.warning,
            fontFamily: 'JetBrains Mono, monospace',
            padding: 6,
            background: T.warning + '15',
            border: `1px solid ${T.warning}50`,
            borderRadius: T.radiusSm,
            lineHeight: 1.4,
          }}>
            ⚠ Huge field ({(cfg.width * cfg.height / 1000).toFixed(0)}K cells) — step-back snapshots
            disabled above 500K, FPS may drop with many ants. Cells render at 1px so ants
            look like dots.
          </div>
        )}
        {inRun && (
          <div style={{ fontSize: 10, color: T.warning, fontFamily: 'JetBrains Mono, monospace' }}>
            ! Reset to apply size changes
          </div>
        )}
      </Section>

      <Section title="Grid type {Schläfli}">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {GRID_OPTIONS.map((opt) => {
            const active = (cfg.gridType ?? 'square') === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => sx.patchSandbox({ gridType: opt.value })}
                style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: active ? T.accentMuted : T.bgOverlay,
                  border: `1px solid ${active ? T.accent : T.border}`,
                  borderRadius: T.radiusSm, cursor: 'pointer',
                  fontSize: 12, color: T.textPrimary,
                }}
              >
                <span style={{ fontWeight: 600 }}>{opt.label}</span>
                <span style={{ fontSize: 10, color: T.textMuted, fontFamily: 'JetBrains Mono, monospace' }}>
                  {opt.hint}
                </span>
              </button>
            );
          })}
        </div>
        {(cfg.gridType ?? 'square') !== 'square' && (
          <div style={{
            marginTop: 6, padding: 6,
            fontSize: 10, color: T.textMuted,
            background: T.bgOverlay, borderRadius: T.radiusSm,
            fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.4,
          }}>
            ℹ Reset (↺) после смены grid type — sim перестраивается с новыми соседями.
          </div>
        )}
      </Section>

      <Section title="Topology">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {TOPOLOGY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => sx.patchSandbox({ topology: opt.value })}
              style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '8px 10px',
                background: cfg.topology === opt.value ? T.accentMuted : T.bgOverlay,
                border: `1px solid ${cfg.topology === opt.value ? T.accent : T.border}`,
                borderRadius: T.radiusSm, cursor: 'pointer',
                fontSize: 12, color: T.textPrimary,
              }}
            >
              <span style={{ fontWeight: 600 }}>{opt.label}</span>
              <span style={{ fontSize: 10, color: T.textMuted, fontFamily: 'JetBrains Mono, monospace' }}>
                {opt.hint}
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Appearance">
        <Field label="Background">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {PRESET_BG_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => sx.patchSandbox({ bgColor: c })}
                title={c}
                style={{
                  width: 24, height: 24,
                  background: c,
                  border: cfg.bgColor === c ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
                  borderRadius: T.radiusSm,
                  cursor: 'pointer', padding: 0,
                }}
              />
            ))}
            <input
              type="color"
              value={cfg.bgColor}
              onChange={(e) => sx.patchSandbox({ bgColor: e.target.value })}
              style={{
                width: 24, height: 24, padding: 0,
                border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
                cursor: 'pointer', background: 'transparent',
              }}
            />
          </div>
        </Field>
        <Toggle on={cfg.showGrid} onChange={(v) => sx.patchSandbox({ showGrid: v })} label="Show grid lines" />
      </Section>
    </div>
  );
}
