// src/components/LangtonField.tsx
//
// React-компонент, который рендерит живую симуляцию Лэнгтона на <canvas>.
// Работает через requestAnimationFrame с компенсацией дрифта таймера.
//
// Использование:
//   <LangtonField w={80} h={60} cellSize={10} ants={[...]} palette={['#FF5470','#4DA8FF']}
//                 tps={15} paused={false} onTick={(s) => ...} />

import React, { useRef, useEffect, useState } from 'react';
import {
  makeLangtonState,
  stepLangton,
  type SimState,
  type Ant,
  type BirthConfig,
  type StepEvents,
} from '@core/langton/engine';

export interface LangtonFieldProps {
  w: number;
  h: number;
  cellSize: number;
  ants: Array<Omit<Ant, 'maxHp' | 'lastDamageTick' | 'bornAt'> & { maxHp?: number }>;
  palette: string[];
  tps?: number;
  paused?: boolean;
  glow?: boolean;
  showTrail?: boolean;
  showHpDots?: boolean;
  antScale?: number;
  bg?: string;
  seed?: number;
  collisionCooldownTicks?: number;
  birthConfig?: BirthConfig | null;
  onEvents?: (ev: StepEvents) => void;
  onTick?: (sim: SimState) => void;
}

export function LangtonField({
  w, h, cellSize, ants, palette,
  tps = 12, paused = false,
  glow = true, showTrail = true, showHpDots = false,
  antScale = 1, bg = '#0E0B1F',
  seed = 1, collisionCooldownTicks = 5,
  birthConfig = null,
  onEvents, onTick,
}: LangtonFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<SimState | null>(null);
  const trailRef = useRef<Float32Array | null>(null);
  const [, force] = useState(0);

  // (Re)build sim при смене размера/seed/ants
  useEffect(() => {
    simRef.current = makeLangtonState({ w, h, ants, seed, collisionCooldownTicks, birthConfig });
    trailRef.current = new Float32Array(w * h);
    force((n) => n + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h, seed, JSON.stringify(ants)]);

  // Live-апдейты параметров без пересоздания
  useEffect(() => {
    if (simRef.current) simRef.current.collisionCooldownTicks = collisionCooldownTicks;
  }, [collisionCooldownTicks]);

  useEffect(() => {
    if (simRef.current) simRef.current.birthConfig = birthConfig;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(birthConfig)]);

  // Главный цикл
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
        // Decay trail
        const decay = Math.pow(0.94, dt / 16);
        for (let i = 0; i < trail.length; i++) {
          if (trail[i]! > 0.001) trail[i]! *= decay;
          else trail[i] = 0;
        }
      }

      draw(canvasRef.current, sim, trail, palette, {
        cellSize, bg, antScale, glow, showTrail, showHpDots,
      });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tps, paused, cellSize, JSON.stringify(palette), bg, antScale, glow, showTrail, showHpDots]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        imageRendering: 'pixelated',
        background: bg,
      }}
    />
  );
}

// ─── Render function ─────────────────────────────────────────────────────────

interface DrawOpts {
  cellSize: number;
  bg: string;
  antScale: number;
  glow: boolean;
  showTrail: boolean;
  showHpDots: boolean;
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
  const { cellSize, bg, antScale, glow, showTrail, showHpDots } = opts;
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

  // 1. фон
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cssW, cssH);

  // 2. owner-grid (цвет территории по игроку)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ownerVal = sim.owner[y * w + x]!;
      if (ownerVal === 0) continue;
      const colorIdx = ownerVal === 255 ? -1 : ownerVal - 1;
      const baseColor = colorIdx === -1 ? '#8E8E93' : (palette[colorIdx] ?? '#888');
      // Базовая территория — приглушённая (alpha .25)
      ctx.fillStyle = baseColor + '40';
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);

      // Trail — поверх с большей яркостью
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

  // 3. Муравьи
  const r = (cellSize * antScale) / 2;
  for (const a of sim.ants) {
    if (a.dead) continue;
    const cx = a.x * cellSize + cellSize / 2;
    const cy = a.y * cellSize + cellSize / 2;
    const colorIdx = a.owner === 255 ? -1 : a.owner;
    const color = colorIdx === -1 ? '#8E8E93' : (palette[colorIdx] ?? '#fff');

    if (glow) {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2);
      grad.addColorStop(0, color + 'CC');
      grad.addColorStop(1, color + '00');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
    }
    ctx.beginPath();
    if (a.isWild) {
      // Дикий — квадрат
      ctx.fillStyle = color;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    } else if (a.isHybrid) {
      // Гибрид — ромб
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      // Обычный — круг
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // HP-точки сверху муравья
    if (showHpDots && a.hp < a.maxHp) {
      const dotSize = Math.max(1.5, cellSize * 0.15);
      const gap = dotSize * 1.5;
      const totalWidth = a.maxHp * gap;
      let x = cx - totalWidth / 2 + gap / 2;
      const y = cy - r - dotSize * 1.2;
      for (let i = 0; i < a.maxHp; i++) {
        ctx.beginPath();
        ctx.fillStyle = i < a.hp ? color : '#444';
        ctx.arc(x, y, dotSize / 2, 0, Math.PI * 2);
        ctx.fill();
        x += gap;
      }
    }
  }
}
