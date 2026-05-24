// screens-credits.jsx — Credits / about screen.
// Layout: left column with logo + version stats, right column with sections of contributors and tech.

const CREDITS_SECTIONS = [
  {
    title: 'design',
    people: [
      { role: 'art direction',     name: 'studio anomaly · in-house' },
      { role: 'product design',    name: 'liana koren' },
      { role: 'motion · juice',    name: 'devin park' },
      { role: 'sound design',      name: 'minor void · audio lab' },
    ],
  },
  {
    title: 'engineering',
    people: [
      { role: 'simulation engine', name: 'isa morrow · ant kernel v3' },
      { role: 'netcode',           name: 'patrick saito · 10tps sync' },
      { role: 'ui · frontend',     name: 'rita zhao · react + canvas' },
      { role: 'matchmaker',        name: 'farid almasi · elo + region' },
      { role: 'tools',             name: 'olafur reijn · sandbox' },
    ],
  },
  {
    title: 'production',
    people: [
      { role: 'creative lead',     name: 'sho takeda' },
      { role: 'production manager',name: 'eleni mavros' },
      { role: 'qa lead',           name: 'rafa ortega' },
      { role: 'community',         name: 'naomi gulati' },
    ],
  },
  {
    title: 'special thanks',
    people: [
      { role: 'cellular automata research', name: 'chris langton (1986) · prof. e. fredkin · prof. n. wolfram' },
      { role: 'playtesters · alpha',        name: '127 brave volunteers · spiral cup #01' },
      { role: 'open-source',                name: 'react · vite · pixijs · webaudio · jetbrains mono' },
    ],
  },
];

const TECH_LIST = [
  { label: 'engine',     value: 'custom cellular sim · 60-100 tps capacity' },
  { label: 'rendering',  value: 'canvas2d w/ pixijs accel · dpr-aware' },
  { label: 'network',    value: 'websocket + binary delta packets' },
  { label: 'audio',      value: 'webaudio · synthesised sfx · no samples' },
  { label: 'storage',    value: 'indexeddb · 30d replay history' },
  { label: 'analytics',  value: 'opt-in · anonymous match telemetry' },
  { label: 'license',    value: '© 2026 langton arena · all rights reserved' },
];

