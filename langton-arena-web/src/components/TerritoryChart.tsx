// src/components/TerritoryChart.tsx
//
// Стэк-граф процента территории каждого игрока во времени.
// Canvas-based, перерисовывается при изменении territoryHistory.
// НЕ использует rAF — обновляется по дельте данных (каждые 5 тиков от engine).

import { useRef, useEffect } from 'react';

interface PlayerInfo {
  id: string;
  color: string;
  name: string;
}

interface HistoryPoint {
  tick: number;
  byPlayer: Record<string, number>;
}

interface TerritoryChartProps {
  history: HistoryPoint[];
  players: PlayerInfo[];
  width?: number;
  height?: number;
  bg?: string;
  fg?: string;
}

export function TerritoryChart({
  history, players,
  width = 280, height = 120,
  bg = 'transparent',
  fg = '#5A5870',
}: TerritoryChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    draw(canvasRef.current, history, players, { width, height, bg, fg });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.length, JSON.stringify(players.map((p) => p.id)), width, height, bg, fg]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: `${width}px`,
        height: `${height}px`,
      }}
    />
  );
}

function draw(
  canvas: HTMLCanvasElement | null,
  history: HistoryPoint[],
  players: PlayerInfo[],
  opts: { width: number; height: number; bg: string; fg: string },
): void {
  if (!canvas) return;
  const { width: w, height: h, bg, fg } = opts;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Фон
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  if (history.length === 0) {
    ctx.fillStyle = fg;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('no data yet · start running', w / 2, h / 2);
    return;
  }

  // Padding для оси
  const padL = 24, padR = 4, padT = 4, padB = 14;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  // X-coord: индекс точки в массиве (от 0 до history.length-1)
  // Y-coord: накопительный % территории
  const xStep = history.length > 1 ? innerW / (history.length - 1) : innerW;

  // Стэк рисуется снизу вверх: для каждой точки вычисляем массив накоп.долей
  // [0, p0_pct, p0_pct+p1_pct, ..., 1.0]
  // Затем для каждого игрока рисуем полигон между двумя соседними слоями.

  const playerIds = players.map((p) => p.id);

  // Полигон каждого игрока
  for (let pi = 0; pi < players.length; pi++) {
    const player = players[pi]!;
    ctx.beginPath();

    // Нижняя кромка (накопительная) — слева направо
    for (let i = 0; i < history.length; i++) {
      const x = padL + i * xStep;
      let cum = 0;
      for (let j = 0; j < pi; j++) {
        cum += history[i]!.byPlayer[playerIds[j]!] ?? 0;
      }
      const y = padT + innerH - cum * innerH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    // Верхняя кромка — справа налево
    for (let i = history.length - 1; i >= 0; i--) {
      const x = padL + i * xStep;
      let cum = 0;
      for (let j = 0; j <= pi; j++) {
        cum += history[i]!.byPlayer[playerIds[j]!] ?? 0;
      }
      const y = padT + innerH - cum * innerH;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = player.color + 'D0';
    ctx.fill();
  }

  // Y-axis labels (0, 50, 100%)
  ctx.fillStyle = fg;
  ctx.font = '9px JetBrains Mono, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('100', padL - 4, padT);
  ctx.fillText('50',  padL - 4, padT + innerH / 2);
  ctx.fillText('0',   padL - 4, padT + innerH);

  // X-axis: первый/последний тик
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const firstTick = history[0]!.tick;
  const lastTick  = history[history.length - 1]!.tick;
  ctx.fillText(`t${firstTick}`, padL, padT + innerH + 2);
  ctx.textAlign = 'right';
  ctx.fillText(`t${lastTick}`, w - padR, padT + innerH + 2);

  // Сетка — горизонтальные линии на 25/50/75
  ctx.strokeStyle = fg + '22';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (const frac of [0.25, 0.5, 0.75]) {
    const y = padT + innerH * frac;
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
  }
  ctx.stroke();
}
