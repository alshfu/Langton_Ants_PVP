// charts.jsx — Lightweight chart primitives. No external lib; pure SVG/canvas.
// All charts accept a `width` and `height` and render at that exact size.

// ─────────────────────────────────────────────────────────────────────────────
// Sparkline — small inline line. For history rows, ELO mini-graph.
// ─────────────────────────────────────────────────────────────────────────────
function Sparkline({ data = [], width = 80, height = 24, color = '#FFD60A', strokeWidth = 1.5, fill = true }) {
  if (!data.length) return <svg width={width} height={height} />;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const w = width - pad * 2, h = height - pad * 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * w;
    const y = pad + h - ((v - min) / range) * h;
    return [x, y];
  });
  const linePath = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const fillPath = `${linePath} L${pts.at(-1)[0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {fill && <path d={fillPath} fill={color} opacity={0.16} />}
      <path d={linePath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LineChart — multi-series line chart with optional axes.
// series: [{ color, label, points: number[], dashed? }]
// ─────────────────────────────────────────────────────────────────────────────
function LineChart({
  series = [], width = 480, height = 220,
  yMin = null, yMax = null,
  yTicks = 4, xLabels = null,
  yFormat = (v) => v.toFixed(0),
  fill = false,
  gridColor = 'rgba(255,255,255,.06)',
  axisColor = '#5A5870',
}) {
  if (!series.length) return null;
  const allVals = series.flatMap((s) => s.points);
  const _min = yMin != null ? yMin : Math.min(...allVals);
  const _max = yMax != null ? yMax : Math.max(...allVals);
  const range = _max - _min || 1;
  const padL = 40, padR = 12, padT = 10, padB = xLabels ? 24 : 10;
  const w = width - padL - padR, h = height - padT - padB;
  const xAt = (i, total) => padL + (i / (total - 1)) * w;
  const yAt = (v) => padT + h - ((v - _min) / range) * h;

  // Y-axis ticks.
  const ticks = Array.from({ length: yTicks + 1 }).map((_, i) => _min + (range * i) / yTicks);

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {/* gridlines */}
      {ticks.map((tv, i) => (
        <g key={i}>
          <line x1={padL} x2={width - padR} y1={yAt(tv)} y2={yAt(tv)} stroke={gridColor} strokeWidth="1" />
          <text x={padL - 6} y={yAt(tv)} textAnchor="end" dominantBaseline="middle"
            fill={axisColor} fontSize="9" fontFamily="JetBrains Mono">{yFormat(tv)}</text>
        </g>
      ))}
      {/* x labels */}
      {xLabels && xLabels.map((lab, i) => {
        const x = xAt(i, xLabels.length);
        return (
          <text key={i} x={x} y={height - 6} textAnchor="middle" fill={axisColor}
            fontSize="9" fontFamily="JetBrains Mono">{lab}</text>
        );
      })}
      {/* lines */}
      {series.map((s, si) => {
        const pts = s.points.map((v, i) => [xAt(i, s.points.length), yAt(v)]);
        const linePath = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
        const fillPath = `${linePath} L${pts.at(-1)[0].toFixed(1)},${padT + h} L${pts[0][0].toFixed(1)},${padT + h} Z`;
        return (
          <g key={si}>
            {fill && <path d={fillPath} fill={s.color} opacity={0.10} />}
            <path d={linePath} fill="none" stroke={s.color} strokeWidth="2"
              strokeDasharray={s.dashed ? '4 4' : undefined}
              strokeLinejoin="round" strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 4px ${s.color}66)` }} />
          </g>
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BarChart — horizontal bars with labels.
// rows: [{ label, value, secondary?, color, max? }]
// ─────────────────────────────────────────────────────────────────────────────
function BarChart({
  rows = [], width = 480, max = null,
  rowHeight = 28, gap = 4, labelWidth = 110, valueWidth = 70,
  format = (v) => v.toFixed(1) + '%',
}) {
  const _max = max != null ? max : Math.max(...rows.map((r) => r.value));
  return (
    <div style={{ width, display: 'flex', flexDirection: 'column', gap }}>
      {rows.map((r, i) => (
        <div key={i} style={{
          height: rowHeight, display: 'grid',
          gridTemplateColumns: `${labelWidth}px 1fr ${valueWidth}px`, alignItems: 'center', gap: 10,
        }}>
          <div style={{ fontSize: 12, color: '#F5F5F7', textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</div>
          <div style={{ height: 8, background: 'rgba(255,255,255,.06)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              position: 'absolute', inset: 0, width: `${(r.value / _max) * 100}%`,
              background: r.color || '#FFD60A',
              borderRadius: 4, boxShadow: `0 0 8px ${(r.color || '#FFD60A')}77`,
            }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#F5F5F7', fontWeight: 600 }}>{format(r.value)}</span>
            {r.secondary != null && (
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#8E8E93' }}>{r.secondary}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HeatMap — renders a w×h grid of intensities through canvas for speed.
// data: Float[] or number[] length w*h, values 0..1.
// palette: 'fire' | 'ice' | 'plasma' | hexColor
// ─────────────────────────────────────────────────────────────────────────────
function HeatMap({ map, width = 220, height = 220, palette = 'fire', border = true }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ref.current || !map) return;
    // Accept both legacy ({w, h}) and contract ({width, height}) shapes.
    const w = map.w ?? map.width;
    const h = map.h ?? map.height;
    const data = map.data;
    if (!w || !h || !data) return;
    const ctx = ref.current.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ref.current.width = width * dpr; ref.current.height = height * dpr;
    ref.current.style.width = width + 'px'; ref.current.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0A081A';
    ctx.fillRect(0, 0, width, height);
    const cw = width / w, ch = height / h;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = Math.max(0, Math.min(1, data[y * w + x]));
        ctx.fillStyle = palettize(v, palette);
        ctx.fillRect(x * cw, y * ch, cw + 0.5, ch + 0.5);
      }
    }
  }, [map, width, height, palette]);
  return (
    <canvas ref={ref} style={{
      display: 'block', borderRadius: 8,
      border: border ? '1px solid rgba(255,255,255,.06)' : 'none',
    }} />
  );
}

function palettize(v, palette) {
  if (palette === 'fire') {
    // Black → purple → magenta → orange → yellow
    if (v < 0.25) return mix('#0A081A', '#4A1A6E', v / 0.25);
    if (v < 0.5)  return mix('#4A1A6E', '#C77DFF', (v - 0.25) / 0.25);
    if (v < 0.75) return mix('#C77DFF', '#FF8A3D', (v - 0.5) / 0.25);
    return mix('#FF8A3D', '#FFD60A', (v - 0.75) / 0.25);
  }
  if (palette === 'ice') {
    if (v < 0.5) return mix('#0A081A', '#4DA8FF', v / 0.5);
    return mix('#4DA8FF', '#F5F5F7', (v - 0.5) / 0.5);
  }
  // Custom hex.
  return mix('#0A081A', palette, v);
}
function mix(a, b, t) {
  const pa = parseHex(a), pb = parseHex(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
function parseHex(s) {
  const m = s.replace('#', '');
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}

// ─────────────────────────────────────────────────────────────────────────────
// Donut — single-value ring (e.g. winrate, accuracy).
// ─────────────────────────────────────────────────────────────────────────────
function Donut({ value, max = 1, size = 80, thickness = 8, color = '#FFD60A', bg = 'rgba(255,255,255,.08)', label, sub }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bg} strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness}
          strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`}
          style={{ filter: `drop-shadow(0 0 6px ${color}66)`, transition: 'stroke-dasharray .3s' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', lineHeight: 1,
      }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: size * 0.22, fontWeight: 700, color: '#F5F5F7' }}>{label}</div>
        {sub && <div style={{ fontFamily: 'JetBrains Mono', fontSize: size * 0.10, color: '#8E8E93', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Radar — comparison polygon (you vs avg vs top).
// data: [{ label, you, avg, topPct }]
// ─────────────────────────────────────────────────────────────────────────────
function Radar({ data = [], size = 220, levels = 4, palette = ['#FFD60A', '#8E8E93', '#C77DFF'] }) {
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 28;
  const n = data.length;
  const angle = (i) => (i / n) * Math.PI * 2 - Math.PI / 2;
  const pt = (i, v) => [cx + Math.cos(angle(i)) * r * v, cy + Math.sin(angle(i)) * r * v];

  // Normalise each axis to its own max (top ?? max(you,avg)) so axes are comparable.
  const maxes = data.map((d) => Math.max(d.topPct ?? 0, d.you, d.avg) * 1.1);
  const polyFor = (key) => data.map((d, i) => pt(i, d[key] / maxes[i])).map((p) => p.join(',')).join(' ');

  return (
    <svg width={size} height={size}>
      {/* concentric rings */}
      {Array.from({ length: levels }).map((_, l) => {
        const frac = (l + 1) / levels;
        const pts = Array.from({ length: n }).map((_, i) => pt(i, frac));
        return (
          <polygon key={l} points={pts.map((p) => p.join(',')).join(' ')}
            fill="none" stroke="rgba(255,255,255,.06)" />
        );
      })}
      {/* axes */}
      {data.map((d, i) => {
        const p = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={p[0]} y2={p[1]} stroke="rgba(255,255,255,.06)" />;
      })}
      {/* polygons */}
      <polygon points={polyFor('topPct')} fill={palette[2]} fillOpacity="0.10" stroke={palette[2]} strokeWidth="1.2" strokeDasharray="3 3" />
      <polygon points={polyFor('avg')}    fill={palette[1]} fillOpacity="0.10" stroke={palette[1]} strokeWidth="1.2" />
      <polygon points={polyFor('you')}    fill={palette[0]} fillOpacity="0.25" stroke={palette[0]} strokeWidth="2" style={{ filter: `drop-shadow(0 0 4px ${palette[0]}55)` }} />
      {/* dots on 'you' */}
      {data.map((d, i) => {
        const p = pt(i, d.you / maxes[i]);
        return <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={palette[0]} />;
      })}
      {/* labels */}
      {data.map((d, i) => {
        const p = pt(i, 1.18);
        return (
          <text key={i} x={p[0]} y={p[1]} textAnchor="middle" dominantBaseline="middle"
            fill="#8E8E93" fontSize="9" fontFamily="JetBrains Mono" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

Object.assign(window, { Sparkline, LineChart, BarChart, HeatMap, Donut, Radar });