function CreditsDesktop({ width = 1280, height = 800, data, actions }) {
  const themeCtx = (window.useTheme && window.useTheme()) || null;
  const T = themeCtx?.tokens || window.THEME_TOKENS?.dark || null;
  const S = data || defaultState();
  const A = actions || defaultActions();
  const t = (window.useT && window.useT()) || ((k) => k);
  const tx = (key, fallback) => { const out = t(key); return out === key ? fallback : out; };

  return (
    <div style={{
      width, height, position: 'relative', overflow: 'hidden',
      background: T?.bg || (T.bg), color: T?.textPrimary || (T.textPrimary),
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <GlobalStyle />

      {/* Top bar */}
      <div style={{
        height: 64, padding: '0 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${T?.border || (T.border)}`,
        background: T?.bgElevated || 'transparent',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button onClick={A.onReturnToMenu} style={{
            appearance: 'none', cursor: 'pointer', background: 'transparent',
            border: `1px solid ${T?.border || T.borderStrong}`,
            color: T?.textPrimary || (T.textPrimary),
            width: 38, height: 38, borderRadius: 10, fontSize: 16,
          }}>←</button>
          <Logo size={20} color={T?.textPrimary || (T.textPrimary)} accent={T?.accent || (T.accent)} />
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
            color: T?.textMuted || (T.textMuted), letterSpacing: 2, textTransform: 'uppercase',
          }}>· {tx('credits.title', 'credits')}</span>
        </div>
        <PingIndicator pingMs={S.pingMs} jitter={S.connection?.jitterMs} compact />
      </div>

      {/* Body */}
      <div style={{
        display: 'grid', gridTemplateColumns: '380px 1fr', height: height - 64,
      }}>
        {/* Left rail */}
        <div style={{
          padding: '40px 36px', borderRight: '1px solid rgba(255,255,255,.06)',
          display: 'flex', flexDirection: 'column', gap: 28, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -120, right: -100, width: 320, height: 320,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,214,10,.10), transparent 70%)',
            pointerEvents: 'none',
          }}/>
          <div style={{
            position: 'absolute', bottom: -100, left: -80, width: 240, height: 240,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(199,125,255,.08), transparent 70%)',
            pointerEvents: 'none',
          }}/>

          <Logo size={36} />

          <div>
            <h1 style={{
              margin: 0, fontSize: 40, fontWeight: 900,
              letterSpacing: -1.5, lineHeight: 1, color: (T.textPrimary),
              fontFamily: 'Inter, sans-serif',
            }}>
              Built by<br/>
              <span style={{
                background: 'linear-gradient(90deg, #FFD60A, #FF8A3D)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>cellular hands</span>
            </h1>
            <p style={{
              margin: '20px 0 0', color: (T.textMuted), fontSize: 13, lineHeight: 1.65, maxWidth: 320,
            }}>
              Langton Arena is a multiplayer take on Langton's ant — the simplest cellular automaton that
              still produces emergent highways. Everything you see is open data; everything you do is signal.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 'auto' }}>
            <CreditsKV label="version"      value={S.version || 'v1.0'} />
            <CreditsKV label="build"        value={S.buildHash || 'a47bc89'} />
            <CreditsKV label="server"       value={S.serverRegion || 'eu-west'} />
            <CreditsKV label="season"       value={S.status?.seasonName?.toLowerCase() || 'spiral'} />
            <CreditsKV label="matches live" value={(S.status?.activeMatches || 0).toLocaleString()} />
            <CreditsKV label="players"      value={(S.status?.online || 0).toLocaleString()} />
          </div>
        </div>

        {/* Right scroll */}
        <div style={{ padding: '40px 56px', overflow: 'auto' }}>
          <div style={{ maxWidth: 680 }}>
            {CREDITS_SECTIONS.map((sec, i) => (
              <div key={sec.title} style={{ marginBottom: 40 }}>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                  color: (T.accent), letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16,
                }}>{String(i + 1).padStart(2, '0')} · {sec.title}</div>
                {sec.people.map((p, j) => (
                  <div key={j} style={{
                    display: 'grid', gridTemplateColumns: '220px 1fr',
                    gap: 24, alignItems: 'baseline',
                    padding: '11px 0',
                    borderBottom: '1px solid rgba(255,255,255,.05)',
                  }}>
                    <span style={{ color: T.textDim, fontSize: 12 }}>{p.role}</span>
                    <span style={{ color: (T.textPrimary), fontSize: 14, fontWeight: 500 }}>{p.name}</span>
                  </div>
                ))}
              </div>
            ))}

            <div style={{ marginTop: 60, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,.06)' }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                color: T.info, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16,
              }}>tech</div>
              {TECH_LIST.map((t) => (
                <div key={t.label} style={{
                  display: 'grid', gridTemplateColumns: '120px 1fr',
                  gap: 24, padding: '8px 0', fontSize: 12,
                }}>
                  <span style={{ color: T.textDim, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: 0.6 }}>{t.label}</span>
                  <span style={{ color: T.textSecondary }}>{t.value}</span>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 56, padding: 24, borderRadius: 14,
              background: 'rgba(255,214,10,.05)', border: '1px solid rgba(255,214,10,.18)',
              display: 'flex', alignItems: 'center', gap: 20,
            }}>
              <div style={{ fontSize: 32 }}>◇</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: (T.accent) }}>Want to make ants with us?</div>
                <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4 }}>
                  We hire designers, engineers and community managers. Open positions in the news feed.
                </div>
              </div>
              <button style={{
                appearance: 'none', cursor: 'pointer',
                background: (T.accent), color: (T.bg),
                border: 'none', padding: '10px 16px', borderRadius: 8,
                fontWeight: 700, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase',
                fontFamily: 'Inter, sans-serif',
              }}>Careers →</button>
            </div>
          </div>
        </div>
      </div>

      <SystemOverlays data={S} actions={A} />
    </div>
  );
}

function CreditsKV({ label, value }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 8,
      background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
    }}>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
        color: T.textDim, letterSpacing: 1.5, textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600, color: (T.textPrimary), marginTop: 4 }}>{value}</div>
    </div>
  );
}

Object.assign(window, { CreditsDesktop });
