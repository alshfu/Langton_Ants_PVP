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
import { LA_RULES } from '@core/langton/rules';
import { PLAYER_PALETTE } from '@core/shared/constants';
import { Button } from '@ui/Button';
import { Eyebrow } from '@ui/Eyebrow';
import { Chip } from '@ui/Chip';

import type { Ant, BirthConfig, SimState, StepEvents } from '@core/langton/engine';
import type { SandboxLiveStats, PlayerLiveStats } from '@core/contract/state';
import { TabStrip, type SandboxTabId } from './sandbox/TabStrip';
import { PlayersTab } from './sandbox/PlayersTab';
import { AntsTab } from './sandbox/AntsTab';
import { FieldTab } from './sandbox/FieldTab';
import { CombatTab } from './sandbox/CombatTab';
import { BirthTab } from './sandbox/BirthTab';
import { VisualTab } from './sandbox/VisualTab';
import { PresetsTab } from './sandbox/PresetsTab';
import { StatsTab } from './sandbox/StatsTab';
import { TransportBar } from './sandbox/TransportBar';
import { LiveStatsProvider } from '@state/LiveStatsContext';
import { computeCellCountsByOwner, computeAliveAntsByOwner } from '@lib/computeStats';

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
    totals: { births: 0, deaths: 0, captures: 0, clashes: 0, hybrids: 0, wilds: 0 },
  });

  const emptyPlayerStats = (): PlayerLiveStats => ({
    alive: 0, born: 0, lost: 0, captures: 0, kills: 0,
    territoryPct: 0, cellsOwned: 0,
  });

  const resetCounters = useCallback(() => {
    counters.current.perPlayer = new Map();
    cfg.players.forEach((p) => counters.current.perPlayer.set(p.id, emptyPlayerStats()));
    counters.current.totals = { births: 0, deaths: 0, captures: 0, clashes: 0, hybrids: 0, wilds: 0 };
  }, [cfg.players]);

  const [liveStats, setLiveStats] = useState<SandboxLiveStats>(() => ({
    tick: 0,
    perPlayer: {},
    territoryHistory: [],
    totals: { births: 0, deaths: 0, captures: 0, clashes: 0, hybrids: 0, wilds: 0 },
  }));

  // Инициализация счётчиков при изменении списка игроков
  useEffect(() => {
    resetCounters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.players.length]);

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
    };
  }, [cfg.birthEnabled, cfg.birthMinNeighbors, cfg.birthCooldownTicks, cfg.maxAntsPerPlayer, cfg.hybridChance, cfg.wildBirthChance, cfg.unlimitedAnts]);

  const effectiveTps = cfg.baseTps * cfg.speedMultiplier;
  const cellSize = Math.max(3, Math.min(14, Math.floor(800 / cfg.width)));
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
    sx.setMode('run');
    sx.setPaused(false);
  }, [validateBeforeRun, sx, showToast]);

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
    setLiveStats({
      tick: 0,
      perPlayer: {},
      territoryHistory: [],
      totals: { births: 0, deaths: 0, captures: 0, clashes: 0, hybrids: 0, wilds: 0 },
    });
  }, [statsTick, sx, resetCounters]);

  // Snapshot history для step back
  const snapshotsRef = useRef<import('@lib/simSnapshot').SnapshotHistory | null>(null);
  const fieldRef = useRef<import('@components/LangtonField').LangtonFieldHandle | null>(null);
  const [canStepBack, setCanStepBack] = useState(false);

  // Инициализируем SnapshotHistory один раз в useEffect (не в render-теле —
  // иначе StrictMode вызовет side-effect дважды и создаст лишние экземпляры).
  useEffect(() => {
    import('@lib/simSnapshot').then(({ SnapshotHistory }) => {
      if (!snapshotsRef.current) {
        snapshotsRef.current = new SnapshotHistory(50, 100);
      }
    });
  }, []);

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
      snapshotsRef.current.capture(sim);
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
    // Восстанавливаем ближайший snapshot
    fieldRef.current?.restoreSnapshot(nearest);

    // Сбрасываем event-счётчики — они накопили события из тиков
    // которых «больше нет» (будущее относительно targetTick).
    // После отката статистика начинается заново от этой точки.
    resetCounters();
    setLiveStats((prev) => ({
      ...prev,
      tick: nearest.tick,
      totals: { births: 0, deaths: 0, captures: 0, clashes: 0, hybrids: 0, wilds: 0 },
    }));

    // Если нужно — догоняем вперёд до точного tick
    const toCatchUp = targetTick - nearest.tick;
    if (toCatchUp > 0) {
      setStepSignal((prev) => prev + toCatchUp);
    } else {
      setStatsTick(nearest.tick);
    }
    showToast(`Stepped back to tick ${targetTick}`, 'info');
  }, [showToast, resetCounters]);

  const onEvents = useCallback((ev: StepEvents) => {
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
    // Deaths — учитываем кому умерло + считаем kills тем кто остался жив в этой клетке
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
    // Kills вычисляем через collisions: участники коллизии получают +1 kill за каждого
    // убитого ВРАГА в этой же клетке. Это упрощение: точнее было бы знать кто кого
    // конкретно — но для high-level статистики достаточно.
    for (const clash of ev.collisions) {
      const deadIdsInClash = new Set(
        ev.deaths.filter((d) => clash.antIds.includes(d.id)).map((d) => d.id),
      );
      if (deadIdsInClash.size === 0) continue;
      // Каждый живой участник — получает kills = deadCountOfOthers
      // (по упрощению: считаем что каждый "виновен" в общей смерти)
      // ...
      // Для MVP — считаем kill каждому живому участнику если в clash есть смерть
      const deadOwnersSet = new Set(
        ev.deaths.filter((d) => deadIdsInClash.has(d.id)).map((d) => d.owner),
      );
      for (const id of clash.antIds) {
        if (deadIdsInClash.has(id)) continue;
        // Найдём owner живого
        const stillAlive = ev.damage.find((d) => d.id === id) ?? null;
        if (!stillAlive) continue;
        // Если в clash был хотя бы один враг — этот выживший получает kill
        // (упрощение, не учитывает кто кого реально)
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
      void deadOwnersSet;
    }
    // Births
    for (const e of ev.births) {
      if (e.owner < cfg.players.length) {
        const p = cfg.players[e.owner];
        if (p) {
          const stats = c.perPlayer.get(p.id);
          if (stats) stats.born++;
        }
        c.totals.births++;
      }
      if (e.isHybrid) c.totals.hybrids++;
      if (e.isWild)   c.totals.wilds++;
    }
  }, [cfg.players]);

  const onTick = useCallback((sim: SimState) => {
    // Snapshot для step back каждые 50 тиков
    if (snapshotsRef.current) {
      snapshotsRef.current.maybeCapture(sim);
      if (snapshotsRef.current.hasAny) setCanStepBack(true);
    }

    // На каждом 5-м тике — пересчитываем territory % и пушим в state
    if (sim.tick % 5 !== 0) return;

    setStatsTick(sim.tick);
    const totalAlive = sim.ants.reduce((n, a) => n + (a.dead ? 0 : 1), 0);
    setAliveCount(totalAlive);

    const cellCounts = computeCellCountsByOwner(sim);
    const aliveByOwner = computeAliveAntsByOwner(sim);
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
      };
      historyPoint[p.id] = pct;
    });

    setLiveStats((prev) => {
      // Ring buffer 200 точек
      const nextHistory = [...prev.territoryHistory, { tick: sim.tick, byPlayer: historyPoint }];
      if (nextHistory.length > 200) nextHistory.shift();
      return {
        tick: sim.tick,
        perPlayer,
        territoryHistory: nextHistory,
        totals: { ...counters.current.totals },
      };
    });
  }, [cfg.players]);

  const renderTab = () => {
    switch (activeTab) {
      case 'players': return <PlayersTab />;
      case 'ants':    return <AntsTab />;
      case 'stats':   return <StatsTab />;
      case 'field':   return <FieldTab />;
      case 'combat':  return <CombatTab />;
      case 'birth':   return <BirthTab />;
      case 'visual':  return <VisualTab />;
      case 'presets': return <PresetsTab />;
    }
  };

  return (
    <LiveStatsProvider value={liveStats}>
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
            {rt.mode === 'edit' ? 'editing' : (rt.paused ? 'paused' : 'live')}
          </Chip>
          <Chip color={T.info} size="sm">tick {statsTick.toLocaleString()}</Chip>
          <Chip color={T.accent} size="sm">{effectiveTps} TPS</Chip>
          <Chip color="#C77DFF" size="sm">{cfg.players.length}p · {totalAnts} ants</Chip>
          {aliveCount > 1000 && (
            <Chip color={T.warning} filled size="sm">⚠ {aliveCount} alive — may lag</Chip>
          )}
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
            border: rt.mode === 'edit' ? `2px solid ${T.warning}` : '2px solid transparent',
            borderRadius: T.radiusSm,
            padding: 2,
            transition: 'border-color .15s',
            position: 'relative',
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
      />
    </div>
    </LiveStatsProvider>
  );
}
