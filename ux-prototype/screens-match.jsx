// screens-match.jsx — Live match HUD (desktop + mobile).
// v0.5: real HP, collisions, audio fx, mid-match rule swap with cooldown, match-end auto-transition.

// Format seconds → "M:SS".
function fmtTime(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

// Build a Result.rows payload from a sim snapshot. Sorted by territory desc.
function buildResultRows(stats, players) {
  const arr = stats.territoryPct.map((pct, i) => ({
    playerId: i,
    pct: pct * 100,
    cells: stats.counts[i],
    lost: 5 - stats.alive[i],
    kills: 0,                              // not tracked yet
    sr: '+0',                              // controller can rewrite this
    peak: '',
    isYou: i === 0,
  }));
  arr.sort((a, b) => b.pct - a.pct);
  arr.forEach((r, idx) => { r.place = idx + 1; });
  return arr;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook removed: live-match logic is now inline inside MatchHudDesktop and
// MatchHudMobile, because it needs closure access to simRef returned by
// useLangtonField. Helpers below are still exported for reuse.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// MATCH HUD — desktop.
// ─────────────────────────────────────────────────────────────────────────────
function MatchHudDesktop({ width = 1280, height = 800, data, actions }) {
  const S = data || defaultState();
  const A = actions || defaultActions();
  const t = (window.useT && window.useT()) || ((k) => k);
  const tx = (key, fallback) => { const out = t(key); return out === key ? fallback : out; };
  const m = S.match;
  const players = m.playerCount;
  const fieldW = m.fieldW, fieldH = m.fieldH;
  const tps = m.tps;
  const live = !!m.live;
  const yourPlayerId = m.yourPlayerId ?? 0;

  const ants = React.useMemo(() => {
    const rules = ['RL', 'LRR', 'LR', 'RLR'];
    return spawnAnts({
      w: fieldW, h: fieldH, players, perPlayer: 5,
      rule: (p, k) => rules[(p + k) % rules.length], seed: 42,
      startHp: m.startHp || 3,
    });
  }, [players, fieldW, fieldH, m.startHp]);

  const palette = PLAYER_COLORS.slice(0, players).map((p) => p.hex);
  const cellSize = Math.min(Math.floor((width - 480) / fieldW), Math.floor((height - 200) / fieldH));

  // Per-render refs.
  const [stats, setStats] = React.useState(null);
  const [leaderId, setLeaderId] = React.useState(null);
  const endedRef = React.useRef(false);
  const lastSoundRef = React.useRef({ capture: 0, clash: 0 });

  // onEvents → audio fx. Stable identity (deps only on tps/live).
  const onEvents = React.useCallback((ev) => {
    if (!live) return;
    const t = performance.now();
    if (ev.captures.length && t - lastSoundRef.current.capture > 180) {
      window.fx?.capture(); lastSoundRef.current.capture = t;
    }
    if (ev.collisions.length && t - lastSoundRef.current.clash > 120) {
      window.fx?.clash(); lastSoundRef.current.clash = t;
    }
    if (ev.deaths.length) window.fx?.death();
  }, [live]);

  const { canvasRef, simRef } = useLangtonField({
    w: fieldW, h: fieldH, cellSize, ants, palette, tps,
    glow: true, antScale: 0.78, bg: '#0A081A',
    onEvents,
  });

  // Poll sim → stats + end-detect. simRef is in closure.
  React.useEffect(() => {
    if (!live) return undefined;
    endedRef.current = false;
    const id = setInterval(() => {
      const sim = simRef.current; if (!sim) return;
      const agg = aggregateStats(sim, players); if (!agg) return;
      setStats(agg);

      // Lead change.
      let best = 0;
      for (let i = 1; i < agg.territoryPct.length; i++) {
        if (agg.territoryPct[i] > agg.territoryPct[best]) best = i;
      }
      setLeaderId((prev) => {
        if (prev !== null && prev !== best && best === yourPlayerId) window.fx?.lead();
        return best;
      });

      if (endedRef.current) return;
      const elapsed = agg.tick / tps;
      const timeUp = m.durationSec != null && elapsed >= m.durationSec;
      const oneTeam = agg.teamsAlive <= 1;
      if (timeUp || oneTeam) {
        endedRef.current = true;
        const rows = buildResultRows(agg, players);
        const you = rows.find((r) => r.isYou);
        const outcome = you?.place === 1 ? 'victory' : 'defeat';
        (outcome === 'victory' ? window.fx?.victory() : window.fx?.defeat());
        A.onMatchEnd?.({
          rows, outcome, place: you?.place ?? 0, of: players,
          duration: fmtTime(elapsed),
          totals: { tick: agg.tick, captures: 0, clashes: 0 },
        });
      }
    }, 200);
    return () => clearInterval(id);
  }, [live, players, tps, m.durationSec, yourPlayerId, A, simRef]);

  // Build sorted leaderboard. Prefer live stats if present.
  const sorted = React.useMemo(() => {
    if (live && stats) {
      return stats.territoryPct
        .map((pct, i) => ({ ...PLAYER_COLORS[i], pct, alive: stats.alive[i] }))
        .sort((a, b) => b.pct - a.pct);
    }
    return PLAYER_COLORS.slice(0, players).map((p) => ({ ...p, pct: 0, alive: 5 }))
      .sort((a, b) => b.pct - a.pct);
  }, [live, stats, players]);

  // Your ants — live from sim or static from data.
  const yourAnts = React.useMemo(() => {
    if (live && stats) {
      return stats.antsByOwner[yourPlayerId].map((a, i) => ({
        id: a.id, name: `A${i + 1}`, rule: ruleFromCode(a.rule), hp: a.hp,
        dead: a.dead, swapCooldown: a.swapCooldown,
      }));
    }
    return m.yourAnts;
  }, [live, stats, yourPlayerId, m.yourAnts]);

  // Derived timer / tick.
  const tick = live && stats ? stats.tick : m.tick;
  const timer = live
    ? fmtTime((m.durationSec ?? 0) - tick / tps)
    : m.timer;

  const youColor = PLAYER_COLORS[yourPlayerId].hex;
  const [muted, setMuted] = React.useState(false);
  const toggleMute = () => { const v = !muted; setMuted(v); window.fx?.setMuted(v); };

  // Swap-rule handler — mutates the live sim ant directly.
  const handleSwap = React.useCallback((antId, newRule) => {
    const sim = simRef.current; if (!sim) return;
    const a = sim.ants.find((x) => x.id === antId);
    if (!a || a.dead || a.swapCooldown > 0) return;
    const meta = RULE_META[newRule]; if (!meta) return;
    a.rule = meta.code;
    a.swapCooldown = Math.floor((m.swapCooldownSec || 12) * tps);
    window.fx?.ready();
    A.onSwapRule?.(antId, newRule);
  }, [simRef, A, m.swapCooldownSec, tps]);

  return (
    <Screen width={width} height={height}>
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 56,
        background: 'rgba(14,11,31,.6)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,.06)',
        display: 'flex', alignItems: 'center', padding: '0 20px', justifyContent: 'space-between', zIndex: 5,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={timer === '0:00' ? T.danger : (T.accent)} strokeWidth="1.6"><circle cx="8" cy="8" r="6.5"/><path d="M8 4v4l2.5 1.5"/></svg>
            <Mono size={26} weight={600} color={timer === '0:00' ? T.danger : (T.accent)}>{timer}</Mono>
          </div>
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,.1)' }} />
          <Mono size={11} color={T.textMuted}>tick {tick} · {tps} tps{live ? ' · live' : ''}</Mono>
        </div>
        <Chip color={T.accent} size="md">arena · ranked</Chip>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button style={iconBtnStyle} onClick={toggleMute} title="Mute audio">{muted ? '🔇' : '🔊'}</button>
          <button style={iconBtnStyle} onClick={A.onSettings}>⚙</button>
          <button style={{ ...iconBtnStyle, color: T.danger }} onClick={A.onQuit}>Q</button>
        </div>
      </div>

      <div style={{
        position: 'absolute', top: 56, left: 0, right: 0, bottom: 116,
        display: 'grid', gridTemplateColumns: '220px 1fr 200px', gap: 16, padding: 16,
      }}>
        <LeaderboardPanel sorted={sorted} yourId={yourPlayerId} />

        <div style={{
          background: '#0A081A', borderRadius: 14,
          border: '1px solid rgba(255,255,255,.06)', position: 'relative', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <canvas ref={canvasRef} style={{ display: 'block', imageRendering: 'pixelated', borderRadius: 8 }} />
          <div style={{ position: 'absolute', top: 10, left: 12 }}>
            <Eyebrow color={T.textDim}>arena · {fieldW}×{fieldH}</Eyebrow>
          </div>
          <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', gap: 6 }}>
            <Chip color={T.success} size="sm">● live</Chip>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PanelCard>
            <RowBetween>
              <Eyebrow>{tx('match.label.minimap',   'minimap')}</Eyebrow>
              <Mono size={9} color={T.textDim}>{fieldW}×{fieldH}</Mono>
            </RowBetween>
            <MinimapPreview width={172} height={120} stats={sorted} />
          </PanelCard>

          <PanelCard style={{ flex: 1 }}>
            <Eyebrow>{tx('match.label.events',    'events')}</Eyebrow>
            <EventFeed events={m.events} />
          </PanelCard>

          <PanelCard style={{ borderColor: `${youColor}44` }}>
            <Eyebrow color={youColor}>{tx('match.label.yourColony', 'your colony')}</Eyebrow>
            <Mono size={20} weight={600}>{((sorted.find((s) => s.id === yourPlayerId)?.pct || 0) * 100).toFixed(1)}%</Mono>
            <Mono size={10} color={T.textMuted}>+0.4% / 5s · combo ×{m.combo.count}</Mono>
          </PanelCard>
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 116,
        background: 'rgba(14,11,31,.6)', backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,.06)',
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 110 }}>
          <Eyebrow>{tx('match.label.yourAnts',   'your ants')}</Eyebrow>
          <Mono size={11} color={T.textMuted}>
            {yourAnts.filter(a => a.hp > 0).length} alive · {yourAnts.filter(a => a.hp <= 0).length} lost
          </Mono>
        </div>
        <div style={{ display: 'flex', gap: 10, flex: 1 }}>
          {yourAnts.map((ant, i) => (
            <AntCard key={ant.id ?? i} ant={ant} color={youColor} tps={tps}
              onSwap={live ? (rule) => handleSwap(ant.id, rule) : null}
              onClick={() => A.onSelectAnt(i)} />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, width: 110 }}>
          <Chip color={T.accent} size="sm" filled>combo ×{m.combo.count}</Chip>
          <Mono size={10} color={T.textMuted}>+57 cells / 30s</Mono>
        </div>
      </div>

      {m.combo.count >= 2 && (
        <div style={{ position: 'absolute', top: 90, right: 250, pointerEvents: 'none', animation: 'glow 2s ease-in-out infinite' }}>
          <div style={{ fontSize: 38, fontWeight: 900, color: (T.accent), letterSpacing: -1, textShadow: '0 0 24px #FFD60A88' }}>
            ×{m.combo.count} {m.combo.label}
          </div>
        </div>
      )}
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Translate code strings ('RL', 'LRR', ...) back to a friendly rule name.
// ─────────────────────────────────────────────────────────────────────────────
function ruleFromCode(code) {
  for (const [k, v] of Object.entries(RULE_META)) if (v.code === code) return k;
  return 'classic';
}

function PanelCard({ children, style }) {
  return (
    <div style={{
      background: 'rgba(22,18,42,.6)', backdropFilter: 'blur(20px)',
      borderRadius: 14, border: '1px solid rgba(255,255,255,.06)', padding: 12,
      display: 'flex', flexDirection: 'column', gap: 8, ...(style || {}),
    }}>{children}</div>
  );
}
function RowBetween({ children, style }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...(style || {}) }}>{children}</div>;
}

function LeaderboardPanel({ sorted, yourId = 0 }) {
  return (
    <PanelCard style={{ padding: 14, gap: 10 }}>
      <RowBetween><Eyebrow>{tx('match.label.standings', 'standings')}</Eyebrow><Mono size={10} color={T.textMuted}>live</Mono></RowBetween>
      {sorted.map((s, rank) => (
        <LeaderboardRow key={s.id} player={s} rank={rank} isYou={s.id === yourId} isLead={rank === 0} />
      ))}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Eyebrow>{tx('match.label.territoryTotal', 'territory · total')}</Eyebrow>
        <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', background: (T.border) }}>
          {sorted.map((s) => (
            <div key={s.id} style={{
              width: `${s.pct * 100}%`, background: s.hex,
              boxShadow: `0 0 8px ${s.hex}88`, transition: 'width .3s ease',
            }} />
          ))}
        </div>
      </div>
    </PanelCard>
  );
}

function LeaderboardRow({ player, rank, isYou, isLead, alive = 5 }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '14px 18px 1fr auto', alignItems: 'center', gap: 8,
      padding: '8px 10px', borderRadius: 8,
      background: isYou ? `${player.hex}14` : 'transparent',
      border: isYou ? `1px solid ${player.hex}44` : '1px solid transparent',
    }}>
      <Mono size={11} color={isLead ? (T.accent) : (T.textMuted)} weight={600}>{isLead ? '★' : rank + 1}</Mono>
      <AntMarker color={player.hex} size={14} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, overflow: 'hidden' }}>
        <span style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {player.name}
        </span>
        <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              width: 6, height: 3, borderRadius: 1,
              background: i < (player.alive ?? alive) ? player.hex : 'rgba(255,255,255,.1)',
            }} />
          ))}
        </div>
      </div>
      <Mono size={12} color={T.textPrimary} weight={600}>{(player.pct * 100).toFixed(1)}%</Mono>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AntCard — with cooldown overlay + rule-swap popover.
