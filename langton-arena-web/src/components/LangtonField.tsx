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

import { useRef, useEffect, useState, useCallback } from 'react';
import {
  makeLangtonState,
  stepLangton,
  type SimState,
  type Ant,
  type BirthConfig,
  type StepEvents,
} from '@core/langton/engine';
import { LA_DIRS } from '@core/langton/rules';

export interface LangtonFieldProps {
  w: number;
  h: number;
  cellSize: number;
  ants: Array<Omit<Ant, 'maxHp' | 'lastDamageTick' | 'bornAt'> & { maxHp?: number }>;
  palette: string[];

  // Симуляция
  tps?: number;
  paused?: boolean;
  seed?: number;
  collisionCooldownTicks?: number;
  birthConfig?: BirthConfig | null;

  // Визуал
  glow?: boolean;
  showTrail?: boolean;
  showHpDots?: boolean;
  showDirectionArrows?: boolean;
  showGrid?: boolean;
  antScale?: number;
  bg?: string;
  selectedAntId?: string | null;

  // Edit mode
  editMode?: boolean;
  onCellClick?: (x: number, y: number, modifiers: { shift: boolean }) => void;
  onCellContextMenu?: (x: number, y: number) => void;
  onCellWheel?: (x: number, y: number, deltaY: number) => void;

  // Step (внешний триггер: при изменении числа делаем 1 шаг)
  stepSignal?: number;

  // Callbacks
  onEvents?: (ev: StepEvents) => void;
  onTick?: (sim: SimState) => void;
}

export function LangtonField({
  w, h, cellSize, ants, palette,
  tps = 12, paused = false,
  glow = true, showTrail = true, showHpDots = false,
  showDirectionArrows = false, showGrid = false,
  antScale = 1, bg = '#0E0B1F',
  seed = 1, collisionCooldownTicks = 5,
  birthConfig = null,
  selectedAntId = null,
  editMode = false,
  onCellClick, onCellContextMenu, onCellWheel,
  stepSignal = 0,
  onEvents, onTick,
}: LangtonFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<SimState | null>(null);
  const trailRef = useRef<Float32Array | null>(null);
  const [, force] = useState(0);

  // (Re)build sim при смене размера/seed/состава ants
  useEffect(() => {
    simRef.current = makeLangtonState({ w, h, ants, seed, collisionCooldownTicks, birthConfig });
    trailRef.current = new Float32Array(w * h);
    force((n) => n + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h, seed, JSON.stringify(ants)]);

  // Live параметры без пересоздания
  useEffect(() => {
    if (simRef.current) simRef.current.collisionCooldownTicks = collisionCooldownTicks;
  }, [collisionCooldownTicks]);

  useEffect(() => {
    if (simRef.current) simRef.current.birthConfig = birthConfig;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(birthConfig)]);

  // Step — внешний сигнал: один тик, только если paused и editMode
  const prevStepRef = useRef(stepSignal);
  useEffect(() => {
    if (stepSignal !== prevStepRef.current && simRef.current && trailRef.current) {
      prevStepRef.current = stepSignal;
      const ev = stepLangton(simRef.current);
      for (const c of ev.captures) {
        const i = c.y * simRef.current.w + c.x;
        if (i >= 0 && i < trailRef.current.length) trailRef.current[i] = 1;
      }
      onEvents?.(ev);
      onTick?.(simRef.current);
    }
  }, [stepSignal, onEvents, onTick]);

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
          onEvents?.(ev);
          onTick?.(sim);
          acc -= period;
        }
        const decay = Math.pow(0.94, dt / 16);
        for (let i = 0; i < trail.length; i++) {
          if (trail[i]! > 0.001) trail[i]! *= decay;
          else trail[i] = 0;
        }
      }

      draw(canvasRef.current, sim, trail, palette, {
        cellSize, bg, antScale, glow, showTrail, showHpDots,
        showDirectionArrows, showGrid, selectedAntId, editMode,
      });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tps, paused, cellSize, JSON.stringify(palette), bg, antScale, glow, showTrail, showHpDots, showDirectionArrows, showGrid, selectedAntId, editMode]);

  // ─── Mouse interactions ────────────────────────────────────────────────────
  const cellFromEvent = useCallback((e: { clientX: number; clientY: number }): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    if (cssX < 0 || cssY < 0 || cssX >= rect.width || cssY >= rect.height) return null;
    const cellX = Math.floor((cssX / rect.width) * w);
    const cellY = Math.floor((cssY / rect.height) * h);
    if (cellX < 0 || cellX >= w || cellY < 0 || cellY >= h) return null;
    return { x: cellX, y: cellY };
  }, [w, h]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editMode || !onCellClick) return;
    const cell = cellFromEvent(e);
    if (!cell) return;
    onCellClick(cell.x, cell.y, { shift: e.shiftKey });
  }, [editMode, onCellClick, cellFromEvent]);

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

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      style={{
        display: 'block',
        imageRendering: 'pixelated',
        background: bg,
        cursor: editMode ? 'crosshair' : 'default',
      }}
    />
  );
}

// ─── Render ──────────────────────────────────────────────────────────────────

interface DrawOpts {
  cellSize: number;
  bg: string;
  antScale: number;
  glow: boolean;
  showTrail: boolean;
  showHpDots: boolean;
  showDirectionArrows: boolean;
  showGrid: boolean;
  selectedAntId: string | null;
  editMode: boolean;
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
    cellSize, bg, antScale, glow, showTrail, showHpDots,
    showDirectionArrows, showGrid, selectedAntId, editMode,
  } = opts;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = w * cellSize;
  const cssH = h * cellSize;
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

  // 2. Owner-grid
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ownerVal = sim.owner[y * w + x]!;
      if (ownerVal === 0) continue;
      const colorIdx = ownerVal === 255 ? -1 : ownerVal - 1;
      const baseColor = colorIdx === -1 ? '#8E8E93' : (palette[colorIdx] ?? '#888');
      ctx.fillStyle = baseColor + '40';
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

      if (showTrail) {
        const trailVal = trail[y * w + x]!;
        if (trailVal > 0.01) {
          ctx.globalAlpha = Math.min(1, trailVal);
          ctx.fillStyle = baseColor;
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  // 3. Сетка (опционально)
  if (showGrid && cellSize >= 6) {
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
  if (editMode && cellSize >= 8) {
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

  // 5. Муравьи
  const r = (cellSize * antScale) / 2;
  for (const a of sim.ants) {
    if (a.dead) continue;
    const cx = a.x * cellSize + cellSize / 2;
    const cy = a.y * cellSize + cellSize / 2;
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

    // Тело
    ctx.beginPath();
    if (a.isWild) {
      ctx.fillStyle = color;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    } else if (a.isHybrid) {
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Стрелка направления
    if (showDirectionArrows && cellSize >= 6) {
      const [dx, dy] = LA_DIRS[a.dir]!;
      const ax = cx + dx * r * 1.4;
      const ay = cy + dy * r * 1.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ax, ay);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(1, cellSize * 0.08);
      ctx.lineCap = 'round';
      ctx.stroke();
      // Наконечник
      const perpX = -dy * r * 0.4;
      const perpY = dx * r * 0.4;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - dx * r * 0.4 + perpX, ay - dy * r * 0.4 + perpY);
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - dx * r * 0.4 - perpX, ay - dy * r * 0.4 - perpY);
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
