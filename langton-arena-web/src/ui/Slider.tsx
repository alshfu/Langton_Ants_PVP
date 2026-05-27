// src/ui/Slider.tsx
// Простой range-input в стиле проекта.

import { useTheme } from '@theme/ThemeProvider';

export function Slider({
  value, min, max, step = 1, onChange, label, suffix,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label?: string;
  suffix?: string;
}) {
  const { tokens: T } = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: 11, color: T.textMuted, fontFamily: 'JetBrains Mono, monospace',
        }}>
          <span>{label}</span>
          <span>{value}{suffix ?? ''}</span>
        </div>
      )}
      <input type="range" min={min} max={max} step={step} value={value}
        aria-label={label ?? 'value'}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ accentColor: T.accent, width: '100%' }} />
    </div>
  );
}
