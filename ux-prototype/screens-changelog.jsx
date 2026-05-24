// screens-changelog.jsx — Patch notes / changelog screen.
// Vertical timeline of releases.

const CHANGELOG_RELEASES = [
  {
    version: 'v1.0',
    date: '23 may 2026',
    label: 'season 02 launch',
    tone: 'major',
    headline: 'Spiral Season, ranked, and the contract-driven UI rewrite.',
    sections: [
      { kind: 'feature',  title: 'Ranked arena',           body: 'New SR-based ladder · 7 ranks · season rewards on promotion.' },
      { kind: 'feature',  title: 'Sandbox laboratory',     body: 'Local-only playground · 50+ tweakable params · preset slots.' },
      { kind: 'feature',  title: 'Settings · accessibility',body: 'Colorblind modes (proto/deutero/trita) · high-contrast theme · large text.' },
      { kind: 'design',   title: 'UI rewrite under contract', body: 'All 14 screens redrawn against the v1.0 interface contract. State-driven, no hidden coupling.' },
      { kind: 'tweak',    title: 'Combo system',           body: 'Combos now grant ×1.5/×2/×3 multiplier with WAVE/STORM/APOCALYPSE labels.' },
      { kind: 'fix',      title: 'Lobby chat scroll bug',  body: 'Chat no longer jumps when a system message arrives.' },
    ],
  },
  {
    version: 'v0.6',
    date: '02 may 2026',
    label: 'stats suite',
    tone: 'minor',
    headline: 'Profile graphs, match details, meta dashboard.',
    sections: [
      { kind: 'feature',  title: 'Profile page',            body: 'ELO trend · rule performance · heatmaps · achievements.' },
      { kind: 'feature',  title: 'Match detail screen',     body: 'Territory over time · win probability · per-player heatmaps.' },
      { kind: 'feature',  title: 'Meta dashboard',          body: 'Rule winrates · top comps · crosstab matchups.' },
      { kind: 'tweak',    title: 'Faster matchmaker',       body: 'Average wait dropped from 0:48 to 0:24.' },
    ],
  },
  {
    version: 'v0.5',
    date: '14 apr 2026',
    label: 'live combat',
    tone: 'minor',
    headline: 'Mid-match rule swaps and live collisions.',
    sections: [
      { kind: 'feature',  title: 'Rule swap',               body: 'Change an active ant\'s rule mid-match · 12s cooldown.' },
      { kind: 'feature',  title: 'HP & collisions',         body: 'Ants now have 3 HP · clashes deal 1 damage each.' },
      { kind: 'tweak',    title: 'Audio fx pass',           body: 'Synthesised SFX for capture, clash, lead change, death.' },
      { kind: 'fix',      title: 'Camera auto-follow snap', body: 'Smoother lerp when jumping between events.' },
    ],
  },
  {
    version: 'v0.4',
    date: '08 mar 2026',
    label: 'arena',
    tone: 'minor',
    headline: 'First PvP prototypes (desktop + mobile + canvas).',
    sections: [
      { kind: 'feature',  title: 'Matchmaking flow',        body: 'Mode select → finding → lobby → match → result.' },
      { kind: 'feature',  title: 'Reward open',             body: 'Lootbox preview with rarity-tinted background.' },
      { kind: 'tweak',    title: 'Design canvas',           body: 'Every screen visible side-by-side · pan/zoom.' },
    ],
  },
  {
    version: 'v0.3',
    date: '15 feb 2026',
    label: 'engine bake-off',
    tone: 'patch',
    headline: 'Internal alpha. Engine reached 60 tps on 100×100.',
    sections: [],
  },
];

const KIND_STYLE = {
  feature: { fg: T.success, bg: 'rgba(57,217,138,.10)', label: 'NEW'   },
  design:  { fg: '#C77DFF', bg: 'rgba(199,125,255,.10)', label: 'UX'   },
  tweak:   { fg: T.info, bg: 'rgba(77,168,255,.10)', label: 'TWEAK' },
  fix:     { fg: T.warning, bg: 'rgba(255,138,61,.10)', label: 'FIX'   },
};

