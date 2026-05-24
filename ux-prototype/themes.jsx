// themes.jsx — theme tokens per contract §9.1
// Six themes: dark, light, highContrast, colorblindProtanopia/Deuteranopia/Tritanopia.
// Components consume via useTheme() hook (reads window.__ARENA_THEME at mount + listens for change events).

const THEME_TOKENS = {
  dark: {
    bg: '#0E0B1F',
    bgElevated: '#16122A',
    bgOverlay: '#1E1938',
    bgInverted: '#F5F5F7',

    textPrimary:  '#F5F5F7',
    textSecondary:'#B0AEBC',
    textMuted:    '#8E8E93',
    textDim:      '#5A5870',
    textInverted: '#0E0B1F',
    textOnAccent: '#0E0B1F',

    border:       'rgba(255,255,255,.08)',
    borderStrong: 'rgba(255,255,255,.16)',
    borderFocus:  '#FFD60A',

    accent:      '#FFD60A',
    accentHover: '#FFE34A',
    accentMuted: 'rgba(255,214,10,.16)',

    success: '#39D98A', warning: '#FF8A3D', danger: '#FF453A', info: '#4DA8FF',

    radiusXs: 4, radiusSm: 6, radiusMd: 10, radiusLg: 16, radiusFull: 9999,

    shadowSm:  '0 2px 6px rgba(0,0,0,.25)',
    shadowMd:  '0 8px 24px rgba(0,0,0,.35)',
    shadowLg:  '0 16px 48px rgba(0,0,0,.55)',
    shadowGlow:'0 0 32px rgba(255,214,10,.45)',

    space1: 4, space2: 8, space3: 12, space4: 16, space5: 20,
    space6: 24, space8: 32, space10: 40, space12: 48, space16: 64,
  },

  light: {
    bg: '#F4F2EE', bgElevated: '#FFFFFF', bgOverlay: '#EDEAE3', bgInverted: '#0E0B1F',
    textPrimary: '#16122A', textSecondary: '#36324A', textMuted: '#7A7790',
    textDim:      '#9590A4',
    textInverted: '#F5F5F7', textOnAccent: '#16122A',
    border: 'rgba(20,16,40,.10)', borderStrong: 'rgba(20,16,40,.20)', borderFocus: '#C77400',
    accent: '#C77400', accentHover: '#A56000', accentMuted: 'rgba(199,116,0,.12)',
    success: '#1F8A5B', warning: '#D2691E', danger: '#D62A1F', info: '#1E63C6',
    radiusXs: 4, radiusSm: 6, radiusMd: 10, radiusLg: 16, radiusFull: 9999,
    shadowSm: '0 1px 3px rgba(20,16,40,.08)', shadowMd: '0 6px 18px rgba(20,16,40,.10)',
    shadowLg: '0 14px 36px rgba(20,16,40,.14)', shadowGlow: '0 0 28px rgba(199,116,0,.30)',
    space1: 4, space2: 8, space3: 12, space4: 16, space5: 20,
    space6: 24, space8: 32, space10: 40, space12: 48, space16: 64,
  },

  highContrast: {
    bg: '#000000', bgElevated: '#0A0A0A', bgOverlay: '#181818', bgInverted: '#FFFFFF',
    textPrimary: '#FFFFFF', textSecondary: '#FFFFFF', textMuted: '#C8C8C8',
    textDim:      '#888888',
    textInverted: '#000000', textOnAccent: '#000000',
    border: 'rgba(255,255,255,.42)', borderStrong: 'rgba(255,255,255,.72)', borderFocus: '#FFFF00',
    accent: '#FFFF00', accentHover: '#FFFFAA', accentMuted: 'rgba(255,255,0,.18)',
    success: '#00FF8A', warning: '#FFAA00', danger: '#FF3030', info: '#00DDFF',
    radiusXs: 2, radiusSm: 4, radiusMd: 6, radiusLg: 8, radiusFull: 9999,
    shadowSm: 'none', shadowMd: 'none', shadowLg: 'none', shadowGlow: 'none',
    space1: 4, space2: 8, space3: 12, space4: 16, space5: 20,
    space6: 24, space8: 32, space10: 40, space12: 48, space16: 64,
  },

  // Colorblind variants share dark surfaces; only player palette + accent shift.
  colorblindProtanopia: null,   // populated below
  colorblindDeuteranopia: null,
  colorblindTritanopia: null,
};

