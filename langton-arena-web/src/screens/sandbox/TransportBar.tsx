// src/screens/sandbox/TransportBar.tsx
//
// Нижняя панель управления:
// Play/Pause | Step controls (−N / +1 / +5 / +N с custom) | Reset / Re-roll | Speed | TPS

import { useState } from 'react';
import { useTheme } from '@theme/ThemeProvider';
import { useAppState } from '@state/AppStateProvider';
import { Button } from '@ui/Button';
import { Slider } from '@ui/Slider';
import { Eyebrow } from '@ui/Eyebrow';

interface TransportBarProps {
  /** Шаг вперёд на N тиков (1 — обычный, можно больше). */
  onStep: (n: number) => void;
  /** Шаг назад на N тиков (опционально, может быть undefined если не поддерживается). */
  onStepBack?: (n: number) => void;
  /** Канонический "Run" — для перехода из edit. */
  onRun: () => void;
  /** Доступно ли двигаться назад (есть ли snapshots). */
  canStepBack?: boolean;
  /** Stage 6: размер мешка активного игрока (для disabled/enabled Deploy). */
  activeReserve?: number;
}

const SPEED_MULTIPLIERS = [0.25, 0.5, 1, 2, 4, 8, 16, 32, 64];

export function TransportBar({
  onStep, onStepBack, onRun, canStepBack = false, activeReserve = 0,
}: TransportBarProps) {
  const { tokens: T } = useTheme();
  const { state, sandbox: sx } = useAppState();
  const cfg = state.sandbox;
  const rt = state.sandboxRuntime;
  const inEdit = rt.mode === 'edit';
  const effectiveTps = Math.round(cfg.baseTps * cfg.speedMultiplier);

  const [customStep, setCustomStep] = useState<string>('100');
  const parsedCustom = Math.max(1, Math.min(10000, parseInt(customStep, 10) || 100));

  const stepBtnStyle: React.CSSProperties = {
    padding: '6px 10px', minWidth: 44,
    borderRadius: T.radiusSm,
    background: T.bgOverlay, color: T.textPrimary,
    border: `1px solid ${T.border}`,
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 11, fontWeight: 600,
    cursor: 'pointer',
  };
  const disabledOpacity = !rt.paused ? { opacity: 0.4, cursor: 'not-allowed' as const } : {};

  return (
    <div style={{
      height: 72, padding: '0 24px',
      display: 'flex', alignItems: 'center', gap: 12,
      borderTop: `1px solid ${T.border}`,
      background: T.bgElevated,
      flexShrink: 0,
    }}>
      {/* Play / Pause */}
      <Button
        size="md"
        onClick={() => {
          if (inEdit) onRun();
          else sx.setPaused(!rt.paused);
        }}
      >
        {inEdit ? '▶ Run' : (rt.paused ? '▶ Play' : '⏸ Pause')}
      </Button>

      {/* Step controls — только в pause */}
      <div style={{ width: 1, height: 28, background: T.border }} />
      <Eyebrow>step</Eyebrow>

      <div style={{ display: 'flex', gap: 3 }}>
        {/* Back custom */}
        <button
          onClick={() => onStepBack?.(parsedCustom)}
          disabled={!rt.paused || !canStepBack}
          title={canStepBack ? `Back ${parsedCustom} ticks` : 'No history available'}
          style={{
            ...stepBtnStyle,
            ...(!rt.paused || !canStepBack ? { opacity: 0.3, cursor: 'not-allowed' as const } : {}),
          }}
        >−{parsedCustom}</button>

        {/* Back 1 */}
        <button
          onClick={() => onStepBack?.(1)}
          disabled={!rt.paused || !canStepBack}
          style={{
            ...stepBtnStyle,
            minWidth: 36,
            ...(!rt.paused || !canStepBack ? { opacity: 0.3, cursor: 'not-allowed' as const } : {}),
          }}
        >−1</button>

        {/* Forward 1 */}
        <button
          onClick={() => onStep(1)}
          disabled={!rt.paused}
          style={{
            ...stepBtnStyle,
            minWidth: 36,
            ...disabledOpacity,
          }}
        >+1</button>

        {/* Forward 5 */}
        <button
          onClick={() => onStep(5)}
          disabled={!rt.paused}
          style={{ ...stepBtnStyle, minWidth: 36, ...disabledOpacity }}
        >+5</button>

        {/* Forward custom */}
        <button
          onClick={() => onStep(parsedCustom)}
          disabled={!rt.paused}
          style={stepBtnStyle}
        >+{parsedCustom}</button>

        {/* Custom value input */}
        <input
          type="number"
          min={1}
          max={10000}
          value={customStep}
          onChange={(e) => setCustomStep(e.target.value)}
          disabled={!rt.paused}
          aria-label="Custom step count"
          title="Custom step count"
          style={{
            width: 56, padding: '4px 6px',
            background: T.bg, color: T.textPrimary,
            border: `1px solid ${T.border}`,
            borderRadius: T.radiusSm,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            ...disabledOpacity,
          }}
        />
      </div>

      {/* Stage 6: Deploy button — только если reserveMode включён */}
      {cfg.reserveMode && (
        <>
          <div style={{ width: 1, height: 28, background: T.border }} />
          <button
            onClick={() => {
              if (activeReserve === 0) return; // toast делает caller
              sx.setDeployMode(!rt.deployMode);
            }}
            disabled={inEdit || activeReserve === 0}
            title={
              inEdit ? 'Deploy works only in Run mode'
              : activeReserve === 0 ? 'No ants in reserve'
              : rt.deployMode ? 'Click again to exit Deploy mode'
              : `Deploy mode — ${activeReserve} ants in bag`
            }
            style={{
              padding: '6px 12px',
              borderRadius: T.radiusSm,
              background: rt.deployMode ? '#C77DFF' : T.bgOverlay,
              color: rt.deployMode ? '#000' : T.textPrimary,
              border: `1px solid ${rt.deployMode ? '#C77DFF' : T.border}`,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11, fontWeight: 700,
              cursor: (inEdit || activeReserve === 0) ? 'not-allowed' : 'pointer',
              opacity: (inEdit || activeReserve === 0) ? 0.5 : 1,
            }}
          >
            📦 {rt.deployMode ? `Deploying (${activeReserve})` : `Deploy (${activeReserve})`}
          </button>
        </>
      )}

      {/* Reset / Re-roll */}
      <div style={{ width: 1, height: 28, background: T.border }} />
      <Button variant="ghost" size="sm" onClick={() => sx.resetWithSameSeed()}>
        ↺ Reset
      </Button>
      <Button variant="ghost" size="sm" onClick={() => sx.reseed()}>
        ⟳ Re-roll
      </Button>
      <span style={{ fontSize: 10, color: T.textDim, fontFamily: 'JetBrains Mono, monospace' }}>
        seed: {cfg.seed}
      </span>

      {/* Speed multipliers */}
      <div style={{ width: 1, height: 28, background: T.border }} />
      <Eyebrow>×</Eyebrow>
      <div style={{ display: 'flex', gap: 2 }}>
        {SPEED_MULTIPLIERS.map((m) => (
          <button
            key={m}
            onClick={() => sx.patchSandbox({ speedMultiplier: m })}
            style={{
              padding: '4px 6px', minWidth: 32,
              borderRadius: T.radiusSm,
              background: cfg.speedMultiplier === m ? T.accent : T.bgOverlay,
              color: cfg.speedMultiplier === m ? T.bg : T.textPrimary,
              border: `1px solid ${T.border}`,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10, fontWeight: 600,
              cursor: 'pointer',
            }}
          >{m}</button>
        ))}
      </div>

      {/* TPS slider */}
      <div style={{ width: 1, height: 28, background: T.border }} />
      <div style={{ flex: 1, maxWidth: 200, minWidth: 120 }}>
        <Slider
          value={cfg.baseTps} min={1} max={60}
          onChange={(v) => sx.patchSandbox({ baseTps: Math.round(v) })}
          label="TPS"
          suffix={` · ${effectiveTps}`}
        />
      </div>

      <Button variant="ghost" size="sm" onClick={() => sx.resetSandbox()} style={{ marginLeft: 'auto' }}>
        Reset all
      </Button>
    </div>
  );
}