function ChangelogDesktop({ width = 1280, height = 800, data, actions }) {
  const themeCtx = (window.useTheme && window.useTheme()) || null;
  const T = themeCtx?.tokens || window.THEME_TOKENS?.dark || null;
  const S = data || defaultState();
  const A = actions || defaultActions();
  const t = (window.useT && window.useT()) || ((k) => k);
  const tx = (key, fallback) => { const out = t(key); return out === key ? fallback : out; };
  const current = S.version || 'v1.0';

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
            color: (T.textMuted), letterSpacing: 2, textTransform: 'uppercase',
          }}>· {tx('changelog.title', 'changelog')}</span>
        </div>
        <PingIndicator pingMs={S.pingMs} jitter={S.connection?.jitterMs} compact />
      </div>

      {/* Header */}
      <div style={{
        padding: '40px 56px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 32,
      }}>
        <div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
            color: (T.accent), letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12,
          }}>patch notes · current · {current}</div>
          <h1 style={{
            margin: 0, fontSize: 44, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1,
            color: (T.textPrimary), fontFamily: 'Inter, sans-serif',
          }}>
            {tx('changelog.heading', "What's new in")}{' '}
            <span style={{
              background: 'linear-gradient(90deg, #FFD60A, #FF8A3D)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>the arena</span>
          </h1>
          <p style={{ margin: '14px 0 0', color: (T.textMuted), fontSize: 14, maxWidth: 480, lineHeight: 1.6 }}>
            Five releases since alpha. Each line below is a thing you can feel in a match — not just a
            checkbox in a roadmap.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['major', 'minor', 'patch'].map((t) => (
            <span key={t} style={{
              padding: '4px 10px', borderRadius: 999,
              background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
              fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
              color: (T.textMuted), letterSpacing: 0.8, textTransform: 'uppercase',
            }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ padding: '0 56px 40px', overflow: 'auto', height: height - 64 - 200 }}>
        <div style={{ position: 'relative', paddingLeft: 32, maxWidth: 920 }}>
          {/* Vertical line */}
          <div style={{
            position: 'absolute', left: 7, top: 8, bottom: 8,
            width: 2, background: 'linear-gradient(180deg, #FFD60A, rgba(255,214,10,.04))',
          }}/>

          {CHANGELOG_RELEASES.map((r, i) => {
            const isCurrent = r.version === current;
            return (
              <div key={r.version} style={{ position: 'relative', marginBottom: 40 }}>
                {/* Dot */}
                <div style={{
                  position: 'absolute', left: -32, top: 6,
                  width: 16, height: 16, borderRadius: '50%',
                  background: isCurrent ? (T.accent) : (T.bg),
                  border: `2px solid ${isCurrent ? (T.accent) : T.textDim}`,
                  boxShadow: isCurrent ? '0 0 16px rgba(255,214,10,.6)' : 'none',
                }}/>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 10 }}>
                  <h2 style={{
                    margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: -0.5,
                    color: isCurrent ? (T.accent) : (T.textPrimary),
                  }}>{r.version}</h2>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4,
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                    color: isCurrent ? (T.bg) : T.textSecondary,
                    background: isCurrent ? (T.accent) : (T.border),
                    letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700,
                  }}>{r.label}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: T.textDim }}>{r.date}</span>
                </div>

                <p style={{ margin: '0 0 16px', color: T.textSecondary, fontSize: 14, lineHeight: 1.5 }}>{r.headline}</p>

                {r.sections.length > 0 ? (
                  <div style={{
                    background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)',
                    borderRadius: 12, overflow: 'hidden',
                  }}>
                    {r.sections.map((s, j) => {
                      const k = KIND_STYLE[s.kind] || KIND_STYLE.tweak;
                      return (
                        <div key={j} style={{
                          display: 'grid', gridTemplateColumns: '70px 1fr',
                          gap: 16, padding: '14px 18px',
                          borderTop: j === 0 ? 'none' : '1px solid rgba(255,255,255,.04)',
                          alignItems: 'flex-start',
                        }}>
                          <span style={{
                            padding: '2px 6px', borderRadius: 4,
                            background: k.bg, color: k.fg,
                            fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700,
                            letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center',
                            border: `1px solid ${k.fg}33`,
                          }}>{k.label}</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: (T.textPrimary) }}>{s.title}</div>
                            <div style={{ fontSize: 12, color: (T.textMuted), marginTop: 3, lineHeight: 1.5 }}>{s.body}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: T.textDim, fontStyle: 'italic' }}>Internal release · no public notes.</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <SystemOverlays data={S} actions={A} />
    </div>
  );
}

Object.assign(window, { ChangelogDesktop, CHANGELOG_RELEASES });
