// src/screens/sandbox/TransportBar.tsx
//
// Нижняя панель управления симуляцией:
// Play/Pause | Step (только в pause) | Reset | Re-roll | Speed × | TPS slider

import { useTheme } from '@theme/ThemeProvider';
import { useAppState } from '@state/AppStateProvider';
import { Button } from '@ui/Button';
import { Slider } from '@ui/Slider';
import { Eyebrow } from '@ui/Eyebrow';

interface TransportBarProps {
  onStep: () => void;
  /** Передаётся снаружи чтобы при Run прошла валидация (2+ игроков, муравьи). */
  onRun: () => void;
}

const SPEED_MULTIPLIERS = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64];

export function TransportBar({ onStep, onRun }: TransportBarProps) {
  const { tokens: T } = useTheme();
  const { state, sandbox: sx } = useAppState();
  const cfg = state.sandbox;
  const rt = state.sandboxRuntime;
  const inEdit = rt.mode === 'edit';
  const effectiveTps = Math.round(cfg.baseTps * cfg.speedMultiplier);

  return (
    <div style={{
      height: 68, padding: '0 24px',
      display: 'flex', alignItems: 'center', gap: 14,
      borderTop: `1px solid ${T.border}`,
      background: T.bgElevated,
      flexShrink: 0,
    }}>
      {/* Play / Pause */}
      <Button
        size="md"
        onClick={() => {
          if (inEdit) {
            onRun();
          } else {
            sx.setPaused(!rt.paused);
          }
        }}
      >
        {inEdit ? '▶ Run' : (rt.paused ? '▶ Play' : '⏸ Pause')}
      </Button>

      {/* Step — только в pause */}
      <Button
        variant="ghost"
        size="md"
        onClick={onStep}
        disabled={!rt.paused}
        style={{ opacity: rt.paused ? 1 : 0.4 }}
      >⏭ Step</Button>

      {/* Reset / Re-roll */}
      <div style={{ width: 1, height: 28, background: T.border }} />
      <Button variant="ghost" size="md" onClick={() => sx.resetWithSameSeed()}>
        ↺ Reset
      </Button>
      <Button variant="ghost" size="md" onClick={() => sx.reseed()}>
        ⟳ Re-roll
      </Button>
      <span style={{ fontSize: 11, color: T.textDim, fontFamily: 'JetBrains Mono, monospace' }}>
        seed: {cfg.seed}
      </span>

      {/* Speed multipliers */}
      <div style={{ width: 1, height: 28, background: T.border }} />
      <Eyebrow>speed</Eyebrow>
      <div style={{ display: 'flex', gap: 3 }}>
        {SPEED_MULTIPLIERS.map((m) => (
          <button
            key={m}
            onClick={() => sx.patchSandbox({ speedMultiplier: m })}
            style={{
              padding: '5px 8px', minWidth: 36,
              borderRadius: T.radiusSm,
              background: cfg.speedMultiplier === m ? T.accent : T.bgOverlay,
              color: cfg.speedMultiplier === m ? T.bg : T.textPrimary,
              border: `1px solid ${T.border}`,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10, fontWeight: 600,
              cursor: 'pointer',
            }}
          >{m}×</button>
        ))}
      </div>

      {/* TPS slider */}
      <div style={{ width: 1, height: 28, background: T.border }} />
      <div style={{ flex: 1, maxWidth: 240, minWidth: 140 }}>
        <Slider
          value={cfg.baseTps} min={1} max={60}
          onChange={(v) => sx.patchSandbox({ baseTps: Math.round(v) })}
          label="Base TPS"
          suffix={` · effective ${effectiveTps}`}
        />
      </div>

      {/* Reset config */}
      <Button variant="ghost" size="sm" onClick={() => sx.resetSandbox()} style={{ marginLeft: 'auto' }}>
        Reset all
      </Button>
    </div>
  );
}
