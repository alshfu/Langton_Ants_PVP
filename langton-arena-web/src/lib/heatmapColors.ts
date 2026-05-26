// src/lib/heatmapColors.ts
//
// Цветовые шкалы для heatmap overlay. Каждая шкала принимает значение [0..1]
// и возвращает [r, g, b] компоненты для использования в canvas fillStyle.
//
// Палитры:
//  - deaths: чёрный → красный → жёлтый (хот-зоны смертей)
//  - captures: тёмно-синий → зелёный → светло-зелёный (продуктивные зоны)
//  - contested: фиолетовый → оранжевый → белый (зоны столкновений)

export type HeatmapType = 'deaths' | 'captures' | 'contested';

/** Линейная интерполяция между двумя цветами. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

interface ColorStop {
  t: number;
  r: number;
  g: number;
  b: number;
}

const PALETTES: Record<HeatmapType, ColorStop[]> = {
  // Deaths: чёрный → тёмно-красный → красный → оранжевый → жёлтый
  deaths: [
    { t: 0.00, r: 20,  g: 0,   b: 0   },
    { t: 0.30, r: 120, g: 20,  b: 0   },
    { t: 0.55, r: 220, g: 40,  b: 30  },
    { t: 0.80, r: 250, g: 130, b: 30  },
    { t: 1.00, r: 255, g: 230, b: 60  },
  ],
  // Captures: тёмно-синий → циан → зелёный → светло-зелёный
  captures: [
    { t: 0.00, r: 0,   g: 20,  b: 60  },
    { t: 0.35, r: 0,   g: 100, b: 130 },
    { t: 0.65, r: 30,  g: 200, b: 100 },
    { t: 1.00, r: 180, g: 255, b: 150 },
  ],
  // Contested: фиолетовый → пурпурный → оранжевый → белый
  contested: [
    { t: 0.00, r: 40,  g: 0,   b: 60  },
    { t: 0.35, r: 130, g: 30,  b: 150 },
    { t: 0.65, r: 230, g: 120, b: 60  },
    { t: 1.00, r: 255, g: 255, b: 240 },
  ],
};

/**
 * Получить RGB цвет для значения [0..1] из палитры.
 * Возвращает [r, g, b] в [0..255].
 */
export function heatmapColor(type: HeatmapType, value: number): [number, number, number] {
  const stops = PALETTES[type];
  const v = Math.max(0, Math.min(1, value));

  // Найти диапазон stops для интерполяции
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    if (v >= a.t && v <= b.t) {
      const range = b.t - a.t;
      const t = range === 0 ? 0 : (v - a.t) / range;
      return [
        Math.round(lerp(a.r, b.r, t)),
        Math.round(lerp(a.g, b.g, t)),
        Math.round(lerp(a.b, b.b, t)),
      ];
    }
  }
  // Fallback: последний stop
  const last = stops[stops.length - 1]!;
  return [last.r, last.g, last.b];
}

/**
 * Цвета для legend (5 контрольных точек).
 */
export function heatmapLegendStops(type: HeatmapType): Array<{ t: number; rgb: [number, number, number] }> {
  return [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    t,
    rgb: heatmapColor(type, t),
  }));
}
