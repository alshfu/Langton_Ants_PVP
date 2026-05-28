// src/components/LangtonField.tsx
//
// React-компонент, который рендерит симуляцию Лэнгтона на <canvas>.
//
// День 3 — добавлено:
//   - editMode: визуальная рамка + cursor crosshair + mouse interactions
//   - onCellClick / onCellShiftClick / onCellContextMenu / onCellWheel — обработка ввода
//   - showDirectionArrows — стрелки направления муравьёв
//   - selectedAntId — подсветка выбранного муравья
//   - stepSignal — внешний триггер "один тик вперёд"
//   - showGrid — линии сетки

import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  makeLangtonState,
  stepLangton,
  type SimState,
  type Ant,
  type BirthConfig,
  type StepEvents,
} from '@core/langton/engine';
import { getNeighbors } from '@langton/core';
import { drawShape } from './antShapes';
import { drawCell, getCellCenter, getCanvasSize, pixelToCell } from './gridRender';
import { getSprite, skinIdForPlayer } from '@lib/spriteLoader';
import { heatmapColor, type HeatmapType } from '@lib/heatmapColors';
import type { HeatmapData } from '@state/LiveStatsContext';

export interface LangtonFieldProps {
  w: number;
  h: number;
  cellSize: number;
  /** Stage 8 multi-grid: тип сетки клеток. Default 'square'. */
  gridType?: import('@langton/core').EngineGridType;
  ants: Array<Omit<Ant, 'maxHp' | 'lastDamageTick' | 'bornAt'> & { maxHp?: number }>;
  palette: string[];
  /** Формы по индексу игрока (для skinPack='shape'). */
  shapes?: Array<import('./antShapes').ShapeId>;
  /** Какой набор скинов использовать. */
  skinPack?: 'shape' | 'kenney';

  // Симуляция
  tps?: number;
  paused?: boolean;
  seed?: number;
  collisionCooldownTicks?: number;
  /** Stage 3: если false — HP не вычитается, муравьи неуязвимы. */
  hpEnabled?: boolean;
  /** Stage 3: если false — урон накопительный. */
  damageCapEnabled?: boolean;
  birthConfig?: BirthConfig | null;
  /** Stage 7.6: топология поля — torus / wall / bounce / void. */
  topology?: import('@core/langton/engine').Topology;

  // Визуал
  glow?: boolean;
  showTrail?: boolean;
  showHpDots?: boolean;
  showDirectionArrows?: boolean;
  showGrid?: boolean;
  /** Показывать day/night состояние клеток (state-grid поверх territory). */
  showCellState?: boolean;
  /** Stage 4: heatmap режим. 'off' — не рисуем. */
  heatmapMode?: 'off' | HeatmapType;
  /** Stage 4: прозрачность heatmap overlay [0..1]. */
  heatmapOpacity?: number;
  /** Stage 4: геттер heatmap данных. Не часть state — обновляется по ref. */
  getHeatmapData?: () => HeatmapData | null;
  antScale?: number;
  bg?: string;
  selectedAntId?: string | null;

  // Edit mode
  editMode?: boolean;
  onCellClick?: (x: number, y: number, modifiers: { shift: boolean }) => void;
  onCellContextMenu?: (x: number, y: number) => void;
  onCellWheel?: (x: number, y: number, deltaY: number) => void;
  // ── Stage 6: Deploy ──────────────────────────────────────
  /** Активен ли deploy-режим (курсор crosshair, hover-подсветка). */
  deployMode?: boolean;
  /** Click → выпустить муравья в (x, y). Caller валидирует. */
  onDeployClick?: (x: number, y: number) => void;
  /** Проверка валидности клетки для подсветки (зелёный/красный hover). */
  isDeployValid?: (x: number, y: number) => boolean;
  /** Stage 8 Day 10: ghost overlays — predicted (но ещё не подтверждённые)
   *  deploys. Render как пульсирующие translucent квадраты с цветом игрока,
   *  поверх клеток но под ant'ами. Сорочка для optimistic UI. */
  ghostDeploys?: Array<{ x: number; y: number; playerIdx: number }>;

