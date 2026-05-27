// src/screens/SandboxScreen.tsx
//
// Главный экран Sandbox v2 — Day 3 (финал этапа 1).
//
// Layout: top bar | (canvas | tab strip | tab content) | transport bar.
//
// Edit mode:
//   - Клик ЛКМ → addAnt активного игрока (или select если на муравье)
//   - Shift+клик → removeAnt
//   - Колесо → крутит направление муравья под курсором
//   - ПКМ → поворот на 90° по часовой
//
// Run mode:
//   - Симуляция тикает
//   - Клик по канвасу — не делает ничего (для отладки в будущем — выделять)
//
// Валидация перед Run:
//   - Минимум 2 игрока
//   - Минимум 1 муравей у каждого игрока
//   - Иначе показываем toast и не запускаем

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useTheme } from '@theme/ThemeProvider';
import { useT } from '@i18n/I18nProvider';
import { useAppState } from '@state/AppStateProvider';
import { LangtonField } from '@components/LangtonField';
import { HeatmapLegend } from '@components/HeatmapLegend';
import { LA_RULES } from '@core/langton/rules';
import { PLAYER_PALETTE } from '@core/shared/constants';
import { Button } from '@ui/Button';
import { Eyebrow } from '@ui/Eyebrow';
import { Chip } from '@ui/Chip';

import type { Ant, BirthConfig, SimState, StepEvents } from '@core/langton/engine';
import type { SandboxLiveStats, PlayerLiveStats, LogEvent, SandboxConfig } from '@core/contract/state';
import type { DeployAction, Replay } from '@core/contract/replay';
import { saveReplay, loadReplay, generateReplayId } from '@lib/replayStorage';
import { TabStrip, type SandboxTabId } from './sandbox/TabStrip';
import { PlayersTab } from './sandbox/PlayersTab';
import { AntsTab } from './sandbox/AntsTab';
import { FieldTab } from './sandbox/FieldTab';
import { CombatTab } from './sandbox/CombatTab';
import { BirthTab } from './sandbox/BirthTab';
import { VisualTab } from './sandbox/VisualTab';
import { PresetsTab } from './sandbox/PresetsTab';
import { ReplaysTab } from './sandbox/ReplaysTab';
import { StatsTab } from './sandbox/StatsTab';
import { EventsTab } from './sandbox/EventsTab';
import { MutationsTab } from './sandbox/MutationsTab';
import { TransportBar } from './sandbox/TransportBar';
import { LiveStatsProvider } from '@state/LiveStatsContext';
import { computeCellCountsByOwner, computeAliveAntsByOwner } from '@lib/computeStats';
import { computeAllHighlights } from '@lib/computeHighlights';
import { computeMatchResult } from '@lib/computeMatchResult';
import { canDeploy } from '@lib/deployValidation';
import { MatchBanner } from '@components/MatchBanner';

// ─── Stage 7.4: Media controls subcomponents ─────────────────────────────────

function MediaControlGroup({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '2px 4px',
      background: 'rgba(255,255,255,0.04)',
      borderRadius: 6,
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {children}
    </div>
  );
}

