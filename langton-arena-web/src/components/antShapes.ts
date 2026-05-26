// src/components/antShapes.ts
//
// Procedural-формы для рендера муравьёв на canvas.
// 10 форм соответствуют полю `shape` в PLAYER_PALETTE.
// Каждая функция: рисует фигуру в (cx, cy) радиусом r цветом color.
//
// Никаких побочных эффектов кроме рисования на ctx.

export type ShapeId =
  | 'circle' | 'triangle' | 'diamond' | 'hexagon' | 'square'
  | 'star'   | 'cross'    | 'pentagon'| 'octagon' | 'ring';

export function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: ShapeId,
  cx: number, cy: number, r: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  switch (shape) {
    case 'circle':   drawCircle(ctx, cx, cy, r); ctx.fill(); return;
    case 'triangle': drawTriangle(ctx, cx, cy, r); ctx.fill(); return;
    case 'diamond':  drawDiamond(ctx, cx, cy, r); ctx.fill(); return;
    case 'hexagon':  drawPolygon(ctx, cx, cy, r, 6); ctx.fill(); return;
    case 'square':   ctx.fillRect(cx - r, cy - r, r * 2, r * 2); return;
    case 'star':     drawStar(ctx, cx, cy, r, 5); ctx.fill(); return;
    case 'cross':    drawCross(ctx, cx, cy, r); return;
    case 'pentagon': drawPolygon(ctx, cx, cy, r, 5); ctx.fill(); return;
    case 'octagon':  drawPolygon(ctx, cx, cy, r, 8); ctx.fill(); return;
    case 'ring':     drawRing(ctx, cx, cy, r); return;
  }
}

function drawCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
}

function drawTriangle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.866, cy + r * 0.5);
  ctx.lineTo(cx - r * 0.866, cy + r * 0.5);
  ctx.closePath();
}

function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
}

/** Регулярный многоугольник с n вершинами. */
function drawPolygon(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  n: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Звезда с n лучами, чередуя внешний/внутренний радиус. */
function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  points: number,
): void {
  ctx.beginPath();
  const innerR = r * 0.4;
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? r : innerR;
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Крест плюсиком. Толщина = r/2. */
function drawCross(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const t = r * 0.4; // полутолщина
  ctx.beginPath();
  ctx.rect(cx - t, cy - r, t * 2, r * 2);
  ctx.rect(cx - r, cy - t, r * 2, t * 2);
  ctx.fill();
}

/** Кольцо — круг минус внутренний круг. */
function drawRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1, r * 0.35);
  ctx.stroke();
}