// Spread from dark for colorblind variants — they only override accent colors per WCAG.
THEME_TOKENS.colorblindProtanopia = {
  ...THEME_TOKENS.dark,
  success: '#4DA8FF', danger: '#FFE34A', warning: '#FFCC00', info: '#7DD3FC',
};
THEME_TOKENS.colorblindDeuteranopia = {
  ...THEME_TOKENS.dark,
  success: '#4DA8FF', danger: '#FF8A3D', warning: '#FFD60A', info: '#7DD3FC',
};
THEME_TOKENS.colorblindTritanopia = {
  ...THEME_TOKENS.dark,
  success: '#FF5470', danger: '#FF453A', warning: '#FFCC00', info: '#39D98A',
};

// Colorblind-safe player palette overrides — used by readers in matches.
const COLORBLIND_PALETTES = {
  off: null,                                          // use base palette
  protanopia:   ['#4DA8FF','#FFD60A','#7DD3FC','#FFFFFF','#00E5D1','#FFCC00','#C77DFF','#888888','#FF8A3D','#39D98A'],
  deuteranopia: ['#4DA8FF','#FFD60A','#FF8A3D','#FFFFFF','#7DD3FC','#FFCC00','#C77DFF','#888888','#39D98A','#FF4D9E'],
  tritanopia:   ['#FF5470','#39D98A','#FFCC00','#FFFFFF','#FF8A3D','#4DA8FF','#C77DFF','#888888','#7DD3FC','#FF4D9E'],
};

// Hook + context.
const ThemeContext = React.createContext({ theme: 'dark', tokens: THEME_TOKENS.dark, set: () => {} });

// Globally-readable accessor for use *anywhere* — module-level styles, helpers,
// non-component utilities. ThemeProvider mirrors its active tokens here on every
// commit, so the next render of any component sees the current theme.
function getActiveTokens() {
  return (typeof window !== 'undefined' && window.__ARENA_TOKENS) ||
         (typeof window !== 'undefined' && window.THEME_TOKENS && window.THEME_TOKENS.dark) ||
         THEME_TOKENS.dark;
}

// Proxy `T` — reading any property re-fetches active tokens. Use in JSX styles
// to get reactive theme tokens without needing useTheme() in every helper:
//   style={{ background: T.bg, color: T.textPrimary }}
// On theme change, parent re-renders → JSX re-evaluates → Proxy reads new tokens.
const T = (typeof Proxy !== 'undefined')
  ? new Proxy({}, { get(_, key) { return getActiveTokens()[key]; }})
  : THEME_TOKENS.dark;

function ThemeProvider({ initial = 'dark', children }) {
  const [theme, setTheme] = React.useState(initial);
  // Mirror active tokens onto window so non-hook callers (helpers, module-level
  // style objects) read the same theme as React components.
  React.useEffect(() => {
    window.__ARENA_TOKENS = THEME_TOKENS[theme] || THEME_TOKENS.dark;
    window.__ARENA_THEME = theme;
    window.dispatchEvent(new CustomEvent('arena-theme-change', { detail: { theme } }));
  }, [theme]);
  const value = React.useMemo(() => ({
    theme,
    tokens: THEME_TOKENS[theme] || THEME_TOKENS.dark,
    set: setTheme,
  }), [theme]);
  return React.createElement(ThemeContext.Provider, { value }, children);
}

function useTheme() {
  return React.useContext(ThemeContext);
}

// Ensure window.__ARENA_TOKENS is populated even before ThemeProvider mounts —
// so module-level reads at first paint don't return undefined.
if (typeof window !== 'undefined' && !window.__ARENA_TOKENS) {
  window.__ARENA_TOKENS = THEME_TOKENS.dark;
}

Object.assign(window, { THEME_TOKENS, COLORBLIND_PALETTES, ThemeProvider, useTheme, ThemeContext, T, getActiveTokens });
