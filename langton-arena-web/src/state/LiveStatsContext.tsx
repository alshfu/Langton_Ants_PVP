// src/state/LiveStatsContext.tsx
//
// Отдельный контекст для live-статистики симуляции.
// Не часть AppState намеренно — обновляется каждые 5 тиков (несколько раз
// в секунду), и если бы был в AppState — re-render всего дерева включая
// табы каждый раз. Локальный контекст обновляет только подписчиков.

import React, { createContext, useContext } from 'react';
import type { SandboxLiveStats } from '@core/contract/state';

const LiveStatsContext = createContext<SandboxLiveStats | null>(null);

export function LiveStatsProvider({
  value,
  children,
}: {
  value: SandboxLiveStats;
  children: React.ReactNode;
}) {
  return <LiveStatsContext.Provider value={value}>{children}</LiveStatsContext.Provider>;
}

export function useLiveStats(): SandboxLiveStats {
  const ctx = useContext(LiveStatsContext);
  if (!ctx) {
    // Возвращаем пустые stats если контекст не подключён —
    // позволяет компонентам работать вне SandboxScreen
    return {
      tick: 0,
      perPlayer: {},
      territoryHistory: [],
      totals: { births: 0, deaths: 0, captures: 0, clashes: 0, hybrids: 0, wilds: 0 },
    };
  }
  return ctx;
}
