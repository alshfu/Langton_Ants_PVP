// src/ui/Toggle.tsx
import { useTheme } from '@theme/ThemeProvider';

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  const { tokens: T } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {label && <span style={{ fontSize: 11, color: T.textMuted, fontFamily: 'JetBrains Mono, monospace' }}>{label}</span>}
      <button
        onClick={() => onChange(!on)}
        aria-pressed={on}
        style={{
          width: 36, height: 20, borderRadius: 10,
          background: on ? T.accent : T.bgOverlay,
          border: `1px solid ${T.border}`,
          position: 'relative', cursor: 'pointer', padding: 0,
        }}
      >
        <span style={{
          position: 'absolute', left: on ? 18 : 2, top: 1,
          width: 16, height: 16, borderRadius: 8,
          background: on ? T.bg : T.textMuted,
          transition: 'left .15s',
        }}/>
      </button>
    </div>
  );
}