function MediaButton({
  onClick, title, color, children,
}: {
  onClick: () => void;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        padding: '3px 8px', minWidth: 30,
        background: 'transparent',
        color,
        border: `1px solid ${color}`,
        borderRadius: 4,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11, fontWeight: 700,
        cursor: 'pointer',
        transition: 'background .15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = color + '20'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

export function SandboxScreen() {
  const { tokens: T } = useTheme();
  const t = useT();
  const { state, setScreen, sandbox: sx } = useAppState();
  const cfg = state.sandbox;
  const rt = state.sandboxRuntime;

  const [activeTab, setActiveTab] = useState<SandboxTabId>('presets');
  const [statsTick, setStatsTick] = useState(0);
  const [aliveCount, setAliveCount] = useState(0);
  const [stepSignal, setStepSignal] = useState(0);
  const [toast, setToast] = useState<{ text: string; kind: 'info' | 'warn' | 'err' } | null>(null);

  // ─── Live Stats ─────────────────────────────────────────────────────────
  // counters накапливаются на каждый event без re-render'ов.
  // liveStats обновляется только каждые 5 тиков, чтобы не дёргать UI слишком часто.
  const counters = useRef({
    perPlayer: new Map<string, PlayerLiveStats>(),
    totals: { births: 0, deaths: 0, captures: 0, clashes: 0, hybrids: 0, wilds: 0, mutants: 0 },
  });

  const emptyPlayerStats = (): PlayerLiveStats => ({
    alive: 0, born: 0, lost: 0, captures: 0, kills: 0,
    territoryPct: 0, cellsOwned: 0,
    mutants: 0, mutantsAlive: 0,
    reserve: 0,
  });

  const resetCounters = useCallback(() => {
    counters.current.perPlayer = new Map();
    cfg.players.forEach((p) => counters.current.perPlayer.set(p.id, emptyPlayerStats()));
    counters.current.totals = { births: 0, deaths: 0, captures: 0, clashes: 0, hybrids: 0, wilds: 0, mutants: 0 };
  }, [cfg.players]);

  const emptyMatch = (): SandboxLiveStats['match'] => ({
    finished: false,
    winnerId: null,
    winnerName: null,
    reason: '',
    finishedAtTick: 0,
    bannerVisible: false,
  });

  const [liveStats, setLiveStats] = useState<SandboxLiveStats>(() => ({
    tick: 0,
    perPlayer: {},
    territoryHistory: [],
    totals: { births: 0, deaths: 0, captures: 0, clashes: 0, hybrids: 0, wilds: 0, mutants: 0 },
    events: [],
    highlights: [],
    match: emptyMatch(),
  }));

  // Stage 4: events + heatmap в refs (часто меняются, не должны re-render всё)
  const eventsRef = useRef<LogEvent[]>([]);
  const eventIdCounter = useRef(0);
  const heatmapRef = useRef({
    w: 0, h: 0,
    deaths: new Uint32Array(0),
    captures: new Uint32Array(0),
    contested: new Uint32Array(0),
    maxDeaths: 0,
    maxCaptures: 0,
    maxContested: 0,
  });
  const firstDeathRef = useRef<LogEvent | null>(null); // кэшируем для highlight
  // Stage 6: мешки муравьёв (key = playerIdx)
  const reserveRef = useRef<Map<number, Ant[]>>(new Map());

  // Stage 7: запись deploy actions в текущей сессии (для replay).
  // Always-on в Run mode, очищается при switchToRun / switchToEdit.
  const replayDeploysRef = useRef<DeployAction[]>([]);
  // Конфиг на момент старта Run mode — чтобы при сохранении replay
  // знать с какого setup'а игра началась (а не с изменённого "на ходу").
  const replayStartConfigRef = useRef<SandboxConfig | null>(null);
  // Stage 7: playback — pre-indexed inputs по тикам для O(1) lookup в onTick.
  const playbackInputsByTickRef = useRef<Map<number, DeployAction[]>>(new Map());
  // Stage 7.4: trigger re-render счётчика deploys в media controls top-bar.
  const [recordedCount, setRecordedCount] = useState(0);

  // Инициализация счётчиков при изменении списка игроков
  useEffect(() => {
    resetCounters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.players.length]);

  // Stage 4: переинициализация heatmap при смене размера поля
  useEffect(() => {
    const total = cfg.width * cfg.height;
    heatmapRef.current = {
      w: cfg.width, h: cfg.height,
      deaths: new Uint32Array(total),
      captures: new Uint32Array(total),
      contested: new Uint32Array(total),
      maxDeaths: 0, maxCaptures: 0, maxContested: 0,
    };
  }, [cfg.width, cfg.height]);

  const showToast = useCallback((text: string, kind: 'info' | 'warn' | 'err' = 'info') => {
    setToast({ text, kind });
    setTimeout(() => setToast(null), 2800);
  }, []);

  // Конвертация SandboxAntConfig[] → Ant[] для движка
  const engineAnts = useMemo<Ant[]>(() => {
    const list: Ant[] = [];
    cfg.players.forEach((p, pi) => {
      const playerRule = LA_RULES[p.ruleId] ?? LA_RULES.classic!;
      p.ants.forEach((a) => {
        const rule = a.ruleOverride ? (LA_RULES[a.ruleOverride] ?? playerRule) : playerRule;
        list.push({
          id: a.id,
          owner: pi,
          x: a.x,
          y: a.y,
          dir: a.dir,
          rule,
          hp: p.startHp,
          maxHp: p.startHp,
          lastDamageTick: -9999,
          bornAt: 0,
        });
      });
    });
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(cfg.players), cfg.seed]);

  const palette = useMemo(() => cfg.players.map((p) => p.color), [cfg.players]);

  /** Shapes по индексу игрока. Берётся из PLAYER_PALETTE по colorId если совпадает,
   *  иначе циклит по палитре. Это даёт «один цвет = одна форма» по умолчанию,
   *  но игрок может выбрать любой цвет — форма пойдёт по его индексу. */
  const shapes = useMemo(
    () => cfg.players.map((_, i) => PLAYER_PALETTE[i % PLAYER_PALETTE.length]!.shape),
    [cfg.players.length],
  );

  // Stage 6: callback который кладёт newborn в мешок вместо поля
  const onReserveCallback = useCallback((newAnt: Ant) => {
    const playerIdx = newAnt.owner;
    const bag = reserveRef.current.get(playerIdx) ?? [];
    bag.push(newAnt);
    reserveRef.current.set(playerIdx, bag);
  }, []);

  const birthConfig: BirthConfig | null = useMemo(() => {
    if (!cfg.birthEnabled) return null;
    return {
      enabled: true,
      minNeighbors:     cfg.birthMinNeighbors,
      cooldownTicks:    cfg.birthCooldownTicks,
      maxAntsPerPlayer: cfg.maxAntsPerPlayer,
      hybridChance:     cfg.hybridChance,
      wildChance:       cfg.wildBirthChance,
      unlimited:        cfg.unlimitedAnts,
      mutation:         cfg.mutation.enabled ? {
        haloEnabled:        cfg.mutation.haloEnabled,
        haloMinNeighbors:   cfg.mutation.haloMinNeighbors,
        mirrorEnabled:      cfg.mutation.mirrorEnabled,
        mirrorRadius:       cfg.mutation.mirrorRadius,
        pathEnabled:        cfg.mutation.pathEnabled,
        pathStraightTicks:  cfg.mutation.pathStraightTicks,
      } : undefined,
      // Stage 6: reserveMode направляет рождения в мешок
      reserveMode: cfg.reserveMode,
      onReserve:   cfg.reserveMode ? onReserveCallback : undefined,
    };
  }, [
    cfg.birthEnabled, cfg.birthMinNeighbors, cfg.birthCooldownTicks,
    cfg.maxAntsPerPlayer, cfg.hybridChance, cfg.wildBirthChance, cfg.unlimitedAnts,
    cfg.mutation.enabled, cfg.mutation.haloEnabled, cfg.mutation.haloMinNeighbors,
    cfg.mutation.mirrorEnabled, cfg.mutation.mirrorRadius,
    cfg.mutation.pathEnabled, cfg.mutation.pathStraightTicks,
    cfg.reserveMode, onReserveCallback,
  ]);

  const effectiveTps = cfg.baseTps * cfg.speedMultiplier;
  // cellSize: target canvas ≤ 800px. Большие поля (W > 250) — 1px на клетку (макро-режим).
  // Малые поля (W ≤ 50) — крупные cells вплоть до 14px.
  const cellSize = Math.max(1, Math.min(14, Math.floor(800 / Math.max(cfg.width, cfg.height))));
  const totalAnts = cfg.players.reduce((n, p) => n + p.ants.length, 0);

  // ─── Edit-mode handlers ─────────────────────────────────────────────────

  /** Найти муравья в клетке (x, y) среди ВСЕХ игроков. */
  const findAntAt = useCallback((x: number, y: number) => {
    for (const p of cfg.players) {
      for (const a of p.ants) {
        if (a.x === x && a.y === y) return { ant: a, playerId: p.id };
      }
    }
    return null;
  }, [cfg.players]);

  const onCanvasClick = useCallback((x: number, y: number, mods: { shift: boolean }) => {
    const found = findAntAt(x, y);
    if (mods.shift) {
      if (found) sx.removeAnt(found.ant.id);
      return;
    }
    if (found) {
      // Select + switch active to its owner
      sx.setActivePlayer(found.playerId);
      sx.setSelectedAnt(found.ant.id);
      return;
    }
    // Empty cell → place new ant of active player
    const activeId = rt.activePlayerId ?? cfg.players[0]?.id;
    if (!activeId) return;
    sx.addAnt(activeId, { x, y, dir: 0, ruleOverride: null });
  }, [findAntAt, sx, rt.activePlayerId, cfg.players]);

  const onCanvasContextMenu = useCallback((x: number, y: number) => {
    const found = findAntAt(x, y);
    if (!found) return;
    sx.patchAnt(found.ant.id, { dir: ((found.ant.dir + 1) & 3) as 0 | 1 | 2 | 3 });
  }, [findAntAt, sx]);

  const onCanvasWheel = useCallback((x: number, y: number, deltaY: number) => {
    const found = findAntAt(x, y);
    if (!found) return;
    const delta = deltaY > 0 ? 1 : 3; // +1 cw, -1 (=+3) ccw
    sx.patchAnt(found.ant.id, { dir: ((found.ant.dir + delta) & 3) as 0 | 1 | 2 | 3 });
  }, [findAntAt, sx]);

  // ─── Run mode validation ────────────────────────────────────────────────

  const validateBeforeRun = useCallback((): { ok: boolean; reason?: string } => {
    if (cfg.players.length < 2) {
      return { ok: false, reason: 'Need at least 2 players to run' };
    }
    const emptyPlayer = cfg.players.find((p) => p.ants.length === 0);
    if (emptyPlayer) {
      return { ok: false, reason: `${emptyPlayer.name} has no ants. Place some or change spawn pattern.` };
    }
    return { ok: true };
  }, [cfg.players]);

  const switchToRun = useCallback(() => {
    const check = validateBeforeRun();
    if (!check.ok) {
      showToast(check.reason ?? 'Cannot run', 'warn');
      return;
    }
    // Сохраняем initial snapshot (tick=0) чтобы можно было откатиться к началу
    const sim = fieldRef.current?.getSim();
    if (sim && snapshotsRef.current && sim.tick === 0) {
      snapshotsRef.current.capture(sim, reserveRef.current);
      setCanStepBack(true);
    }
    // Stage 7: reset replay recording + snapshot стартового конфига
    replayDeploysRef.current = [];
    setRecordedCount(0);
    replayStartConfigRef.current = structuredClone(cfg);
    sx.setMode('run');
    sx.setPaused(false);
  }, [validateBeforeRun, sx, showToast, cfg]);

  const switchToEdit = useCallback(() => {
    if (statsTick > 0) {
      if (!confirm('Switch to Edit will reset the simulation. Continue?')) return;
      sx.resetWithSameSeed();
    }
    sx.setMode('edit');
    setStatsTick(0);
    setAliveCount(0);
    resetCounters();
    setCanStepBack(false);
    snapshotsRef.current?.clear();
    // Stage 4 reset
    eventsRef.current = [];
    eventIdCounter.current = 0;
    firstDeathRef.current = null;
    reserveRef.current.clear(); // Stage 6 reset
    replayDeploysRef.current = [];
    setRecordedCount(0);
    const hm = heatmapRef.current;
    hm.deaths.fill(0);
    hm.captures.fill(0);
    hm.contested.fill(0);
    hm.maxDeaths = 0;
    hm.maxCaptures = 0;
    hm.maxContested = 0;
    setLiveStats({
      tick: 0,
      perPlayer: {},
      territoryHistory: [],
      totals: { births: 0, deaths: 0, captures: 0, clashes: 0, hybrids: 0, wilds: 0, mutants: 0 },
      events: [],
      highlights: [],
      match: emptyMatch(),
    });
  }, [statsTick, sx, resetCounters]);

  // Snapshot history для step back
  const snapshotsRef = useRef<import('@lib/simSnapshot').SnapshotHistory | null>(null);
  if (!snapshotsRef.current) {
    // Lazy init
    import('@lib/simSnapshot').then(({ SnapshotHistory }) => {
      snapshotsRef.current = new SnapshotHistory(50, 100);
    });
  }
  const fieldRef = useRef<import('@components/LangtonField').LangtonFieldHandle | null>(null);
  const [canStepBack, setCanStepBack] = useState(false);

  const onStep = useCallback((n: number) => {
    if (rt.mode === 'edit') {
      const check = validateBeforeRun();
      if (!check.ok) {
        showToast(check.reason ?? 'Cannot step', 'warn');
        return;
      }
      sx.setMode('run');
      sx.setPaused(true);
    }
    // Сохраняем snapshot ПЕРЕД шагом — чтобы можно было откатиться
    const sim = fieldRef.current?.getSim();
    if (sim && snapshotsRef.current) {
      snapshotsRef.current.capture(sim, reserveRef.current);
      setCanStepBack(snapshotsRef.current.hasAny);
    }
    setStepSignal((prev) => prev + n);
  }, [rt.mode, validateBeforeRun, sx, showToast]);

  const onStepBack = useCallback((n: number) => {
    const sim = fieldRef.current?.getSim();
    const history = snapshotsRef.current;
    if (!sim || !history || !history.hasAny) {
      showToast('No history to step back to', 'warn');
      return;
    }
    const targetTick = Math.max(0, sim.tick - n);
    const nearest = history.findNearest(targetTick);
    if (!nearest) {
      showToast(`Can't go back to tick ${targetTick} — no snapshot`, 'warn');
      return;
    }
    fieldRef.current?.restoreSnapshot(nearest);
    const toCatchUp = targetTick - nearest.tick;

    // Stage 6: восстанавливаем reserve из snapshot
    if (nearest.reserveCopy) {
      reserveRef.current.clear();
      nearest.reserveCopy.forEach((ants, k) => {
        reserveRef.current.set(k, ants.map((a) => ({ ...a })));
      });
      // Также пересчитываем reserve counters per-player
      cfg.players.forEach((p, pi) => {
        const stats = counters.current.perPlayer.get(p.id);
        if (stats) {
          stats.reserve = reserveRef.current.get(pi)?.length ?? 0;
        }
      });
    }

    // Обрезаем events и territoryHistory до nearest.tick
    eventsRef.current = eventsRef.current.filter((e) => e.tick <= nearest.tick);
    // Heatmap не сбрасываем — он накопительный, "история" а не "снимок".
    // Но строго говоря — следовало бы пересобрать с нуля. Простоты ради — оставим.
    // TODO Day 4: пересборка heatmap при step back из events.

    setLiveStats((prev) => ({
      ...prev,
      tick: nearest.tick,
      territoryHistory: prev.territoryHistory.filter((pt) => pt.tick <= nearest.tick),
      events: [...eventsRef.current],
    }));

    if (toCatchUp > 0) {
      setStepSignal((prev) => prev + toCatchUp);
    } else {
      setStatsTick(nearest.tick);
    }
    showToast(`← back to tick ${targetTick}`, 'info');
  }, [showToast]);

  const onEvents = useCallback((ev: StepEvents, tick: number) => {
    const c = counters.current;
    // Captures — учитываем владельцу
    for (const e of ev.captures) {
      if (e.owner < cfg.players.length) {
        const p = cfg.players[e.owner];
        if (p) {
          const stats = c.perPlayer.get(p.id);
          if (stats) stats.captures++;
        }
        c.totals.captures++;
      }
    }
    // Clashes — всегда
    c.totals.clashes += ev.collisions.length;
    // Deaths — учитываем кому умерло
    for (const e of ev.deaths) {
      if (e.owner < cfg.players.length) {
        const p = cfg.players[e.owner];
        if (p) {
          const stats = c.perPlayer.get(p.id);
          if (stats) stats.lost++;
        }
        c.totals.deaths++;
      }
    }
    // Kills через collisions
    for (const clash of ev.collisions) {
      const deadIdsInClash = new Set(
        ev.deaths.filter((d) => clash.antIds.includes(d.id)).map((d) => d.id),
      );
      if (deadIdsInClash.size === 0) continue;
      for (const id of clash.antIds) {
        if (deadIdsInClash.has(id)) continue;
        const stillAlive = ev.damage.find((d) => d.id === id) ?? null;
        if (!stillAlive) continue;
        const enemyDeaths = ev.deaths.filter(
          (d) => deadIdsInClash.has(d.id) && d.owner !== stillAlive.owner,
        ).length;
        if (enemyDeaths > 0 && stillAlive.owner < cfg.players.length) {
          const p = cfg.players[stillAlive.owner];
          if (p) {
            const stats = c.perPlayer.get(p.id);
            if (stats) stats.kills += enemyDeaths;
          }
        }
      }
    }
    // Births
    for (const e of ev.births) {
      if (e.owner < cfg.players.length) {
        const p = cfg.players[e.owner];
        if (p) {
          const stats = c.perPlayer.get(p.id);
          if (stats) {
            stats.born++;
            // Stage 6: если родился в мешок — инкремент reserve count
            if (e.reserved) stats.reserve++;
          }
        }
        c.totals.births++;
      }
      if (e.isHybrid) c.totals.hybrids++;
      if (e.isWild)   c.totals.wilds++;
    }

    // ─── Stage 4: events ring buffer + heatmap update ─────────────────────
    const evBuf = eventsRef.current;
    const hm = heatmapRef.current;
    const pushEvent = (logEv: LogEvent) => {
      evBuf.push(logEv);
      if (evBuf.length > 500) evBuf.shift();
    };

    for (const e of ev.captures) {
      pushEvent({
        id: ++eventIdCounter.current,
        tick, type: 'capture', x: e.x, y: e.y, ownerIdx: e.owner,
      });
      const idx = e.y * hm.w + e.x;
      if (idx >= 0 && idx < hm.captures.length) {
        hm.captures[idx]!++;
        if (hm.captures[idx]! > hm.maxCaptures) hm.maxCaptures = hm.captures[idx]!;
      }
    }
    for (const e of ev.collisions) {
      pushEvent({
        id: ++eventIdCounter.current,
        tick, type: 'clash', x: e.x, y: e.y, ownerIdx: -1,
        meta: { ants: e.antIds.length },
      });
      const idx = e.y * hm.w + e.x;
      if (idx >= 0 && idx < hm.contested.length) {
        hm.contested[idx]!++;
        if (hm.contested[idx]! > hm.maxContested) hm.maxContested = hm.contested[idx]!;
      }
    }
    for (const e of ev.deaths) {
      const deathEv: LogEvent = {
        id: ++eventIdCounter.current,
        tick, type: 'death', x: e.x, y: e.y, ownerIdx: e.owner,
      };
      pushEvent(deathEv);
      if (!firstDeathRef.current) firstDeathRef.current = deathEv;
      const idx = e.y * hm.w + e.x;
      if (idx >= 0 && idx < hm.deaths.length) {
        hm.deaths[idx]!++;
        if (hm.deaths[idx]! > hm.maxDeaths) hm.maxDeaths = hm.deaths[idx]!;
      }
    }
    for (const e of ev.births) {
      // Stage 6: если родился в мешок — событие 'reserve_in', не 'birth'
      const type: LogEvent['type'] = e.reserved
        ? 'reserve_in'
        : (e.isWild ? 'wild' : (e.isHybrid ? 'hybrid' : 'birth'));
      pushEvent({
        id: ++eventIdCounter.current,
        tick, type, x: e.x, y: e.y, ownerIdx: e.owner,
        meta: {
          isHybrid: e.isHybrid ?? false,
          isWild: e.isWild ?? false,
          reserved: e.reserved ?? false,
        },
      });
      // Stage 5: отдельное mutant событие если рождение породило мутанта
      // (срабатывает и для on-field, и для reserved)
      if (e.isMutant) {
        pushEvent({
          id: ++eventIdCounter.current,
          tick, type: 'mutant', x: e.x, y: e.y, ownerIdx: e.owner,
          meta: { cause: e.mutantCause ?? 'unknown' },
        });
        c.totals.mutants++;
        if (e.owner < cfg.players.length) {
          const p = cfg.players[e.owner];
          if (p) {
            const stats = c.perPlayer.get(p.id);
            if (stats) stats.mutants++;
          }
        }
      }
    }
  }, [cfg.players]);

  // Stage 7: воспроизведение одного deploy action в режиме playback.
  // Отличие от onDeployClick: не валидирует (replay уже валидный по построению),
  // не показывает toast, использует playerIdx из action а не активного игрока.
  const replayPlaybackDeploy = useCallback((action: DeployAction, sim: SimState) => {
    const bag = reserveRef.current.get(action.playerIdx);
    if (!bag || bag.length === 0) {
      console.warn('[replay] no ants in reserve at tick', sim.tick, 'for player', action.playerIdx);
      return;
    }
    const ant = bag.shift()!;
    ant.x = action.x;
    ant.y = action.y;
    ant.lastDamageTick = sim.tick - 9999;
    sim.ants.push(ant);

    // Log event
    const ev: LogEvent = {
      id: ++eventIdCounter.current,
      tick: sim.tick, type: 'deploy',
      x: action.x, y: action.y, ownerIdx: action.playerIdx,
    };
    eventsRef.current.push(ev);
    if (eventsRef.current.length > 500) eventsRef.current.shift();

    // Декремент reserve counter
    const p = cfg.players[action.playerIdx];
    if (p) {
      const stats = counters.current.perPlayer.get(p.id);
      if (stats) stats.reserve = Math.max(0, stats.reserve - 1);
    }
  }, [cfg.players]);

  const onTick = useCallback((sim: SimState) => {
    // Stage 7: в playback mode re-apply все inputs для этого тика
    if (rt.mode === 'playback') {
      const inputs = playbackInputsByTickRef.current.get(sim.tick);
      if (inputs && inputs.length > 0) {
        for (const action of inputs) {
          // Используем onDeployClick через прямой вызов (он же читает activePlayerId)
          // Но в playback playerIdx из action.playerIdx, не из rt
          // Имитируем deploy: bag.shift() + ant push на координаты
          replayPlaybackDeploy(action, sim);
        }
      }
      // Проверка конца playback — все inputs прошли + текущий тик >= finalTick
      // Здесь без авто-stop, пользователь сам нажмёт Exit
    }

    // Snapshot для step back каждые 50 тиков
    if (snapshotsRef.current) {
      snapshotsRef.current.maybeCapture(sim, reserveRef.current);
      if (snapshotsRef.current.hasAny) setCanStepBack(true);
    }

    // На каждом 5-м тике — пересчитываем territory % и пушим в state
    if (sim.tick % 5 !== 0) return;

    setStatsTick(sim.tick);
    const totalAlive = sim.ants.reduce((n, a) => n + (a.dead ? 0 : 1), 0);
    setAliveCount(totalAlive);

    const cellCounts = computeCellCountsByOwner(sim);
    const aliveByOwner = computeAliveAntsByOwner(sim);
    // Stage 5: считаем живых мутантов на игрока
    const mutantsAliveByOwner = new Map<number, number>();
    for (const a of sim.ants) {
      if (a.dead || !a.isMutant) continue;
      mutantsAliveByOwner.set(a.owner, (mutantsAliveByOwner.get(a.owner) ?? 0) + 1);
    }
    const totalCells = sim.w * sim.h;

    // Обновляем per-player stats: alive, cellsOwned, territoryPct
    const perPlayer: Record<string, PlayerLiveStats> = {};
    const historyPoint: Record<string, number> = {};

    cfg.players.forEach((p, pi) => {
      const accumulated = counters.current.perPlayer.get(p.id) ?? emptyPlayerStats();
      const cells = cellCounts[pi + 1] ?? 0;
      const pct = totalCells > 0 ? cells / totalCells : 0;
      perPlayer[p.id] = {
        ...accumulated,
        alive: aliveByOwner.get(pi) ?? 0,
        cellsOwned: cells,
        territoryPct: pct,
        mutantsAlive: mutantsAliveByOwner.get(pi) ?? 0,
      };
      historyPoint[p.id] = pct;
    });

    setLiveStats((prev) => {
      // Ring buffer 200 точек
      const nextHistory = [...prev.territoryHistory, { tick: sim.tick, byPlayer: historyPoint }];
      if (nextHistory.length > 200) nextHistory.shift();

      // Highlights пересчитываются раз в 50 тиков (компромисс свежесть/перформанс)
      let nextHighlights = prev.highlights;
      if (sim.tick % 50 === 0) {
        nextHighlights = computeAllHighlights({
          events: eventsRef.current,
          cachedFirstDeath: firstDeathRef.current,
          history: nextHistory,
          players: cfg.players.map((p) => ({ id: p.id, name: p.name })),
          heatmap: heatmapRef.current,
          currentTick: sim.tick,
        });
      }

      return {
        tick: sim.tick,
        perPlayer,
        territoryHistory: nextHistory,
        totals: { ...counters.current.totals },
        events: [...eventsRef.current],
        highlights: nextHighlights,
        // Stage 5: match update
        match: computeMatchResult({
          currentTick: sim.tick,
          winCondition: cfg.winCondition,
          perPlayer,
          players: cfg.players.map((p) => ({ id: p.id, name: p.name })),
          prevMatch: prev.match,
        }),
      };
    });
  }, [cfg.players, cfg.winCondition, rt.mode, replayPlaybackDeploy]);

  const onJumpToTick = useCallback((targetTick: number) => {
    const sim = fieldRef.current?.getSim();
    if (!sim) return;
    const delta = sim.tick - targetTick;
    if (delta <= 0) {
      showToast(`Event is in the future (t${targetTick} > now t${sim.tick})`, 'warn');
      return;
    }
    onStepBack(delta);
  }, [onStepBack, showToast]);

  // Stage 6: Deploy handlers ─────────────────────────────────────────────────
  const onDeployClick = useCallback((x: number, y: number) => {
    if (!rt.activePlayerId) {
      showToast('No active player selected', 'warn');
      return;
    }
    const playerIdx = cfg.players.findIndex((p) => p.id === rt.activePlayerId);
    if (playerIdx < 0) return;
    const sim = fieldRef.current?.getSim();
    if (!sim) return;
    const bag = reserveRef.current.get(playerIdx);
    if (!bag || bag.length === 0) {
      showToast('No ants in reserve', 'warn');
      return;
    }
    // Валидация
    const v = canDeploy(x, y, playerIdx, sim, {
      deployRule: cfg.deployRule, deployRadius: cfg.deployRadius,
    });
    if (!v.ok) {
      showToast(v.reason, 'warn');
      return;
    }
    // Достаём первого из мешка (FIFO), перемещаем на поле
    const ant = bag.shift()!;
    ant.x = x;
    ant.y = y;
    ant.lastDamageTick = sim.tick - 9999; // сброс cooldown immunity на deploy
    sim.ants.push(ant);

    // Stage 6: лог deploy event
    const tick = sim.tick;
    const ev: LogEvent = {
      id: ++eventIdCounter.current,
      tick, type: 'deploy', x, y, ownerIdx: playerIdx,
    };
    eventsRef.current.push(ev);
    if (eventsRef.current.length > 500) eventsRef.current.shift();

    // Декремент reserve counter
    const c = counters.current;
    const p = cfg.players[playerIdx];
    if (p) {
      const stats = c.perPlayer.get(p.id);
      if (stats) stats.reserve = Math.max(0, stats.reserve - 1);
    }

    // Stage 7: запись в replay timeline
    replayDeploysRef.current.push({ tick, playerIdx, x, y });
    setRecordedCount(replayDeploysRef.current.length);

    showToast(`Deployed at (${x}, ${y})`, 'info');
  }, [cfg.players, cfg.deployRule, cfg.deployRadius, rt.activePlayerId, showToast]);

  const isDeployValid = useCallback((x: number, y: number) => {
    if (!rt.activePlayerId) return false;
    const playerIdx = cfg.players.findIndex((p) => p.id === rt.activePlayerId);
    if (playerIdx < 0) return false;
    const sim = fieldRef.current?.getSim();
    if (!sim) return false;
    const v = canDeploy(x, y, playerIdx, sim, {
      deployRule: cfg.deployRule, deployRadius: cfg.deployRadius,
    });
    return v.ok;
  }, [cfg.players, cfg.deployRule, cfg.deployRadius, rt.activePlayerId]);

  // Stage 7: запуск playback с заданным replay.
  // 1. loadPreset(replay.config) — восстанавливаем начальный setup
  // 2. startPlayback action — переключает в режим 'playback'
  // 3. pre-index inputs по тикам
  // 4. В onTick проверяем и re-apply каждый deploy
  const startReplayPlayback = useCallback((replay: Replay) => {
    // Pre-index inputs by tick для O(1) lookup
    const byTick = new Map<number, DeployAction[]>();
    for (const action of replay.deployTimeline) {
      const arr = byTick.get(action.tick);
      if (arr) arr.push(action);
      else byTick.set(action.tick, [action]);
    }
    playbackInputsByTickRef.current = byTick;
    // Загружаем начальный config + запускаем playback mode
    sx.loadPreset(replay.config);
    // setTimeout — потому что loadPreset переустанавливает state asynchronously
    setTimeout(() => sx.startPlayback(replay.metadata.id, replay.metadata.name), 50);
  }, [sx]);

  // Stage 7.4: Media-controls callbacks для top-bar ─────────────────────────
  const quickSaveReplay = useCallback(() => {
    if (recordedCount === 0) {
      showToast('Nothing to save — make at least 1 deploy', 'warn');
      return;
    }
    if (!replayStartConfigRef.current) {
      showToast('No start config recorded', 'err');
      return;
    }
    const id = generateReplayId();
    const name = `Quick · t${statsTick}`;
    const replay: Replay = {
      version: 1,
      metadata: {
        id, name,
        createdAt: Date.now(),
        durationTicks: statsTick,
        deployCount: recordedCount,
      },
      config: replayStartConfigRef.current,
      deployTimeline: [...replayDeploysRef.current],
    };
    const result = saveReplay(replay);
    if (result.saved) showToast(`💾 Saved "${name}"`, 'info');
    else showToast('Save failed (storage full?)', 'err');
  }, [recordedCount, statsTick, showToast]);

  const discardRecording = useCallback(() => {
    if (recordedCount === 0) return;
    if (!confirm(`Discard ${recordedCount} recorded deploy${recordedCount === 1 ? '' : 's'}?`)) return;
    replayDeploysRef.current = [];
    setRecordedCount(0);
    showToast('Recording discarded', 'info');
  }, [recordedCount, showToast]);

  const restartCurrentPlayback = useCallback(() => {
    if (rt.mode !== 'playback' || !rt.activeReplayId) return;
    const replay = loadReplay(rt.activeReplayId);
    if (!replay) {
      showToast('Could not reload replay', 'err');
      return;
    }
    sx.stopPlayback();
    setTimeout(() => startReplayPlayback(replay), 60);
    showToast('⏮ Replay restarted', 'info');
  }, [rt.mode, rt.activeReplayId, sx, startReplayPlayback, showToast]);

  const renderTab = () => {
    switch (activeTab) {
      case 'players': return <PlayersTab />;
      case 'ants':    return <AntsTab />;
      case 'stats':   return <StatsTab onJumpTo={onJumpToTick} />;
      case 'events':  return <EventsTab onJumpTo={onJumpToTick} />;
      case 'field':   return <FieldTab />;
      case 'combat':  return <CombatTab />;
      case 'birth':     return <BirthTab />;
      case 'mutations': return <MutationsTab />;
      case 'visual':  return <VisualTab />;
      case 'presets': return <PresetsTab />;
      case 'replays': return (
        <ReplaysTab
          getCurrentSession={() => ({
            deploys: replayDeploysRef.current,
            startConfig: replayStartConfigRef.current,
            currentTick: statsTick,
          })}
          onPlay={startReplayPlayback}
          onSaveSuccess={(id) => showToast(`Saved replay (${id.slice(0, 12)}…)`, 'info')}
        />
      );
    }
  };

  const getHeatmapData = useCallback(() => heatmapRef.current, []);

  return (
    <LiveStatsProvider value={liveStats} getHeatmapData={getHeatmapData}>
    <div style={{
      width: '100vw', height: '100vh',
      background: T.bg, color: T.textPrimary,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 72, left: '50%', transform: 'translateX(-50%)',
          zIndex: 100,
          padding: '10px 16px',
          background: T.bgElevated,
          border: `1px solid ${toast.kind === 'err' ? T.danger : toast.kind === 'warn' ? T.warning : T.accent}`,
          borderRadius: T.radiusSm,
          color: T.textPrimary, fontSize: 12, fontWeight: 500,
          boxShadow: '0 6px 24px rgba(0,0,0,.5)',
        }}>{toast.text}</div>
      )}

      {/* Top bar */}
      <div style={{
        height: 56, padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${T.border}`, background: T.bgElevated,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Button variant="ghost" size="sm" onClick={() => setScreen('menu')}>
            ← {t('common.back', 'Back')}
          </Button>
          <Eyebrow>· {t('sandbox.title', 'Sandbox')}</Eyebrow>

          {/* Edit / Run toggle */}
          <div style={{
            display: 'flex',
            marginLeft: 16,
            border: `1px solid ${T.border}`,
            borderRadius: T.radiusSm,
            overflow: 'hidden',
          }}>
            <button
              onClick={switchToEdit}
              style={{
                padding: '6px 14px',
                background: rt.mode === 'edit' ? T.accent : 'transparent',
                color: rt.mode === 'edit' ? T.bg : T.textMuted,
                border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
              }}
            >✎ Edit</button>
            <button
              onClick={switchToRun}
              style={{
                padding: '6px 14px',
                background: rt.mode === 'run' ? T.accent : 'transparent',
                color: rt.mode === 'run' ? T.bg : T.textMuted,
                border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
              }}
            >▶ Run</button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Chip color={rt.paused && rt.mode === 'run' ? T.warning : rt.mode === 'edit' ? T.warning : T.success} filled size="sm">
            {rt.mode === 'edit' ? 'editing' : rt.mode === 'playback' ? 'replay' : (rt.paused ? 'paused' : 'live')}
          </Chip>
          <Chip color={T.info} size="sm">tick {statsTick.toLocaleString()}</Chip>
          <Chip color={T.accent} size="sm">{effectiveTps} TPS</Chip>
          <Chip color="#C77DFF" size="sm">{cfg.players.length}p · {totalAnts} ants</Chip>
          {aliveCount > 1000 && (
            <Chip color={T.warning} filled size="sm">⚠ {aliveCount} alive — may lag</Chip>
          )}
          {liveStats.totals.mutants > 0 && (
            <Chip color="#FFD60A" filled size="sm">🧬 {liveStats.totals.mutants} mutants</Chip>
          )}
          {/* Stage 7.4: Media controls — Recording (REC mode) */}
          {rt.mode === 'run' && recordedCount > 0 && (
            <MediaControlGroup>
              <Chip color="#FF453A" filled size="sm">
                🔴 REC · {recordedCount} deploy{recordedCount === 1 ? '' : 's'}
              </Chip>
              <MediaButton
                onClick={quickSaveReplay}
                title={`Save replay now (t${statsTick}, ${recordedCount} deploys)`}
                color={T.accent}
              >💾 Save</MediaButton>
              <MediaButton
                onClick={discardRecording}
                title="Discard current recording"
                color={T.danger}
              >🗑</MediaButton>
            </MediaControlGroup>
          )}

          {/* Stage 7.4: Media controls — Playback */}
          {rt.mode === 'playback' && rt.activeReplayName && (
            <MediaControlGroup>
              <Chip color="#FFD60A" filled size="sm">
                🎬 {rt.activeReplayName.length > 32 ? rt.activeReplayName.slice(0, 32) + '…' : rt.activeReplayName}
              </Chip>
              <MediaButton
                onClick={() => sx.setPaused(!rt.paused)}
                title={rt.paused ? 'Resume playback' : 'Pause playback'}
                color="#FFD60A"
              >{rt.paused ? '▶' : '⏸'}</MediaButton>
              <MediaButton
                onClick={restartCurrentPlayback}
                title="Restart from beginning"
                color="#FFD60A"
              >⏮</MediaButton>
              <MediaButton
                onClick={() => sx.stopPlayback()}
                title="Stop playback and return to edit mode"
                color={T.danger}
              >⏹</MediaButton>
            </MediaControlGroup>
          )}
          {/* Stage 6: reserve chip — показывается если хоть у кого-то есть в мешке */}
          {(() => {
            const counts = cfg.players.map((p) => liveStats.perPlayer[p.id]?.reserve ?? 0);
            const total = counts.reduce((s, n) => s + n, 0);
            if (total === 0) return null;
            return (
              <Chip color="#C77DFF" filled size="sm">
                📦 {counts.join('+')}
              </Chip>
            );
          })()}
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Canvas */}
        <div style={{
          flex: 1, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          padding: 20, minWidth: 0,
          position: 'relative',
        }}>
          <div style={{
            border: (() => {
              if (rt.mode === 'playback') return '2px solid #FFD60A';  // Stage 7: golden
              if (rt.deployMode) {
                const activePlayer = cfg.players.find((p) => p.id === rt.activePlayerId);
                const color = activePlayer?.color ?? '#C77DFF';
                return `2px solid ${color}`;
              }
              if (rt.mode === 'edit') return `2px solid ${T.warning}`;
              return '2px solid transparent';
            })(),
            borderRadius: T.radiusSm,
            padding: 2,
            transition: 'border-color .15s',
            position: 'relative',
            boxShadow: rt.mode === 'playback'
              ? '0 0 24px #FFD60A55'                                    // Stage 7
              : rt.deployMode
              ? `0 0 20px ${(cfg.players.find((p) => p.id === rt.activePlayerId)?.color ?? '#C77DFF')}55`
              : 'none',
          }}>
            <LangtonField
              ref={fieldRef}
              w={cfg.width}
              h={cfg.height}
              cellSize={cellSize}
              ants={engineAnts}
              palette={palette}
              shapes={shapes}
              skinPack={cfg.skinPack}
              tps={effectiveTps}
              paused={rt.mode === 'edit' || rt.paused}
              glow={cfg.showGlow}
              showTrail={cfg.showTrails}
              showHpDots={cfg.showHpDots}
              showDirectionArrows={cfg.showDirectionArrows}
              showGrid={cfg.showGrid}
              showCellState={cfg.showCellState}
              heatmapMode={cfg.heatmapMode}
              heatmapOpacity={cfg.heatmapOpacity}
              getHeatmapData={getHeatmapData}
              antScale={cfg.antScale}
              bg={cfg.bgColor}
              seed={cfg.seed}
              collisionCooldownTicks={cfg.collisionCooldownTicks}
              hpEnabled={cfg.hpEnabled}
              damageCapEnabled={cfg.damageCapEnabled}
              birthConfig={birthConfig}
              selectedAntId={rt.selectedAntId}
              editMode={rt.mode === 'edit'}
              onCellClick={onCanvasClick}
              onCellContextMenu={onCanvasContextMenu}
              onCellWheel={onCanvasWheel}
              deployMode={rt.deployMode}
              onDeployClick={onDeployClick}
              isDeployValid={isDeployValid}
              stepSignal={stepSignal}
              onEvents={onEvents}
              onTick={onTick}
            />
            {rt.mode === 'edit' && (
              <div style={{
                position: 'absolute', top: 6, left: 8,
                padding: '4px 10px',
                background: T.warning, color: '#000',
                fontSize: 10, fontWeight: 700,
                letterSpacing: 1, textTransform: 'uppercase',
                borderRadius: 3,
                fontFamily: 'JetBrains Mono, monospace',
                pointerEvents: 'none',
              }}>
                EDIT MODE · click to add · shift+click to remove · wheel/RMB to rotate
              </div>
            )}
            {rt.deployMode && (() => {
              const activePlayer = cfg.players.find((p) => p.id === rt.activePlayerId);
              const color = activePlayer?.color ?? '#C77DFF';
              const reserveCount = (() => {
                if (!rt.activePlayerId) return 0;
                const idx = cfg.players.findIndex((p) => p.id === rt.activePlayerId);
                if (idx < 0) return 0;
                return reserveRef.current.get(idx)?.length ?? 0;
              })();
              return (
                <div style={{
                  position: 'absolute', top: 6, left: 8,
                  padding: '4px 10px',
                  background: color, color: '#000',
                  fontSize: 10, fontWeight: 700,
                  letterSpacing: 1, textTransform: 'uppercase',
                  borderRadius: 3,
                  fontFamily: 'JetBrains Mono, monospace',
                  pointerEvents: 'none',
                }}>
                  📦 DEPLOY MODE · {activePlayer?.name ?? '?'} · {reserveCount} in bag · click to release
                </div>
              );
            })()}
            {cfg.heatmapMode !== 'off' && (() => {
              const hm = heatmapRef.current;
              const maxV =
                cfg.heatmapMode === 'deaths'    ? hm.maxDeaths :
                cfg.heatmapMode === 'captures'  ? hm.maxCaptures :
                cfg.heatmapMode === 'contested' ? hm.maxContested : 0;
              return (
                <HeatmapLegend
                  type={cfg.heatmapMode}
                  maxValue={maxV}
                  label={
                    cfg.heatmapMode === 'deaths'    ? 'Deaths heatmap' :
                    cfg.heatmapMode === 'captures'  ? 'Captures heatmap' :
                    'Contested zones'
                  }
                />
              );
            })()}
            <MatchBanner
              match={liveStats.match}
              onContinue={() => setLiveStats((prev) => ({
                ...prev,
                match: { ...prev.match, bannerVisible: false },
              }))}
              onReset={switchToEdit}
            />
          </div>
        </div>

        {/* Tab strip */}
        <TabStrip active={activeTab} onChange={setActiveTab} />

        {/* Tab content */}
        <div style={{
          width: 340,
          background: T.bgElevated,
          overflow: 'auto',
          padding: '20px 16px',
        }}>
          {renderTab()}
        </div>
      </div>

      {/* Transport bar */}
      <TransportBar
        onStep={onStep}
        onStepBack={onStepBack}
        onRun={switchToRun}
        canStepBack={canStepBack}
        activeReserve={(() => {
          // Stage 6: размер мешка активного игрока
          if (!rt.activePlayerId) return 0;
          const idx = cfg.players.findIndex((p) => p.id === rt.activePlayerId);
          if (idx < 0) return 0;
          return reserveRef.current.get(idx)?.length ?? 0;
        })()}
      />
    </div>
    </LiveStatsProvider>
  );
}
