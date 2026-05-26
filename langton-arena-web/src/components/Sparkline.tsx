// src/components/Sparkline.tsx
//
// Мини-линия для inline-визуализации одного метрика во времени.
// Используется в per-player карточках StatsTab для показа territory % history.

import { useRef, useEffect } from 'react';

interface SparklineProps {
  /** Массив значений в [0, 1]. Если значения больше 1 — нормализуется по max. */
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
}

export function Sparkline({
  values,
  width = 120,
  height = 24,
  color = '#FFD60A',
  fill = true,
}: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    draw(canvasRef.current, values, { width, height, color, fill });
  }, [values, width, height, color, fill]);

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
  values: number[],
  opts: { width: number; height: number; color: string; fill: boolean },
): void {
  if (!canvas) return;
  const { width: w, height: h, color, fill } = opts;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  if (values.length < 2) {
    // Слишком мало точек — рисуем placeholder
    ctx.fillStyle = color + '20';
    ctx.fillRect(0, h - 1, w, 1);
    return;
  }

  // Авто-масштаб: если max > 1, делим на max; иначе используем 0..1
  const max = Math.max(1, ...values);
  const xStep = w / (values.length - 1);
  const pad = 1;
  const innerH = h - pad * 2;

  // Линия
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = i * xStep;
    const y = pad + innerH - (v / max) * innerH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Заливка под линией
  if (fill) {
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = color + '22';
    ctx.fill();
  }
}
