// src/components/HeatmapLegend.tsx
//
// Мини-шкала рядом с канвасом когда heatmap включён. Показывает диапазон
// цветов и текущий max value.

import { useTheme } from '@theme/ThemeProvider';
import { heatmapLegendStops, type HeatmapType } from '@lib/heatmapColors';

interface HeatmapLegendProps {
  type: HeatmapType;
  maxValue: number;
  /** Подпись режима: "Deaths heatmap" / "Captures heatmap" etc. */
  label: string;
}

export function HeatmapLegend({ type, maxValue, label }: HeatmapLegendProps) {
  const { tokens: T } = useTheme();
  const stops = heatmapLegendStops(type);

  // CSS gradient из stops
  const gradient = stops
    .map(({ t, rgb }) => `rgb(${rgb[0]},${rgb[1]},${rgb[2]}) ${(t * 100).toFixed(0)}%`)
    .join(', ');

  return (
    <div style={{
      position: 'absolute',
      bottom: 10, left: 10,
      padding: '6px 10px',
      background: T.bgElevated + 'EE',
      border: `1px solid ${T.border}`,
      borderRadius: T.radiusSm,
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 9,
      color: T.textPrimary,
      pointerEvents: 'none',
      boxShadow: '0 2px 12px rgba(0,0,0,.4)',
    }}>
      <div style={{ marginBottom: 4, color: T.textMuted, letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{
        width: 120, height: 8,
        background: `linear-gradient(to right, ${gradient})`,
        borderRadius: 2,
        marginBottom: 2,
      }}/>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        color: T.textDim,
      }}>
        <span>0</span>
        <span>max {maxValue.toLocaleString()}</span>
      </div>
    </div>
  );
}
