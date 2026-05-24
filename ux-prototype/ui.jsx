// ui.jsx — shared UI primitives for Langton Arena prototype.

// Player palette — base saturation kept similar across hues so no one player dominates visually.
const PLAYER_COLORS = [
  { id: 0, name: 'BraveSpiral42',  hex: '#FF5470', tag: 'you' },     // crimson
  { id: 1, name: 'RuneMaster',     hex: '#4DA8FF', tag: 'enemy' },   // azure
  { id: 2, name: 'PixelKnight',    hex: '#39D98A', tag: 'enemy' },   // mint
  { id: 3, name: 'CrystalFox',     hex: '#FFD60A', tag: 'enemy' },   // amber
  { id: 4, name: 'NeonOrbit',      hex: '#C77DFF', tag: 'enemy' },   // violet
  { id: 5, name: 'GlitchByte',     hex: '#FF8A3D', tag: 'enemy' },   // tangerine
  { id: 6, name: 'VoidPilgrim',    hex: '#00E5D1', tag: 'enemy' },   // teal
  { id: 7, name: 'EmberDrift',     hex: '#FF4D9E', tag: 'enemy' },   // magenta
];

// Theme tokens. Light/dark are tweakable.
const THEMES = {
  dark: {
    bg: '#0E0B1F',
    surface: '#16122A',
    surfaceAlt: '#1E1938',
    line: 'rgba(255,255,255,0.08)',
    lineStrong: 'rgba(255,255,255,0.16)',
    text: '#F5F5F7',
    textDim: '#8E8E93',
    textMute: '#5A5870',
    accent: '#FFD60A',
    danger: '#FF453A',
    success: '#39D98A',
  },
  light: {
    bg: '#F4F2EE',
    surface: '#FFFFFF',
    surfaceAlt: '#EDEAE3',
    line: 'rgba(20,16,40,0.10)',
    lineStrong: 'rgba(20,16,40,0.20)',
    text: '#16122A',
    textDim: '#5B5870',
    textMute: '#9A97B0',
    accent: '#C77400',
    danger: '#D62A1F',
    success: '#1F8A5B',
  },
};

// Sized "screen" frame for design canvas artboards.
function Screen({ width, height, theme = 'dark', children, label, sublabel }) {
  const T = THEMES[theme];
  return (
    <div style={{
      width, height, position: 'relative', overflow: 'hidden',
      background: T.bg, color: T.text, fontFamily: 'Inter, system-ui, sans-serif',
      fontFeatureSettings: '"ss01","cv11"',
    }}>
      {children}
    </div>
  );
}

// Logo wordmark used in menu / loading.
function Logo({ size = 28, color = '#F5F5F7', accent = '#FFD60A' }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: size * 0.5,
      fontFamily: 'Inter, system-ui, sans-serif',
      fontWeight: 800, letterSpacing: -0.5, fontSize: size, color, lineHeight: 1,
    }}>
      <svg width={size * 1.2} height={size * 1.2} viewBox="0 0 28 28" fill="none" style={{ flex: '0 0 auto' }}>
        <rect x="2" y="2" width="11" height="11" rx="1.5" fill={color} opacity=".22" />
        <rect x="15" y="2" width="11" height="11" rx="1.5" fill={color} opacity=".42" />
        <rect x="2" y="15" width="11" height="11" rx="1.5" fill={color} opacity=".62" />
        <rect x="15" y="15" width="11" height="11" rx="1.5" fill={accent} />
        <circle cx="20.5" cy="20.5" r="2.2" fill={color} />
        <circle cx="22.6" cy="20.5" r="1.0" fill={accent} />
      </svg>
      <span>LANGTON<span style={{ color: accent }}>·</span>ARENA</span>
    </div>
  );
}

// Marker for player identity in lists. Circle + inner dot.
function AntMarker({ color, size = 18, dim = false }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, position: 'relative', flex: '0 0 auto',
      boxShadow: dim ? 'none' : `0 0 ${size * 0.55}px ${color}66`,
      opacity: dim ? 0.45 : 1,
    }}>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: size * 0.35, height: size * 0.35, borderRadius: '50%',
        background: '#fff', transform: 'translate(-50%, -50%)',
      }} />
    </div>
  );
}

// Big call-to-action button with subtle hover lift.
function PrimaryButton({ children, accent = '#FFD60A', onClick, size = 'lg', full = false, style }) {
  const [hov, setHov] = React.useState(false);
  const padX = size === 'lg' ? 28 : size === 'md' ? 20 : 14;
  const padY = size === 'lg' ? 16 : size === 'md' ? 12 : 8;
  const fs   = size === 'lg' ? 16 : size === 'md' ? 14 : 12;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        appearance: 'none', border: 'none', cursor: 'pointer',
        background: accent, color: '#0E0B1F', fontWeight: 700, letterSpacing: 0.4,
        padding: `${padY}px ${padX}px`, borderRadius: 10, fontSize: fs,
        fontFamily: 'Inter, system-ui, sans-serif', textTransform: 'uppercase',
        boxShadow: hov ? `0 8px 28px ${accent}55, 0 0 0 3px ${accent}22` : `0 4px 16px ${accent}33`,
        transform: hov ? 'translateY(-1px)' : 'none',
        transition: 'all .18s cubic-bezier(.34,1.56,.64,1)',
        width: full ? '100%' : 'auto',
        ...style,
      }}>
      {children}
    </button>
  );
}