  stepSignal?: number;
  onEvents?: (ev: StepEvents, tick: number) => void;
  onTick?: (sim: SimState) => void;
}

/**
 * Imperative API доступный извне через ref.
 * Используется для snapshot/restore при step back.
 */
export interface LangtonFieldHandle {
  /** Получить текущий SimState (ссылка, не копия). */
  getSim: () => SimState | null;
  /** Восстановить sim из snapshot. Перезаписывает все поля. */
  restoreSnapshot: (snap: import('@lib/simSnapshot').SimSnapshot) => void;
}

export const LangtonField = forwardRef<LangtonFieldHandle, LangtonFieldProps>(function LangtonField({
  w, h, cellSize, gridType = 'square', ants, palette,
  shapes, skinPack = 'shape',
  tps = 12, paused = false,
  glow = true, showTrail = true, showHpDots = false,
  showDirectionArrows = false, showGrid = false,
  showCellState = false,
  heatmapMode = 'off',
  heatmapOpacity = 0.55,
  getHeatmapData,
  antScale = 1, bg = '#0E0B1F',
  seed = 1, collisionCooldownTicks = 5,
  hpEnabled = true, damageCapEnabled = true,
  birthConfig = null,
  topology = 'torus',
  selectedAntId = null,
  editMode = false,
  onCellClick, onCellContextMenu, onCellWheel,
  deployMode = false, onDeployClick, isDeployValid, ghostDeploys,
  stepSignal = 0,
  onEvents, onTick,
}, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<SimState | null>(null);
  const trailRef = useRef<Float32Array | null>(null);
  const [, force] = useState(0);

  // (Re)build sim при смене размера/seed/состава ants/gridType
  useEffect(() => {
    simRef.current = makeLangtonState({
      w, h, ants, seed,
      collisionCooldownTicks,
      hpEnabled, damageCapEnabled,
      birthConfig,
      topology,
      gridType,
    });
    trailRef.current = new Float32Array(w * h);
    force((n) => n + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h, seed, JSON.stringify(ants), gridType]);

  // Stage 7.6: live update topology — переключение режима ощущается мгновенно
  // без reset симуляции (отдельный effect, не в deps re-build).
  useEffect(() => {
    if (simRef.current) simRef.current.topology = topology;
  }, [topology]);

  // Live параметры без пересоздания
  useEffect(() => {
    if (simRef.current) simRef.current.collisionCooldownTicks = collisionCooldownTicks;
  }, [collisionCooldownTicks]);

  useEffect(() => {
    if (simRef.current) simRef.current.hpEnabled = hpEnabled;
  }, [hpEnabled]);

  useEffect(() => {
    if (simRef.current) simRef.current.damageCapEnabled = damageCapEnabled;
  }, [damageCapEnabled]);

  useEffect(() => {
    if (simRef.current) simRef.current.birthConfig = birthConfig;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(birthConfig)]);

  // Step — внешний сигнал: разность между prev и current = количество тиков вперёд.
  // Если current < prev — игнорируется (step back делается через snapshot restore извне).
  const prevStepRef = useRef(stepSignal);
  useEffect(() => {
    const sim = simRef.current;
    const trail = trailRef.current;
    if (stepSignal !== prevStepRef.current && sim && trail) {
      const delta = stepSignal - prevStepRef.current;
      prevStepRef.current = stepSignal;
      if (delta <= 0) return;
      for (let i = 0; i < delta; i++) {
        const ev = stepLangton(sim);
        for (const c of ev.captures) {
          const idx = c.y * sim.w + c.x;
          if (idx >= 0 && idx < trail.length) trail[idx] = 1;
        }
        onEvents?.(ev, sim.tick);
        onTick?.(sim);
      }
    }
  }, [stepSignal, onEvents, onTick]);

  // Stage 6: hovered cell для подсветки в deploy mode (объявлен до rAF чтобы использоваться в draw)
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);

  // Главный rAF-цикл
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const period = 1000 / tps;

    const loop = (t: number): void => {
      raf = requestAnimationFrame(loop);
      const dt = t - last;
      last = t;
      const sim = simRef.current;
      const trail = trailRef.current;
      if (!sim || !trail) return;

      if (!paused) {
        acc += dt;
        while (acc >= period) {
          const ev = stepLangton(sim);
          for (const c of ev.captures) {
            const i = c.y * sim.w + c.x;
            if (i >= 0 && i < trail.length) trail[i] = 1;
          }
          onEvents?.(ev, sim.tick);
          onTick?.(sim);
          acc -= period;
        }
        const decay = Math.pow(0.94, dt / 16);
        for (let i = 0; i < trail.length; i++) {
          if (trail[i]! > 0.001) trail[i]! *= decay;
          else trail[i] = 0;
        }
      }

      // Stage 6: deployHover для подсветки клетки в deploy mode
      let deployHover: { x: number; y: number; valid: boolean } | null = null;
      if (deployMode && hoveredCell) {
        deployHover = {
          x: hoveredCell.x, y: hoveredCell.y,
          valid: isDeployValid ? isDeployValid(hoveredCell.x, hoveredCell.y) : true,
        };
      }

      draw(canvasRef.current, sim, trail, palette, {
        cellSize, gridType, bg, antScale, glow, showTrail, showHpDots,
        showDirectionArrows, showGrid, selectedAntId, editMode,
        showCellState, shapes, skinPack,
        heatmapMode, heatmapOpacity,
        heatmapData: getHeatmapData?.() ?? null,
        deployHover,
        ghostDeploys,
      });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tps, paused, cellSize, JSON.stringify(palette), JSON.stringify(shapes), skinPack, bg, antScale, glow, showTrail, showHpDots, showDirectionArrows, showGrid, showCellState, selectedAntId, editMode, heatmapMode, heatmapOpacity, deployMode, hoveredCell, JSON.stringify(ghostDeploys)]);

  // ─── Mouse interactions ────────────────────────────────────────────────────
  const cellFromEvent = useCallback((e: { clientX: number; clientY: number }): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    if (cssX < 0 || cssY < 0 || cssX >= rect.width || cssY >= rect.height) return null;
    // Convert CSS pixels → cell coords. Для tri/hex используется специальный maths.
    const { cssW, cssH } = getCanvasSize(w, h, cellSize, gridType);
    const pxOnCanvas = (cssX / rect.width) * cssW;
    const pyOnCanvas = (cssY / rect.height) * cssH;
    return pixelToCell(pxOnCanvas, pyOnCanvas, cellSize, gridType, w, h);
  }, [w, h, cellSize, gridType]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const cell = cellFromEvent(e);
    if (!cell) return;
    // Stage 6: deploy mode имеет приоритет над edit (edit запрещён в Run mode)
    if (deployMode && onDeployClick) {
      onDeployClick(cell.x, cell.y);
      return;
    }
    if (!editMode || !onCellClick) return;
    onCellClick(cell.x, cell.y, { shift: e.shiftKey });
  }, [editMode, onCellClick, deployMode, onDeployClick, cellFromEvent]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!deployMode) {
      if (hoveredCell !== null) setHoveredCell(null);
      return;
    }
    const cell = cellFromEvent(e);
    if (!cell) {
      if (hoveredCell !== null) setHoveredCell(null);
      return;
    }
    if (!hoveredCell || hoveredCell.x !== cell.x || hoveredCell.y !== cell.y) {
      setHoveredCell(cell);
    }
  }, [deployMode, hoveredCell, cellFromEvent]);

  const handleMouseLeave = useCallback(() => {
    if (hoveredCell !== null) setHoveredCell(null);
  }, [hoveredCell]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editMode) return;
    e.preventDefault();
    const cell = cellFromEvent(e);
    if (!cell || !onCellContextMenu) return;
    onCellContextMenu(cell.x, cell.y);
  }, [editMode, onCellContextMenu, cellFromEvent]);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (!editMode) return;
    const cell = cellFromEvent(e);
    if (!cell || !onCellWheel) return;
    e.preventDefault();
    onCellWheel(cell.x, cell.y, e.deltaY);
  }, [editMode, onCellWheel, cellFromEvent]);

  // Wheel event с passive: false (нужно чтобы preventDefault сработал)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !editMode) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [editMode, handleWheel]);

  // Imperative API для внешнего snapshot/restore
  useImperativeHandle(ref, () => ({
    getSim: () => simRef.current,
    restoreSnapshot: (snap) => {
      const sim = simRef.current;
      if (!sim) return;
      sim.tick = snap.tick;
      if (sim.owner.length === snap.ownerCopy.length) {
        sim.owner.set(snap.ownerCopy);
        sim.state.set(snap.stateCopy);
      }
      sim.ants = snap.antsCopy.map((a) => ({ ...a }));
      sim.lastBirthTickByOwner = { ...snap.lastBirthTickByOwner };
      // Trail тоже сбросим — он не часть state, но визуально странно
      // показывать trail от событий которых "ещё не было"
      if (trailRef.current) trailRef.current.fill(0);
    },
  }), []);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        display: 'block',
        imageRendering: 'pixelated',
        background: bg,
        cursor: (editMode || deployMode) ? 'crosshair' : 'default',
      }}
    />
  );
});