// ─────────────────────────────────────────────────────────────────────────────
function AntCard({ ant, color, tps = 18, onSwap, onClick }) {
  const ruleColor = (RULE_META[ant.rule] || RULE_META.classic).color;
  const hp = ant.hp;
  const dead = hp <= 0 || ant.dead;
  const low = hp === 1 && !dead;
  const cd = ant.swapCooldown ?? 0;
  const cdPct = cd > 0 ? cd / (tps * 12) : 0;       // 12-sec scale; harmless if longer
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!e.target.closest?.('[data-swap-popover]')) setOpen(false); };
    setTimeout(() => window.addEventListener('pointerdown', close), 0);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  const click = () => {
    if (dead) return;
    if (onSwap) setOpen((v) => !v);
    else onClick?.();
  };

  return (
    <div data-swap-popover style={{ position: 'relative', flex: 1 }}>
      <button onClick={click} style={{
        appearance: 'none', textAlign: 'left', cursor: dead ? 'default' : 'pointer',
        width: '100%', height: 80, padding: '10px 12px',
        background: dead ? 'rgba(255,255,255,.02)' : (low ? '#FF453A14' : 'rgba(255,255,255,.025)'),
        border: `1px solid ${dead ? (T.border) : (low ? '#FF453A66' : (T.border))}`,
        borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 6,
        animation: low ? 'pulse 1.1s ease-in-out infinite' : 'none', position: 'relative',
        opacity: dead ? 0.5 : 1, color: (T.textPrimary), overflow: 'hidden',
      }}>
        {/* cooldown wash */}
        {cd > 0 && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `linear-gradient(to top, rgba(255,255,255,.06) ${cdPct * 100}%, transparent ${cdPct * 100}%)`,
          }} />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
          <AntMarker color={color} size={18} dim={dead} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <Mono size={10} color={T.textMuted}>ANT {ant.name}</Mono>
            <span style={{ fontSize: 11, fontWeight: 600, color: dead ? '#5A5870' : ruleColor, textTransform: 'capitalize' }}>
              {ant.rule}
            </span>
          </div>
          {onSwap && !dead && cd === 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 10, color: (T.accent), fontWeight: 700, letterSpacing: 0.4 }}>SWAP</span>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', position: 'relative' }}>
          {dead ? <Mono size={10} color={T.textDim}>DOWN</Mono> : <HpDots hp={hp} max={3} />}
          {cd > 0 ? (
            <Mono size={10} color={T.textMuted}>CD {(cd / tps).toFixed(1)}s</Mono>
          ) : (
            <Mono size={10} color={low ? T.danger : (T.textMuted)} weight={600}>{dead ? '' : `HP ${hp}`}</Mono>
          )}
        </div>
      </button>

      {open && onSwap && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'rgba(14,11,31,.95)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: 8,
          boxShadow: '0 12px 40px rgba(0,0,0,.6)', zIndex: 50,
        }}>
          <Eyebrow style={{ marginBottom: 6 }}>{tx('match.label.swapRule',  'swap rule')}</Eyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {Object.keys(RULE_META).map((k) => {
              const meta = RULE_META[k];
              const active = ant.rule === k;
              return (
                <button key={k} onClick={() => { onSwap(k); setOpen(false); }} style={{
                  appearance: 'none', cursor: 'pointer', background: active ? `${meta.color}28` : 'transparent',
                  border: `1px solid ${active ? meta.color : 'rgba(255,255,255,.1)'}`,
                  borderRadius: 6, padding: '8px 10px', textAlign: 'left',
                  color: (T.textPrimary), fontFamily: 'Inter, sans-serif',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, boxShadow: `0 0 6px ${meta.color}` }} />
                    <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>{k}</span>
                  </div>
                  <Mono size={9} color={T.textMuted} style={{ marginTop: 3, display: 'block' }}>{meta.code}</Mono>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MinimapPreview({ width, height, stats }) {
  return (
    <div style={{
      width, height, background: '#0A081A',
      borderRadius: 8, position: 'relative', overflow: 'hidden',
      border: '1px solid rgba(255,255,255,.06)',
    }}>
      <div style={{ position: 'absolute', top: '20%', left: '15%', width: '40%', height: '45%', background: `${stats[0]?.hex}66`, filter: 'blur(8px)', borderRadius: '60% 40% 50% 50%' }} />
      <div style={{ position: 'absolute', top: '40%', left: '50%', width: '35%', height: '40%', background: `${stats[1]?.hex}55`, filter: 'blur(8px)', borderRadius: '40% 60%' }} />
      {stats[2] && <div style={{ position: 'absolute', top: '10%', right: '10%', width: '25%', height: '30%', background: `${stats[2]?.hex}44`, filter: 'blur(8px)', borderRadius: '50%' }} />}
      {stats[3] && <div style={{ position: 'absolute', bottom: '10%', left: '40%', width: '25%', height: '25%', background: `${stats[3]?.hex}33`, filter: 'blur(8px)', borderRadius: '50%' }} />}
      {[[28, 30], [44, 38], [62, 58], [80, 22], [50, 78]].map((p, i) => (
        <div key={i} style={{
          position: 'absolute', left: `${p[0]}%`, top: `${p[1]}%`,
          width: 5, height: 5, borderRadius: '50%',
          background: stats[0]?.hex, boxShadow: `0 0 6px ${stats[0]?.hex}`,
          transform: 'translate(-50%,-50%)',
        }} />
      ))}
      {[[15, 60], [85, 40], [50, 15]].map((p, i) => (
        <div key={`e${i}`} style={{
          position: 'absolute', left: `${p[0]}%`, top: `${p[1]}%`,
          width: 5, height: 5, borderRadius: '50%',
          background: T.danger, boxShadow: '0 0 8px #FF453A',
          transform: 'translate(-50%,-50%)', animation: 'pulse 1s infinite',
        }} />
      ))}
      <div style={{
        position: 'absolute', top: '30%', left: '30%', width: '40%', height: '40%',
        border: '1.5px solid rgba(255,255,255,.45)', borderRadius: 4,
      }} />
    </div>
  );
}

function EventFeed({ events }) {
  const icon = { capture: '◈', clash: '⚡', lead: '★', damage: '▼', death: '✕' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
      {events.map((e, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '14px 1fr auto', gap: 6, alignItems: 'center',
          padding: '3px 0', opacity: 1 - i * 0.1,
        }}>
          <span style={{ color: PLAYER_COLORS[0].hex, fontSize: 10 }}>{icon[e.type]}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
            <AntMarker color={PLAYER_COLORS[e.who].hex} size={8} />
            <span style={{ color: (T.textPrimary), fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {e.text}
            </span>
          </div>
          <Mono size={9} color={T.textDim}>{e.t}</Mono>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCH HUD — mobile.
// ─────────────────────────────────────────────────────────────────────────────
function MatchHudMobile({ width = 390, height = 844, data, actions }) {
  const S = data || defaultState();
  const A = actions || defaultActions();
  const m = S.match;
  const players = m.playerCount;
  const fieldW = 30, fieldH = 30;
  const tps = Math.min(20, m.tps);
  const live = !!m.live;
  const yourPlayerId = m.yourPlayerId ?? 0;

  const ants = React.useMemo(() => spawnAnts({
    w: fieldW, h: fieldH, players, perPlayer: 3,
    rule: (p, k) => ['RL', 'LRR', 'LR'][k % 3], seed: 123, startHp: m.startHp || 3,
  }), [players, m.startHp]);
  const palette = PLAYER_COLORS.slice(0, players).map((p) => p.hex);
  const cellSize = Math.floor((width - 32) / fieldW);

  const [stats, setStats] = React.useState(null);
  const endedRef = React.useRef(false);

  const { canvasRef, simRef } = useLangtonField({
    w: fieldW, h: fieldH, cellSize, ants, palette, tps,
    glow: true, antScale: 0.8, bg: '#0A081A',
    onEvents: (ev) => {
      if (ev.deaths.length) window.fx?.death();
      else if (ev.collisions.length) window.fx?.clash();
    },
  });

  React.useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => {
      const agg = aggregateStats(simRef.current, players);
      if (!agg) return;
      setStats(agg);
      if (endedRef.current) return;
      const elapsed = agg.tick / tps;
      if ((m.durationSec != null && elapsed >= m.durationSec) || agg.teamsAlive <= 1) {
        endedRef.current = true;
        const rows = buildResultRows(agg, players);
        const you = rows.find((r) => r.isYou);
        A.onMatchEnd?.({
          rows, outcome: you?.place === 1 ? 'victory' : 'defeat',
          place: you?.place ?? 0, of: players, duration: fmtTime(elapsed),
          totals: { tick: agg.tick, captures: 0, clashes: 0 },
        });
      }
    }, 250);
    return () => clearInterval(id);
  }, [live, players, tps, m.durationSec, simRef, A]);

  const sorted = React.useMemo(() => {
    if (live && stats) {
      return stats.territoryPct
        .map((pct, i) => ({ ...PLAYER_COLORS[i], pct, alive: stats.alive[i] }))
        .sort((a, b) => b.pct - a.pct);
    }
    return PLAYER_COLORS.slice(0, players).map((p) => ({ ...p, pct: 0 })).sort((a, b) => b.pct - a.pct);
  }, [live, stats, players]);

  const yourAnts = live && stats
    ? stats.antsByOwner[yourPlayerId].map((a, i) => ({ ...a, name: `A${i + 1}` }))
    : m.yourAnts;
  const tick = live && stats ? stats.tick : m.tick;
  const timer = live ? fmtTime((m.durationSec ?? 0) - tick / tps) : m.timer;

  return (
    <Screen width={width} height={height}>
      <StatusBarMobile />

      <div style={{
        position: 'absolute', top: 50, left: 14, right: 14, height: 48,
        background: 'rgba(22,18,42,.6)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '0 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Mono size={20} weight={600} color={timer === '0:00' ? T.danger : (T.accent)}>{timer}</Mono>
        <Mono size={10} color={T.textMuted}>tick {tick}</Mono>
        <button onClick={A.onSettings} style={{ ...iconBtnStyle, width: 28, height: 28 }}>⚙</button>
      </div>

      <div style={{
        position: 'absolute', top: 110, left: 14, right: 14,
        background: 'rgba(22,18,42,.6)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: 10,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {sorted.map((s, i) => (
          <div key={s.id} style={{
            display: 'grid', gridTemplateColumns: '12px 14px 1fr auto', alignItems: 'center', gap: 8,
            padding: '4px 6px', borderRadius: 6,
            background: s.id === yourPlayerId ? `${s.hex}10` : 'transparent',
          }}>
            <Mono size={10} color={i === 0 ? (T.accent) : (T.textMuted)} weight={600}>{i === 0 ? '★' : i + 1}</Mono>
            <AntMarker color={s.hex} size={10} />
            <span style={{ fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
            <Mono size={11} weight={600}>{(s.pct * 100).toFixed(1)}%</Mono>
          </div>
        ))}
      </div>

      <div style={{
        position: 'absolute', top: 240, left: 14, right: 14,
        background: '#0A081A', borderRadius: 12, border: '1px solid rgba(255,255,255,.06)',
        padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <canvas ref={canvasRef} style={{ display: 'block', imageRendering: 'pixelated', borderRadius: 6 }} />
      </div>

      <div style={{
        position: 'absolute', bottom: 20, left: 14, right: 14,
        background: 'rgba(22,18,42,.6)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: 10,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Eyebrow>your ants · {yourAnts.filter(a => a.hp > 0).length} alive</Eyebrow>
          <Chip color={T.accent} size="sm" filled>×{m.combo.count}</Chip>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
          {yourAnts.slice(0, 5).map((a, i) => <MobileAntChip key={a.id ?? i} ant={a} onClick={() => A.onSelectAnt(i)} />)}
        </div>
      </div>
    </Screen>
  );
}

function MobileAntChip({ ant, onClick }) {
  const hp = ant.hp;
  const dead = hp <= 0 || ant.dead, low = hp === 1 && !dead;
  return (
    <button onClick={onClick} style={{
      appearance: 'none', cursor: 'pointer', color: '#fff',
      height: 52, borderRadius: 8, padding: 6,
      background: dead ? 'rgba(255,255,255,.02)' : (low ? '#FF453A18' : 'rgba(255,255,255,.04)'),
      border: dead ? '1px dashed rgba(255,255,255,.1)' : (low ? '1px solid #FF453A66' : '1px solid rgba(255,255,255,.08)'),
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      animation: low ? 'pulse 1s infinite' : 'none', opacity: dead ? 0.5 : 1,
    }}>
      {dead ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.textDim }}>✕</div>
      ) : (
        <>
          <AntMarker color={PLAYER_COLORS[0].hex} size={14} />
          <HpDots hp={hp} max={3} size={4} />
        </>
      )}
    </button>
  );
}

Object.assign(window, { MatchHudDesktop, MatchHudMobile, fmtTime, buildResultRows });
