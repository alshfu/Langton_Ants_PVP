// src/components/gridRender.ts
//
// Stage 8 multi-grid: helpers для рендеринга клеток разных топологий
// (square / triangle / hexagonal) в Canvas 2D.

import type { GridType } from '@langton/core';

/**
 * Нарисовать ОДНУ клетку (фоновую заливку) в позиции (x, y).
 * fillStyle должен быть уже установлен в ctx.
 */
export function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  cellSize: number,
  gridType: GridType,
): void {
  switch (gridType) {
    case 'square': {
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      return;
    }
    case 'triangle': {
      const s = cellSize;
      const isUp = ((x + y) & 1) === 0;
      ctx.beginPath();
      if (isUp) {
        // up-triangle: base at top of row y+1
        ctx.moveTo(x * s, (y + 1) * s);
        ctx.lineTo((x + 0.5) * s, y * s);
        ctx.lineTo((x + 1) * s, (y + 1) * s);
      } else {
        // down-triangle: base at top of row y
        ctx.moveTo(x * s, y * s);
        ctx.lineTo((x + 0.5) * s, (y + 1) * s);
        ctx.lineTo((x + 1) * s, y * s);
      }
      ctx.closePath();
      ctx.fill();
      return;
    }
    case 'hexagonal': {
      const [cx, cy] = getCellCenter(x, y, cellSize, gridType);
      const r = cellSize * 0.6;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i + Math.PI / 6; // pointy-top
        const px = cx + r * Math.cos(angle);
        const py = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      return;
    }
  }
}

/**
 * Центр клетки (x, y) в pixel coordinates — для рисования муравья.
 * Возвращает [cx, cy].
 */
export function getCellCenter(
  x: number, y: number,
  cellSize: number,
  gridType: GridType,
): [number, number] {
  switch (gridType) {
    case 'square':
      return [x * cellSize + cellSize / 2, y * cellSize + cellSize / 2];
    case 'triangle': {
      const s = cellSize;
      const isUp = ((x + y) & 1) === 0;
      // Центр масс треугольника
      const cx = (x + 0.5) * s;
      const cy = isUp
        ? y * s + (s * 2) / 3       // up-triangle: 2/3 от вершины (которая в y*s)
        : (y + 1) * s - (s * 2) / 3; // down-triangle
      return [cx, cy];
    }
    case 'hexagonal': {
      // Pointy-top hex с even-r offset
      const hexW = cellSize * 0.95;    // width packing factor
      const hexH = cellSize * 0.85;    // row packing (rows stagger)
      const xOff = (y & 1) ? hexW * 0.5 : 0;
      return [
        x * hexW + xOff + hexW / 2,
        y * hexH + hexH / 2,
      ];
    }
  }
}

/**
 * Размер canvas в pixels — зависит от gridType (tri/hex packing).
 */
export function getCanvasSize(
  w: number, h: number,
  cellSize: number,
  gridType: GridType,
): { cssW: number; cssH: number } {
  switch (gridType) {
    case 'square':
      return { cssW: w * cellSize, cssH: h * cellSize };
    case 'triangle':
      // Triangles pack at half-step in x, but each cell still takes full cellSize.
      // Канвас немного шире из-за 0.5 offset на последней триангле.
      return { cssW: (w + 0.5) * cellSize, cssH: h * cellSize };
    case 'hexagonal': {
      const hexW = cellSize * 0.95;
      const hexH = cellSize * 0.85;
      return { cssW: w * hexW + hexW * 0.6, cssH: h * hexH + hexH * 0.4 };
    }
  }
}

/**
 * Конвертация pixel (px, py) → cell coords. Используется в click handlers.
 * Для tri/hex — приблизительно (через cell center distance).
 */
export function pixelToCell(
  px: number, py: number,
  cellSize: number,
  gridType: GridType,
  w: number, h: number,
): { x: number; y: number } | null {
  switch (gridType) {
    case 'square': {
      const x = Math.floor(px / cellSize);
      const y = Math.floor(py / cellSize);
      if (x < 0 || x >= w || y < 0 || y >= h) return null;
      return { x, y };
    }
    case 'triangle': {
      // Approximate: find nearest cell center среди соседних кандидатов
      const sx = Math.floor(px / (cellSize / 2));
      const sy = Math.floor(py / cellSize);
      let best = { x: 0, y: 0 };
      let bestD = Infinity;
      for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1, 2]) {
        const cx = sx + dx;
        const cy = sy + dy;
        if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;
        const [ccx, ccy] = getCellCenter(cx, cy, cellSize, 'triangle');
        const d = (px - ccx) ** 2 + (py - ccy) ** 2;
        if (d < bestD) { bestD = d; best = { x: cx, y: cy }; }
      }
      return bestD === Infinity ? null : best;
    }
    case 'hexagonal': {
      // Nearest hex по distance к center.
      const hexW = cellSize * 0.95;
      const hexH = cellSize * 0.85;
      const ry = Math.round(py / hexH - 0.5);
      const rx = Math.round((px - ((ry & 1) ? hexW * 0.5 : 0)) / hexW - 0.5);
      let best = { x: 0, y: 0 };
      let bestD = Infinity;
      for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) {
        const cx = rx + dx;
        const cy = ry + dy;
        if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;
        const [ccx, ccy] = getCellCenter(cx, cy, cellSize, 'hexagonal');
        const d = (px - ccx) ** 2 + (py - ccy) ** 2;
        if (d < bestD) { bestD = d; best = { x: cx, y: cy }; }
      }
      return bestD === Infinity ? null : best;
    }
  }
}
