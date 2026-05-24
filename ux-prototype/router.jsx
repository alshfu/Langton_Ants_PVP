// router.jsx — Simple screen router for the desktop / mobile prototypes.
// Manages: current screen, full app state (matches our state.jsx shape),
// browser hash so users can deep-link to a screen, and a floating nav bar.

// Screen ids used in the hash + the nav.
const DESKTOP_FLOW = [
  { id: 'menu',     label: '01 · Menu' },
  { id: 'finding',  label: '02 · Find' },
  { id: 'lobby',    label: '03 · Lobby' },
  { id: 'hud',      label: '04 · Match' },
  { id: 'result-a', label: '05a · Result · classic' },
  { id: 'result-b', label: '05b · Result · hero' },
  { id: 'result-c', label: '05c · Result · grid' },
  { id: 'reward',   label: '06 · Reward' },
  { id: 'tutorial', label: '— · Tutorial' },
  { id: 'profile',  label: '07 · Profile' },
  { id: 'match-detail', label: '08 · Match detail' },
  { id: 'meta',     label: '09 · Meta' },
  { id: 'leaderboard', label: '10 · Leaderboard' },
  { id: 'sandbox',     label: '11 · Sandbox' },
  { id: 'settings',    label: '12 · Settings' },
  { id: 'credits',     label: '13 · Credits' },
  { id: 'changelog',   label: '14 · Changelog' },
];

const MOBILE_FLOW = [
  { id: 'menu',    label: '01 · Menu' },
  { id: 'finding', label: '02 · Find' },
  { id: 'lobby',   label: '03 · Lobby' },
  { id: 'hud',     label: '04 · Match' },
  { id: 'result',  label: '05 · Result' },
  { id: 'reward',  label: '06 · Reward' },
  { id: 'profile', label: '07 · Profile' },
  { id: 'leaderboard', label: '08 · Leaderboard' },
];

// ─────────────────────────────────────────────────────────────────────────────
// useRouter — manages current screen id + hash sync.
// ─────────────────────────────────────────────────────────────────────────────
function useRouter(flow, defaultId) {
  const [screen, setScreen] = React.useState(() => {
    const h = (location.hash || '').replace('#', '');
    return flow.find((s) => s.id === h)?.id || defaultId || flow[0].id;
  });
  React.useEffect(() => {
    if (location.hash.replace('#', '') !== screen) {
      history.replaceState(null, '', `#${screen}`);
    }
  }, [screen]);
  React.useEffect(() => {
    const fn = () => {
      const h = (location.hash || '').replace('#', '');
      const found = flow.find((s) => s.id === h);
      if (found) setScreen(found.id);
    };
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, [flow]);

  const idx = flow.findIndex((s) => s.id === screen);
  return {
    screen,
    setScreen,
    next: () => setScreen(flow[Math.min(flow.length - 1, idx + 1)].id),
    prev: () => setScreen(flow[Math.max(0, idx - 1)].id),
    idx,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// useAppState — exposes data + actions.
// Controllers can call setData(patch) to replace any sub-tree.
// ─────────────────────────────────────────────────────────────────────────────
function useAppState(initialPatch = {}) {
  const [data, setData] = React.useState(() => ({ ...defaultState(), ...initialPatch }));

  // Helper — update a top-level key, e.g. updateKey('lobby', { countdown: '0:23' }).
  const updateKey = React.useCallback((key, patch) => {
    setData((d) => ({ ...d, [key]: typeof patch === 'function' ? patch(d[key]) : { ...d[key], ...patch } }));
  }, []);

  return { data, setData, updateKey };
}

// ─────────────────────────────────────────────────────────────────────────────
// NavBar — floating prev/next + jump-to control.
// ─────────────────────────────────────────────────────────────────────────────
function NavBar({ flow, screen, onSet, onPrev, onNext, position = 'bottom' }) {
  const [open, setOpen] = React.useState(false);
  const current = flow.find((s) => s.id === screen);
  const pos = position === 'bottom'
    ? { bottom: 20, left: '50%', transform: 'translateX(-50%)' }
    : { top: 20, left: '50%', transform: 'translateX(-50%)' };

  return (
    <div style={{
      position: 'fixed', ...pos, zIndex: 100,
      background: 'rgba(14,11,31,.85)', backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,.1)', borderRadius: 999,
      padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6,
      boxShadow: '0 12px 40px rgba(0,0,0,.5)',
      fontFamily: 'Inter, sans-serif',
    }}>
      <button onClick={onPrev} style={navBtn}>‹</button>
      <button onClick={() => setOpen((v) => !v)} style={{
        ...navBtn, padding: '0 14px', minWidth: 140, gap: 6,
        background: 'rgba(255,255,255,.06)', borderRadius: 999,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#F5F5F7', letterSpacing: 0.3 }}>
          {current?.label || screen}
        </span>
      </button>
      <button onClick={onNext} style={navBtn}>›</button>

      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', marginBottom: 12, left: '50%',
          transform: 'translateX(-50%)', background: 'rgba(14,11,31,.95)',
          backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 12, padding: 6, display: 'flex', flexDirection: 'column',
          gap: 2, minWidth: 220, boxShadow: '0 16px 60px rgba(0,0,0,.6)',
        }}>
          {flow.map((s) => (
            <button key={s.id} onClick={() => { onSet(s.id); setOpen(false); }} style={{
              appearance: 'none', cursor: 'pointer',
              background: s.id === screen ? 'rgba(255,214,10,.12)' : 'transparent',
              border: 'none', color: s.id === screen ? '#FFD60A' : '#F5F5F7',
              padding: '8px 12px', borderRadius: 7, textAlign: 'left',
              fontSize: 12, fontWeight: 500, fontFamily: 'Inter, sans-serif',
            }}>
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const navBtn = {
  appearance: 'none', cursor: 'pointer',
  background: 'transparent', border: 'none', color: '#F5F5F7',
  width: 32, height: 32, borderRadius: 999, fontSize: 18,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'Inter, sans-serif',
};

// ─────────────────────────────────────────────────────────────────────────────
// Full-bleed wrapper — letterboxes a fixed-size design to the viewport.
// ─────────────────────────────────────────────────────────────────────────────
function FullBleedStage({ width, height, children, bg = '#0E0B1F' }) {
  const [scale, setScale] = React.useState(1);
  React.useEffect(() => {
    const fit = () => {
      const w = window.innerWidth, h = window.innerHeight;
      setScale(Math.min(w / width, h / height));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [width, height]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <div style={{
        width, height, transform: `scale(${scale})`, transformOrigin: 'center center',
      }}>
        {children}
      </div>
    </div>
  );
}

Object.assign(window, {
  DESKTOP_FLOW, MOBILE_FLOW,
  useRouter, useAppState, NavBar, FullBleedStage,
});