// Ghost (outline) button.
function GhostButton({ children, onClick, full = false, style, size = 'md', tone = 'dark' }) {
  const [hov, setHov] = React.useState(false);
  const padX = size === 'lg' ? 24 : size === 'md' ? 18 : 12;
  const padY = size === 'lg' ? 14 : size === 'md' ? 11 : 7;
  const fs   = size === 'lg' ? 14 : size === 'md' ? 13 : 11;
  const fg = tone === 'light' ? '#16122A' : '#F5F5F7';
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        appearance: 'none', cursor: 'pointer', background: hov ? `${fg}10` : 'transparent',
        color: fg, padding: `${padY}px ${padX}px`, borderRadius: 10,
        border: `1px solid ${fg}30`,
        fontWeight: 600, letterSpacing: 0.3, fontSize: fs, textTransform: 'uppercase',
        fontFamily: 'Inter, system-ui, sans-serif', transition: 'all .14s ease-out',
        width: full ? '100%' : 'auto', ...style,
      }}>
      {children}
    </button>
  );
}

// Monospaced numeric display (timer, scores).
function Mono({ children, size = 16, weight = 500, color = '#F5F5F7', style }) {
  return (
    <span style={{
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      fontSize: size, fontWeight: weight, color,
      fontVariantNumeric: 'tabular-nums', letterSpacing: -0.2,
      ...style,
    }}>{children}</span>
  );
}

// Section eyebrow heading.
function Eyebrow({ children, color = '#8E8E93', style }) {
  return (
    <div style={{
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      fontSize: 10, fontWeight: 500, color, letterSpacing: 2,
      textTransform: 'uppercase', ...style,
    }}>{children}</div>
  );
}

// Pill chip — used for status, mode tags.
function Chip({ children, color = '#FFD60A', filled = false, size = 'sm' }) {
  const padY = size === 'sm' ? 3 : 5;
  const padX = size === 'sm' ? 8 : 12;
  const fs   = size === 'sm' ? 10 : 12;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: `${padY}px ${padX}px`, borderRadius: 999,
      background: filled ? color : `${color}1A`,
      color: filled ? '#0E0B1F' : color,
      fontSize: fs, fontWeight: 700, letterSpacing: 0.6,
      textTransform: 'uppercase', fontFamily: 'Inter, sans-serif',
      border: filled ? 'none' : `1px solid ${color}33`,
    }}>{children}</span>
  );
}

// Generic surface card.
function Card({ children, theme = 'dark', style, padded = true }) {
  const T = THEMES[theme];
  return (
    <div style={{
      background: T.surface, borderRadius: 16, border: `1px solid ${T.line}`,
      padding: padded ? 20 : 0, color: T.text, ...style,
    }}>{children}</div>
  );
}

// Hp dots row — 3 dots, one per HP. Pulses if low.
function HpDots({ hp, max = 3, color = '#F5F5F7', size = 6 }) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < hp;
        const danger = hp === 1 && filled;
        return (
          <div key={i} style={{
            width: size, height: size, borderRadius: '50%',
            background: filled ? (danger ? '#FF453A' : color) : 'transparent',
            border: filled ? 'none' : `1px solid ${color}44`,
            animation: danger ? 'pulse 0.9s ease-in-out infinite' : 'none',
          }} />
        );
      })}
    </div>
  );
}

// Inline progress bar.
function Progress({ value = 0, max = 100, color = '#FFD60A', height = 3, bg = 'rgba(255,255,255,.08)' }) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div style={{ width: '100%', height, background: bg, borderRadius: 999, overflow: 'hidden' }}>
      <div style={{
        width: `${pct * 100}%`, height: '100%', background: color,
        borderRadius: 999, transition: 'width .3s ease-out',
        boxShadow: `0 0 8px ${color}88`,
      }} />
    </div>
  );
}

// Inject one global stylesheet (animations, font imports).
function GlobalStyle() {
  React.useEffect(() => {
    if (document.getElementById('arena-global')) return;
    const s = document.createElement('style');
    s.id = 'arena-global';
    s.textContent = `
      @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.35 } }
      @keyframes float { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-3px) } }
      @keyframes glow {
        0%,100% { filter: brightness(1) }
        50% { filter: brightness(1.15) }
      }
      @keyframes spin360 { to { transform: rotate(360deg) } }
      @keyframes fadeUp { from { opacity:.001; transform: translateY(8px)} to { opacity:1; transform: translateY(0)} }
      @keyframes shimmer {
        0% { background-position: -200% 0 }
        100% { background-position: 200% 0 }
      }
      .arena-fadeUp { animation: fadeUp .5s cubic-bezier(.34,1.56,.64,1) both }
    `;
    document.head.appendChild(s);
  }, []);
  return null;
}

Object.assign(window, {
  PLAYER_COLORS, THEMES, Screen, Logo, AntMarker, PrimaryButton, GhostButton,
  Mono, Eyebrow, Chip, Card, HpDots, Progress, GlobalStyle,
});
