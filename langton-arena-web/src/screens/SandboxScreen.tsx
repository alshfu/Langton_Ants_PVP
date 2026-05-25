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

import { useMemo, useState, useCallback } from 'react';
import { useTheme } from '@theme/ThemeProvider';
import { useT } from '@i18n/I18nProvider';
import { useAppState } from '@state/AppStateProvider';
import { LangtonField } from '@components/LangtonField';
import { LA_RULES } from '@core/langton/rules';
import { Button } from '@ui/Button';
import { Eyebrow } from '@ui/Eyebrow';
import { Chip } from '@ui/Chip';

import type { Ant, BirthConfig, SimState, StepEvents } from '@core/langton/engine';
import { TabStrip, type SandboxTabId } from './sandbox/TabStrip';
import { PlayersTab } from './sandbox/PlayersTab';
import { AntsTab } from './sandbox/AntsTab';
import { FieldTab } from './sandbox/FieldTab';
import { CombatTab } from './sandbox/CombatTab';
import { BirthTab } from './sandbox/BirthTab';
import { VisualTab } from './sandbox/VisualTab';
import { PresetsTab } from './sandbox/PresetsTab';
import { TransportBar } from './sandbox/TransportBar';

export function SandboxScreen() {
  const { tokens: T } = useTheme();
  const t = useT();
  const { state, setScreen, sandbox: sx } = useAppState();
  const cfg = state.sandbox;
  const rt = state.sandboxRuntime;

  const [activeTab, setActiveTab] = useState<SandboxTabId>('presets');
  const [statsTick, setStatsTick] = useState(0);
  const [stepSignal, setStepSignal] = useState(0);
  const [toast, setToast] = useState<{ text: string; kind: 'info' | 'warn' | 'err' } | null>(null);

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

  const birthConfig: BirthConfig | null = useMemo(() => {
    if (!cfg.birthEnabled) return null;
    return {
      enabled: true,
      minNeighbors:     cfg.birthMinNeighbors,
      cooldownTicks:    cfg.birthCooldownTicks,
      maxAntsPerPlayer: cfg.maxAntsPerPlayer,
      hybridChance:     cfg.hybridChance,
      wildChance:       cfg.wildBirthChance,
    };
  }, [cfg.birthEnabled, cfg.birthMinNeighbors, cfg.birthCooldownTicks, cfg.maxAntsPerPlayer, cfg.hybridChance, cfg.wildBirthChance]);

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
  }, [statsTick, sx]);

  const onStep = useCallback(() => {
    if (rt.mode === 'edit') {
      const check = validateBeforeRun();
      if (!check.ok) {
        showToast(check.reason ?? 'Cannot step', 'warn');
        return;
      }
      // Step из edit: переключаемся в run + pause, делаем шаг
      sx.setMode('run');
      sx.setPaused(true);
    }
    setStepSignal((n) => n + 1);
  }, [rt.mode, validateBeforeRun, sx, showToast]);

  const onEvents = (_ev: StepEvents) => { /* День 4: live stats */ };
  const onTick = (sim: SimState) => {
    if (sim.tick % 5 === 0) setStatsTick(sim.tick);
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'players': return <PlayersTab />;
      case 'ants':    return <AntsTab />;
      case 'field':   return <FieldTab />;
      case 'combat':  return <CombatTab />;
      case 'birth':   return <BirthTab />;
      case 'visual':  return <VisualTab />;
      case 'presets': return <PresetsTab />;
    }
  };

  return (
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
              w={cfg.width}
              h={cfg.height}
              cellSize={cellSize}
              ants={engineAnts}
              palette={palette}
              tps={effectiveTps}
              paused={rt.mode === 'edit' || rt.paused}
              glow={cfg.showGlow}
              showTrail={cfg.showTrails}
              showHpDots={cfg.showHpDots}
              showDirectionArrows={cfg.showDirectionArrows}
              showGrid={cfg.showGrid}
              antScale={cfg.antScale}
              bg={cfg.bgColor}
              seed={cfg.seed}
              collisionCooldownTicks={cfg.collisionCooldownTicks}
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
      <TransportBar onStep={onStep} onRun={switchToRun} />
    </div>
  );
}