// ─── Render ──────────────────────────────────────────────────────────────────

interface DrawOpts {
  cellSize: number;
  gridType: import('@langton/core').EngineGridType;
  bg: string;
  antScale: number;
  glow: boolean;
  showTrail: boolean;
  showHpDots: boolean;
  showDirectionArrows: boolean;
  showGrid: boolean;
  showCellState: boolean;
  selectedAntId: string | null;
  editMode: boolean;
  shapes?: Array<import('./antShapes').ShapeId>;
  skinPack: 'shape' | 'kenney';
  heatmapMode: 'off' | HeatmapType;
  heatmapOpacity: number;
  heatmapData: HeatmapData | null;
  /** Stage 6: hover-cell + validity flag для подсветки. */
  deployHover: { x: number; y: number; valid: boolean } | null;
  /** Stage 8 Day 10: optimistic ghost deploys (pending server confirm). */
  ghostDeploys?: Array<{ x: number; y: number; playerIdx: number }>;
}

function draw(
  canvas: HTMLCanvasElement | null,
  sim: SimState | null,
  trail: Float32Array | null,
  palette: string[],
  opts: DrawOpts,
): void {
  if (!canvas || !sim || !trail) return;
  const { w, h } = sim;
  const {
    cellSize, gridType, bg, antScale, glow, showTrail, showHpDots,
    showDirectionArrows, showGrid, showCellState,
    selectedAntId, editMode, shapes, skinPack,
    heatmapMode, heatmapOpacity, heatmapData,
    deployHover, ghostDeploys,
  } = opts;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const { cssW, cssH } = getCanvasSize(w, h, cellSize, gridType);
  if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width  = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 1. Фон
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cssW, cssH);

  // 2. Owner-grid (Stage 8 multi-grid: drawCell учитывает gridType)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ownerVal = sim.owner[y * w + x]!;
      if (ownerVal === 0) continue;
      const colorIdx = ownerVal === 255 ? -1 : ownerVal - 1;
      const baseColor = colorIdx === -1 ? '#8E8E93' : (palette[colorIdx] ?? '#888');
      ctx.fillStyle = baseColor + '40';
      drawCell(ctx, x, y, cellSize, gridType);

      if (showTrail) {
        const trailVal = trail[y * w + x]!;
        if (trailVal > 0.01) {
          ctx.globalAlpha = Math.min(1, trailVal);
          ctx.fillStyle = baseColor;
          drawCell(ctx, x, y, cellSize, gridType);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  // 2.5. Day/night cell state (опционально)
  if (showCellState) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const s = sim.state[y * w + x]!;
        if (s === 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, .035)';
        } else {
          ctx.fillStyle = 'rgba(0, 0, 0, .12)';
        }
        drawCell(ctx, x, y, cellSize, gridType);
      }
    }
  }

  // 3. Сетка (опционально) — только для square. На tri/hex линии не корректны.
  if (showGrid && cellSize >= 6 && gridType === 'square') {
    ctx.strokeStyle = 'rgba(255,255,255,.05)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, cssH);
    }
    for (let y = 0; y <= h; y++) {
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(cssW, y * cellSize);
    }
    ctx.stroke();
  }

  // 4. Edit mode highlight: пунктирная сетка ярче (для удобства попадания)
  // — только для square
  if (editMode && cellSize >= 8 && gridType === 'square') {
    ctx.strokeStyle = 'rgba(255,214,10,.08)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 0; x <= w; x++) {
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, cssH);
    }
    for (let y = 0; y <= h; y++) {
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(cssW, y * cellSize);
    }
    ctx.stroke();
  }

  // 4.5. Heatmap overlay (Stage 4)
  if (heatmapMode !== 'off' && heatmapData && heatmapData.w === w && heatmapData.h === h) {
    let grid: Uint32Array;
    let maxV: number;
    switch (heatmapMode) {
      case 'deaths':    grid = heatmapData.deaths;    maxV = heatmapData.maxDeaths;    break;
      case 'captures':  grid = heatmapData.captures;  maxV = heatmapData.maxCaptures;  break;
      case 'contested': grid = heatmapData.contested; maxV = heatmapData.maxContested; break;
    }
    // Если данных ещё нет — пропускаем (не рисуем пустую заливку)
    if (maxV > 0) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const v = grid[y * w + x]!;
          if (v === 0) continue;
          const t = v / maxV;
          const [rC, gC, bC] = heatmapColor(heatmapMode, t);
          // alpha масштабируется и intensity, и user opacity
          const alpha = heatmapOpacity * Math.min(1, 0.25 + t * 0.75);
          ctx.fillStyle = `rgba(${rC},${gC},${bC},${alpha.toFixed(3)})`;
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }
  }

  // 4.7. Stage 6: deploy hover-подсветка валидной/невалидной клетки
  if (deployHover) {
    const hx = deployHover.x * cellSize;
    const hy = deployHover.y * cellSize;
    const color = deployHover.valid ? '#39D98A' : '#FF3B30'; // зелёный / красный
    ctx.fillStyle = color + '55'; // alpha ~33%
    ctx.fillRect(hx, hy, cellSize, cellSize);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, cellSize * 0.1);
    ctx.strokeRect(hx + 0.5, hy + 0.5, cellSize - 1, cellSize - 1);
  }

  // 4.8. Stage 8 Day 10: ghost deploys — optimistic UI placeholders.
  // Пульсирующий контур в цвете игрока, прозрачная заливка. Render между
  // hover и ant'ами чтобы реальный ant перекрывал ghost после confirm.
  if (ghostDeploys && ghostDeploys.length > 0) {
    const pulse = 0.55 + 0.25 * Math.sin(Date.now() / 180); // 0.30..0.80
    for (const g of ghostDeploys) {
      const [gcx, gcy] = getCellCenter(g.x, g.y, cellSize, gridType);
      const color = palette[g.playerIdx] ?? '#fff';
      const half = cellSize / 2;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = color + '40';
      ctx.fillRect(gcx - half, gcy - half, cellSize, cellSize);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.5, cellSize * 0.12);
      ctx.setLineDash([Math.max(2, cellSize * 0.25), Math.max(2, cellSize * 0.15)]);
      ctx.strokeRect(
        gcx - half + 0.5,
        gcy - half + 0.5,
        cellSize - 1,
        cellSize - 1,
      );
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }

  // 5. Муравьи
  // На больших полях cellSize=1, ant был бы 0.5px — не видно. Минимум 1.5 для видимости.
  const r = Math.max(1.5, (cellSize * antScale) / 2);
  for (const a of sim.ants) {
    if (a.dead) continue;
    const [cx, cy] = getCellCenter(a.x, a.y, cellSize, gridType);
    const colorIdx = a.owner === 255 ? -1 : a.owner;
    const color = colorIdx === -1 ? '#8E8E93' : (palette[colorIdx] ?? '#fff');

    const isSelected = selectedAntId === a.id;

    // Selected highlight: жёлтое кольцо
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
      ctx.strokeStyle = '#FFD60A';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Glow halo
    if (glow) {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2);
      grad.addColorStop(0, color + 'CC');
      grad.addColorStop(1, color + '00');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
    }

    // Тело — выбор формы по skinPack
    if (a.isWild) {
      // Дикий — всегда квадрат, чёткое отличие
      ctx.fillStyle = color;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    } else if (a.isHybrid) {
      // Гибрид — всегда ромб
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    } else if (skinPack === 'kenney' && colorIdx >= 0) {
      // Попытка нарисовать спрайт
      const skinId = skinIdForPlayer(colorIdx);
      const sprite = getSprite(skinId);
      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
        ctx.drawImage(sprite, cx - r, cy - r, r * 2, r * 2);
      } else {
        // Fallback на shape
        const shape = shapes?.[colorIdx] ?? 'circle';
        drawShape(ctx, shape, cx, cy, r, color);
      }
    } else {
      // skinPack='shape' — используем shape из палитры
      const shape = colorIdx >= 0 ? (shapes?.[colorIdx] ?? 'circle') : 'circle';
      drawShape(ctx, shape, cx, cy, r, color);
    }

    // Stage 5: золотая обводка мутанта поверх тела
    if (a.isMutant) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.15, 0, Math.PI * 2);
      ctx.strokeStyle = '#FFD60A';
      ctx.lineWidth = Math.max(1.5, cellSize * 0.12);
      ctx.stroke();
      // Дополнительное золотое свечение при включённом glow
      if (glow) {
        const goldGrad = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 2.5);
        goldGrad.addColorStop(0, '#FFD60A30');
        goldGrad.addColorStop(1, '#FFD60A00');
        ctx.fillStyle = goldGrad;
        ctx.fillRect(cx - r * 2.5, cy - r * 2.5, r * 5, r * 5);
      }
    }

    // Стрелка направления (Stage 8: pixel offset через neighbor cell)
    if (showDirectionArrows && cellSize >= 6) {
      const neighbors = getNeighbors(a.x, a.y, gridType);
      const off = neighbors[a.dir % neighbors.length]!;
      const [nbx, nby] = getCellCenter(a.x + off[0], a.y + off[1], cellSize, gridType);
      const vx = nbx - cx;
      const vy = nby - cy;
      const vlen = Math.hypot(vx, vy) || 1;
      const ax = cx + (vx / vlen) * r * 1.4;
      const ay = cy + (vy / vlen) * r * 1.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ax, ay);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(1, cellSize * 0.08);
      ctx.lineCap = 'round';
      ctx.stroke();
      // Наконечник (pixel vector vx/vy, нормализованный, для tri/hex тоже работает)
      const ux = vx / vlen;
      const uy = vy / vlen;
      const perpX = -uy * r * 0.4;
      const perpY = ux * r * 0.4;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - ux * r * 0.4 + perpX, ay - uy * r * 0.4 + perpY);
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - ux * r * 0.4 - perpX, ay - uy * r * 0.4 - perpY);
      ctx.stroke();
    }

    // HP-точки
    if (showHpDots && a.hp < a.maxHp) {
      const dotSize = Math.max(1.5, cellSize * 0.15);
      const gap = dotSize * 1.5;
      const totalWidth = a.maxHp * gap;
      let dotX = cx - totalWidth / 2 + gap / 2;
      const dotY = cy - r - dotSize * 1.2;
      for (let i = 0; i < a.maxHp; i++) {
        ctx.beginPath();
        ctx.fillStyle = i < a.hp ? color : '#444';
        ctx.arc(dotX, dotY, dotSize / 2, 0, Math.PI * 2);
        ctx.fill();
        dotX += gap;
      }
    }
  }
}
