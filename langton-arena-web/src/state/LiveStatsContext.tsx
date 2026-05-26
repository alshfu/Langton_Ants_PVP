// src/state/LiveStatsContext.tsx
//
// Контекст для live-статистики симуляции.
//
// Stage 4: добавлен getHeatmapData — геттер для heatmap-grids. Heatmap НЕ часть
// state (обновляется на каждом event сотни раз в секунду), а отдельный
// канал через функцию-аксессор. UI вызывает её в момент рендера.

import React, { createContext, useContext } from 'react';
import type { SandboxLiveStats } from '@core/contract/state';

export interface HeatmapData {
  w: number;
  h: number;
  deaths: Uint32Array;
  captures: Uint32Array;
  contested: Uint32Array;
  maxDeaths: number;
  maxCaptures: number;
  maxContested: number;
}

interface LiveStatsValue {
  stats: SandboxLiveStats;
  getHeatmapData: () => HeatmapData | null;
}

const LiveStatsContext = createContext<LiveStatsValue | null>(null);

export function LiveStatsProvider({
  value,
  getHeatmapData,
  children,
}: {
  value: SandboxLiveStats;
  getHeatmapData: () => HeatmapData | null;
  children: React.ReactNode;
}) {
  return (
    <LiveStatsContext.Provider value={{ stats: value, getHeatmapData }}>
      {children}
    </LiveStatsContext.Provider>
  );
}

export function useLiveStats(): SandboxLiveStats {
  const ctx = useContext(LiveStatsContext);
  if (!ctx) {
    return {
      tick: 0,
      perPlayer: {},
      territoryHistory: [],
      totals: { births: 0, deaths: 0, captures: 0, clashes: 0, hybrids: 0, wilds: 0 },
      events: [],
      highlights: [],
    };
  }
  return ctx.stats;
}

/** Получить функцию-геттер heatmap-данных. */
export function useHeatmapGetter(): () => HeatmapData | null {
  const ctx = useContext(LiveStatsContext);
  if (!ctx) return () => null;
  return ctx.getHeatmapData;
}
