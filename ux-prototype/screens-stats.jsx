// screens-stats.jsx — Stats screens: Profile, Match Detail, Meta, Leaderboard.

const _PALETTE_BY_RULE = (rule) => (RULE_META[rule] || RULE_META.classic).color;

// Common panel.
function StatsPanel({ children, style, label, action }) {
  return (
    <div style={{
      background: 'rgba(22,18,42,.6)', backdropFilter: 'blur(20px)',
      borderRadius: 14, border: '1px solid rgba(255,255,255,.06)', padding: 16,
      display: 'flex', flexDirection: 'column', gap: 12, ...(style || {}),
    }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Eyebrow>{label}</Eyebrow>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// Inline tabs bar.
function TabsBar({ tabs, active, onSelect }) {
  return (
    <div style={{
      display: 'inline-flex', gap: 4, padding: 4,
      background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10,
    }}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onSelect(t.id)} style={{
          appearance: 'none', cursor: 'pointer', border: 'none',
          background: t.id === active ? 'rgba(255,214,10,.16)' : 'transparent',
          color: t.id === active ? (T.accent) : (T.textPrimary),
          fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 7,
          fontFamily: 'Inter, sans-serif', letterSpacing: 0.3,
          transition: 'background .14s ease',
        }}>{t.label}</button>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PROFILE — desktop.
// ═════════════════════════════════════════════════════════════════════════════
function ProfileDesktop({ width = 1280, height = 800, data, actions }) {
  const S = data || defaultState();
  const A = actions || defaultActions();
  const t = (window.useT && window.useT()) || ((k) => k);
  const tx = (key, fallback) => { const out = t(key); return out === key ? fallback : out; };
  const user = S.user;
  const p = S.profile;
  const tabs = [
    { id: 'overview',     label: tx('profile.tab.overview',     'Overview') },
    { id: 'history',      label: tx('profile.tab.history',      'History') },
    { id: 'heatmaps',     label: tx('profile.tab.heatmaps',     'Heat maps') },
    { id: 'achievements', label: tx('profile.tab.achievements', 'Achievements') },
  ];
  const [tab, setTab] = React.useState('overview');
  const userColor = PLAYER_COLORS[user.colorId].hex;

  return (
    <Screen width={width} height={height}>
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 60,
        background: 'rgba(14,11,31,.6)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,.06)',
        display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between', zIndex: 5,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={A.onMenu} style={{ ...iconBtnStyle, width: 32, height: 32 }}>‹</button>
          <Logo size={16} />
          <Eyebrow>· {tx('profile.title', 'profile')}</Eyebrow>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <GhostButton onClick={A.onOpenLeaderboard} size="sm">{tx('leaderboard.title', 'Leaderboard')}</GhostButton>
          <GhostButton onClick={A.onOpenMeta} size="sm">{tx('meta.title', 'Meta')}</GhostButton>
        </div>
      </div>

      {/* Identity header */}
      <div style={{
        position: 'absolute', top: 80, left: 24, right: 24, height: 120,
        background: 'rgba(22,18,42,.6)', backdropFilter: 'blur(20px)',
        borderRadius: 16, border: `1px solid ${userColor}33`, padding: '20px 24px',
        display: 'flex', alignItems: 'center', gap: 22,
      }}>
        {/* big marker + tier ring */}
        <div style={{ position: 'relative' }}>
          <Donut value={p.rank.pct} size={84} thickness={5} color={userColor}
            label="D" sub="III" />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AntMarker color={userColor} size={36} />
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.8 }}>{user.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Chip color={userColor} size="md" filled>{p.player?.rank?.label || p.rank?.tier}</Chip>
            <Mono size={13} color={T.textPrimary}>SR {user.sr}</Mono>
            <Mono size={11} color={T.textMuted}>{p.daysActive} days · {p.hoursPlayed}h played</Mono>
            <Chip color={T.warning} size="sm">{p.overview?.playStyle || p.playstyle?.type}</Chip>
          </div>
          <Mono size={10} color={T.textDim}>joined {p.joined} · {p.playstyle?.desc || ""}</Mono>
        </div>

        {/* Top-line stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, alignItems: 'center' }}>
          <MiniStat label="matches" value={(p.stats?.matchesPlayed ?? p.player?.matchesPlayed ?? p.totals?.matches)} />
          <MiniStat label="win rate" value={`${((p.player?.winRate ?? p.totals?.winRate) * 100).toFixed(1)}%`} color={T.success} />
          <MiniStat label="top-3 rate" value={`${((p.totals?.top3Rate ?? 0) * 100).toFixed(0)}%`} />
          <MiniStat label="streak" value={`${(p.player?.currentStreak ?? p.totals?.streak?.current ?? 0)} W`} color={T.accent} />
        </div>
      </div>

      {/* Tabs bar */}
      <div style={{ position: 'absolute', top: 220, left: 24, right: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <TabsBar tabs={tabs} active={tab} onSelect={setTab} />
        <Mono size={10} color={T.textDim}>last update · 2 min ago</Mono>
      </div>

      {/* Body */}
      <div style={{ position: 'absolute', top: 268, left: 24, right: 24, bottom: 24, overflow: 'hidden' }}>
        {tab === 'overview' && <ProfileOverview p={p} userColor={userColor} />}
        {tab === 'history' && <ProfileHistory history={S.matchHistory} onOpenMatch={A.onOpenMatch} />}
        {tab === 'heatmaps' && <ProfileHeatmaps p={p} />}
        {tab === 'achievements' && <ProfileAchievements ach={p.achievements} />}
      </div>
    </Screen>
  );
}

function MiniStat({ label, value, color = (T.textPrimary) }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1 }}>
      <Eyebrow>{label}</Eyebrow>
      <span style={{ fontFamily: 'JetBrains Mono', fontSize: 22, fontWeight: 700, color, marginTop: 4, letterSpacing: -0.4 }}>{value}</span>
    </div>
  );
}

// ─── Overview tab ──────────────────────────────────────────────────────────
function ProfileOverview({ p, userColor }) {
  const elo = p.eloSeries;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1.4fr 1fr', gridTemplateRows: 'auto auto',
      gap: 14, height: '100%',
    }}>
      <StatsPanel label="ELO · last 30 days" action={<Mono size={10} color={T.textMuted}>peak {Math.max(...elo).toFixed(0)} · now {elo.at(-1).toFixed(0)}</Mono>}>
        <LineChart
          series={[{ color: (T.accent), label: 'ELO', points: elo }]}
          width={680} height={170} fill
          yFormat={(v) => v.toFixed(0)}
          xLabels={['30d', '20d', '10d', 'today']}
        />
      </StatsPanel>

      <StatsPanel label="vs average · vs top-100">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
          <Radar data={p.vsAverage} size={200} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
            <RadarLegend color={T.accent} label="you" />
            <RadarLegend color={T.textMuted} label="average" />
            <RadarLegend color="#C77DFF" label="top-100" dashed />
          </div>
        </div>
      </StatsPanel>

      <StatsPanel label="win rate by rule" style={{ overflow: 'hidden' }}>
        <BarChart
          width={620}
          rows={p.rulePerf.map((r) => ({
            label: r.rule, value: r.winRate * 100, secondary: `${r.played} ants`,
            color: _PALETTE_BY_RULE(r.rule), max: 60,
          }))}
          max={60}
          format={(v) => v.toFixed(1) + '%'}
        />
      </StatsPanel>

      <StatsPanel label="top compositions">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {p.topComps.map((c, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center',
              padding: '8px 10px', borderRadius: 8,
              background: i === 0 ? 'rgba(255,214,10,.08)' : 'transparent',
              border: i === 0 ? '1px solid rgba(255,214,10,.22)' : '1px solid transparent',
            }}>
              <span style={{ fontSize: 12, color: (T.textPrimary) }}>{c.label}</span>
              <Mono size={11} color={T.textMuted}>{c.played}×</Mono>
              <Mono size={13} weight={700} color={c.winRate >= 0.5 ? T.success : T.warning}>{(c.winRate * 100).toFixed(1)}%</Mono>
            </div>
          ))}
        </div>
      </StatsPanel>
    </div>
  );
}

function RadarLegend({ color, label, dashed }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 16, height: 2, background: color, opacity: 0.9,
        borderRadius: 2, ...(dashed ? { borderTop: `2px dashed ${color}`, background: 'transparent', height: 0 } : {}),
      }} />
      <Mono size={10} color={T.textPrimary}>{label}</Mono>
    </div>
  );
}

// ─── History tab ───────────────────────────────────────────────────────────
function ProfileHistory({ history, onOpenMatch }) {
  return (
    <StatsPanel label="recent matches">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '28px 70px 1fr 80px 80px 60px 70px 50px',
          gap: 10, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,.06)',
        }}>
          {['', 'when', 'mode', 'territory', 'k / d', 'combo', 'sr', ''].map((h, i) => (
            <Eyebrow key={i} style={{ textAlign: i >= 3 && i <= 6 ? 'right' : 'left' }}>{h}</Eyebrow>
          ))}
        </div>
        {history.matches.map((m) => {
          const win = m.outcome === 'victory';
          const lose = m.outcome === 'defeat';
          return (
            <button key={m.id} onClick={() => onOpenMatch?.(m.id)} style={{
              appearance: 'none', cursor: 'pointer', textAlign: 'left',
              display: 'grid', gridTemplateColumns: '28px 70px 1fr 80px 80px 60px 70px 50px',
              gap: 10, padding: '12px 12px', alignItems: 'center', borderRadius: 8,
              background: 'rgba(255,255,255,.02)',
              border: '1px solid rgba(255,255,255,.04)', color: (T.textPrimary),
              borderLeft: `3px solid ${win ? T.success : (lose ? T.danger : (T.textMuted))}`,
            }}>
              <div style={{ fontSize: 16 }}>{win ? '🏆' : (lose ? '✕' : '–')}</div>
              <Mono size={11} color={T.textMuted}>{m.when}</Mono>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Chip color={T.accent} size="sm">arena</Chip>
                <Mono size={11} color={T.textMuted}>{m.players}P · {m.duration}</Mono>
                <Mono size={10} color={T.textDim}>#{m.id}</Mono>
              </div>
              <Mono size={13} weight={600} style={{ textAlign: 'right' }}>{(m.territory * 100).toFixed(1)}%</Mono>
              <Mono size={13} color={T.textMuted} style={{ textAlign: 'right' }}>{m.kd}</Mono>
              <Mono size={11} color={T.accent} style={{ textAlign: 'right' }}>×{m.combo}</Mono>
              <Mono size={13} weight={600} color={m.srDelta.startsWith('+') ? T.success : T.danger} style={{ textAlign: 'right' }}>{m.srDelta}</Mono>
              <span style={{ color: (T.textMuted), fontSize: 11, textAlign: 'right' }}>open ›</span>
            </button>
          );
        })}
      </div>
    </StatsPanel>
  );
}

// ─── Heat maps tab ─────────────────────────────────────────────────────────
function ProfileHeatmaps({ p }) {
  // Heatmaps was reshaped contract→array; lookup by id, fall back to legacy object form.
  const getMap = (id, ...aliases) => {
    if (Array.isArray(p?.heatmaps)) {
      return p.heatmaps.find((h) => h.id === id || aliases.includes(h.id));
    }
    return p?.heatmaps?.[id] || aliases.map((a) => p?.heatmaps?.[a]).find(Boolean);
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, height: '100%' }}>
      <StatsPanel label="where your ants die">
        <HeatMap map={getMap('deaths')} width={300} height={300} palette="fire" />
        <Mono size={10} color={T.textMuted}>your weak zones · 487 matches sampled</Mono>
      </StatsPanel>
      <StatsPanel label="dominance · your territory">
        <HeatMap map={getMap('dominance', 'leadership', 'activity')} width={300} height={300} palette="ice" />
        <Mono size={10} color={T.textMuted}>where you tend to control</Mono>
      </StatsPanel>
      <StatsPanel label="clashes you fought">
        <HeatMap map={getMap('clashes', 'kills')} width={300} height={300} palette={T.accent} />
        <Mono size={10} color={T.textMuted}>enemy contact frequency</Mono>
      </StatsPanel>
    </div>
  );
}

// ─── Achievements tab ──────────────────────────────────────────────────────
function ProfileAchievements({ ach }) {
  const done = ach.filter((a) => a.done).length;
  return (
    <StatsPanel label={`unlocked · ${done} / ${ach.length}`} action={
      <Mono size={10} color={T.textMuted}>progress 27%</Mono>
    }>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, overflow: 'auto' }}>
        {ach.map((a) => (
          <div key={a.id} style={{
            display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 12, alignItems: 'center',
            padding: 12, borderRadius: 10,
            background: a.done ? 'rgba(255,214,10,.08)' : 'rgba(255,255,255,.02)',
            border: a.done ? '1px solid rgba(255,214,10,.25)' : '1px solid rgba(255,255,255,.06)',
            opacity: a.done ? 1 : 0.92,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 9,
              background: a.done ? (T.accent) : 'rgba(255,255,255,.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              boxShadow: a.done ? '0 0 16px #FFD60A66' : 'none',
            }}>{a.done ? '🏆' : '🔒'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{a.name}</span>
                {a.done && <Mono size={9} color={T.accent}>{a.unlocked}</Mono>}
              </div>
              <Mono size={10} color={T.textMuted}>{a.desc}</Mono>
              {!a.done && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <div style={{ flex: 1 }}>
                    <Progress value={a.progress} max={a.target} color={T.accent} height={3} />
                  </div>
                  <Mono size={10} color={T.textMuted}>{a.progress}/{a.target}</Mono>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </StatsPanel>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MATCH DETAIL — desktop.
// ═════════════════════════════════════════════════════════════════════════════
function MatchDetailDesktop({ width = 1280, height = 800, data, actions }) {
  const S = data || defaultState();
  const A = actions || defaultActions();
  const t = (window.useT && window.useT()) || ((k) => k);
  const tx = (key, fallback) => { const out = t(key); return out === key ? fallback : out; };
  const md = S.matchDetail;
  const youRow = md.rows.find((r) => r.isYou) || md.rows[0];

  return (
    <Screen width={width} height={height}>
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 60,
        background: 'rgba(14,11,31,.6)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,.06)',
        display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between', zIndex: 5,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={A.onOpenProfile} style={{ ...iconBtnStyle, width: 32, height: 32 }}>‹</button>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Match #{md.id}</span>
            <Mono size={10} color={T.textMuted}>{md.date} · {md.mode}</Mono>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <GhostButton onClick={() => A.onPlayReplay?.(md.id)} size="sm">▶ Replay</GhostButton>
          <GhostButton size="sm">Export</GhostButton>
          <GhostButton size="sm">Share</GhostButton>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{
        position: 'absolute', top: 76, left: 24, right: 24, height: 84,
        display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12,
      }}>
        <StatPill label="duration"    value={md.duration} />
        <StatPill label="players"     value={`${md.players}P`} />
        <StatPill label="field"       value={md.fieldSize} />
        <StatPill label="your place"  value={`#${youRow.place}`} color={youRow.place === 1 ? (T.accent) : (T.textPrimary)} />
        <StatPill label="territory"   value={`${youRow.pct.toFixed(1)}%`} color={PLAYER_COLORS[youRow.playerId].hex} />
        <StatPill label="rating"      value={youRow.sr} color={youRow.sr.startsWith('+') ? T.success : T.danger} />
      </div>

      {/* Body */}
      <div style={{
        position: 'absolute', top: 176, left: 24, right: 24, bottom: 24,
        display: 'grid', gridTemplateColumns: '1.4fr 1fr', gridTemplateRows: 'auto 1fr', gap: 14,
      }}>
        <StatsPanel label="territory over time" action={<Mono size={10} color={T.textMuted}>5 min · 60 samples</Mono>}>
          <LineChart
            width={720} height={210}
            yMin={0} yMax={0.6}
            yFormat={(v) => (v * 100).toFixed(0) + '%'}
            xLabels={['0:00', '1:00', '2:00', '3:00', '4:00', '5:00']}
            series={md.territorySeries.map((s) => ({
              color: PLAYER_COLORS[s.playerId].hex,
              points: s.points,
            }))}
            fill
          />
        </StatsPanel>

        <StatsPanel label="your win probability" action={<Chip color={youRow.place === 1 ? T.success : T.danger} size="sm">{youRow.place === 1 ? 'won' : 'lost'}</Chip>}>
          <LineChart
            width={460} height={210}
            yMin={0} yMax={1}
            yFormat={(v) => (v * 100).toFixed(0) + '%'}
            series={[{ color: (T.accent), points: md.winProbability }]}
            xLabels={['0:00', '2:30', '5:00']}
            fill
          />
        </StatsPanel>

        {/* Per-player breakdown */}
        <StatsPanel label="per-player breakdown" style={{ overflow: 'auto' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '28px 22px 1fr 70px 70px 60px 70px 60px',
            gap: 10, padding: '0 8px 8px',
            borderBottom: '1px solid rgba(255,255,255,.06)',
          }}>
            {['#', '', 'player', 'pct', 'cells', 'k/d', 'combo', 'acc'].map((h, i) => (
              <Eyebrow key={i} style={{ textAlign: i >= 3 ? 'right' : 'left' }}>{h}</Eyebrow>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {md.rows.map((r) => {
              const pc = PLAYER_COLORS[r.playerId];
              return (
                <div key={r.playerId} style={{
                  display: 'grid', gridTemplateColumns: '28px 22px 1fr 70px 70px 60px 70px 60px',
                  gap: 10, padding: '8px', borderRadius: 6, alignItems: 'center',
                  background: r.isYou ? `${pc.hex}12` : 'transparent',
                  borderLeft: r.isYou ? `2px solid ${pc.hex}` : '2px solid transparent',
                }}>
                  <Mono size={12} weight={600} color={r.place === 1 ? (T.accent) : (T.textMuted)}>{r.place}</Mono>
                  <AntMarker color={pc.hex} size={14} />
                  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{pc.name}{r.isYou && <span style={{ color: (T.accent), marginLeft: 4 }}>·you</span>}</span>
                    <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                      {r.squad.map((rule, i) => (
                        <span key={i} title={rule} style={{
                          width: 6, height: 6, borderRadius: 2, background: _PALETTE_BY_RULE(rule),
                          boxShadow: `0 0 4px ${_PALETTE_BY_RULE(rule)}88`,
                        }} />
                      ))}
                    </div>
                  </div>
                  <Mono size={12} weight={600} style={{ textAlign: 'right' }}>{r.pct.toFixed(1)}%</Mono>
                  <Mono size={11} color={T.textMuted} style={{ textAlign: 'right' }}>{r.cells}</Mono>
                  <Mono size={11} color={T.textMuted} style={{ textAlign: 'right' }}>{r.kills}/{r.lost}</Mono>
                  <Mono size={11} color={T.accent} style={{ textAlign: 'right' }}>×{r.combo}</Mono>
                  <Mono size={11} color={T.success} style={{ textAlign: 'right' }}>{(r.accuracy * 100).toFixed(0)}%</Mono>
                </div>
              );
            })}
          </div>
        </StatsPanel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <StatsPanel label="your advanced metrics">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, alignItems: 'center' }}>
              <DonutMetric value={md.yourMetrics.accuracy} max={1} color={T.success} label="ACC" sub={`${(md.yourMetrics.accuracy * 100).toFixed(0)}%`} caption="accuracy" />
              <DonutMetric value={md.yourMetrics.survivability} max={1} color={T.accent} label="SURV" sub={`${(md.yourMetrics.survivability * 100).toFixed(0)}%`} caption="survival" />
              <DonutMetric value={md.yourMetrics.aggression / 2} max={1} color={T.danger} label="AGG" sub={md.yourMetrics.aggression.toFixed(2)} caption="aggression" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
              <KV k="APM" v={md.yourMetrics.apm} />
              <KV k="territorial eff." v={md.yourMetrics.territorialEfficiency.toFixed(2)} />
            </div>
          </StatsPanel>

          <StatsPanel label="timeline · key events" style={{ flex: 1, overflow: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {md.events.map((e, i) => {
                const icon = { capture: '◈', clash: '⚡', lead: '★', death: '✕', win: '🏆' }[e.type] || '·';
                const c = PLAYER_COLORS[e.who].hex;
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '36px 14px 1fr', gap: 8, alignItems: 'center' }}>
                    <Mono size={10} color={T.textMuted}>{e.t}</Mono>
                    <span style={{ fontSize: 11, color: c }}>{icon}</span>
                    <span style={{ fontSize: 11, color: (T.textPrimary) }}>{e.text}</span>
                  </div>
                );
              })}
            </div>
          </StatsPanel>
        </div>
      </div>
    </Screen>
  );
}

function StatPill({ label, value, color = (T.textPrimary) }) {
  return (
    <div style={{
      background: 'rgba(22,18,42,.6)', backdropFilter: 'blur(20px)',
      borderRadius: 12, border: '1px solid rgba(255,255,255,.06)', padding: '12px 16px',
      display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
    }}>
      <Eyebrow>{label}</Eyebrow>
      <span style={{ fontFamily: 'JetBrains Mono', fontSize: 22, fontWeight: 700, color, letterSpacing: -0.4 }}>{value}</span>
    </div>
  );
}

function DonutMetric({ value, max, color, label, sub, caption }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <Donut value={value} max={max} size={70} thickness={6} color={color} label={label} sub={sub} />
      <Mono size={10} color={T.textMuted}>{caption}</Mono>
    </div>
  );
}
function KV({ k, v }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 10px', background: 'rgba(255,255,255,.03)',
      borderRadius: 7, border: '1px solid rgba(255,255,255,.04)',
    }}>
      <Mono size={10} color={T.textMuted}>{k}</Mono>
      <Mono size={11} weight={600}>{v}</Mono>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// META DASHBOARD — desktop.
// ═════════════════════════════════════════════════════════════════════════════
function MetaDesktop({ width = 1280, height = 800, data, actions }) {
  const S = data || defaultState();
  const A = actions || defaultActions();
  const t = (window.useT && window.useT()) || ((k) => k);
  const tx = (key, fallback) => { const out = t(key); return out === key ? fallback : out; };
  const meta = S.meta;
  const [tab, setTab] = React.useState('balance');
  const tabs = [
    { id: 'balance',  label: 'Balance' },
    { id: 'trends',   label: 'Trends' },
    { id: 'heatmaps', label: tx('profile.tab.heatmaps', 'Heat maps') },
  ];

  return (
    <Screen width={width} height={height}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 60,
        background: 'rgba(14,11,31,.6)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,.06)',
        display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between', zIndex: 5,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={A.onMenu} style={{ ...iconBtnStyle, width: 32, height: 32 }}>‹</button>
          <Logo size={16} />
          <Eyebrow>· global meta</Eyebrow>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Mono size={10} color={T.textMuted}>period</Mono>
          <Chip color={T.accent} size="sm" filled>last {meta.period}</Chip>
          <GhostButton onClick={A.onOpenProfile} size="sm">{tx('profile.title', 'Profile')}</GhostButton>
          <GhostButton onClick={A.onOpenLeaderboard} size="sm">{tx('leaderboard.title', 'Leaderboard')}</GhostButton>
        </div>
      </div>

      {/* Totals strip */}
      <div style={{
        position: 'absolute', top: 76, left: 24, right: 24, height: 84,
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12,
      }}>
        <StatPill label="total matches"   value={meta.totals.matches.toLocaleString()} />
        <StatPill label="active players"  value={meta.totals.activePlayers.toLocaleString()} color={T.success} />
        <StatPill label="avg duration"    value={meta.totals.avgDuration} />
        <StatPill label="avg players"     value={meta.totals.avgPlayers.toFixed(1)} />
      </div>

      {/* Tabs */}
      <div style={{ position: 'absolute', top: 176, left: 24, right: 24 }}>
        <TabsBar tabs={tabs} active={tab} onSelect={setTab} />
      </div>

      <div style={{ position: 'absolute', top: 220, left: 24, right: 24, bottom: 24 }}>
        {tab === 'balance' && <MetaBalance meta={meta} />}
        {tab === 'trends' && <MetaTrends meta={meta} />}
        {tab === 'heatmaps' && <MetaHeatmaps meta={meta} />}
      </div>
    </Screen>
  );
}

function MetaBalance({ meta }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14, height: '100%' }}>
      <StatsPanel label="rule win rate" action={<Mono size={10} color={T.textMuted}>balanced if 47–53%</Mono>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {meta.ruleWinrate.map((r) => {
            const off = (r.winRate - 0.5) * 2;       // -1..+1
            const statusColor = r.status === 'overperform' ? T.danger
                              : r.status === 'underperform' ? T.info
                              : T.success;
            return (
              <div key={r.rule} style={{
                display: 'grid', gridTemplateColumns: '110px 1fr 72px 70px 60px',
                gap: 12, alignItems: 'center',
                padding: '10px 12px', borderRadius: 8,
                background: 'rgba(255,255,255,.02)',
                border: `1px solid ${statusColor}33`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: _PALETTE_BY_RULE(r.rule), boxShadow: `0 0 6px ${_PALETTE_BY_RULE(r.rule)}` }} />
                  <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{r.rule}</span>
                </div>
                {/* divergence bar — centered on 50% */}
                <div style={{ height: 8, background: (T.border), borderRadius: 4, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1, background: 'rgba(255,255,255,.2)' }} />
                  <div style={{
                    position: 'absolute', top: 0, height: '100%',
                    left: off >= 0 ? '50%' : `${50 + off * 50}%`,
                    width: `${Math.abs(off) * 50}%`,
                    background: statusColor,
                    borderRadius: 4, boxShadow: `0 0 6px ${statusColor}66`,
                  }} />
                </div>
                <Mono size={13} weight={700} color={statusColor} style={{ textAlign: 'right' }}>{(r.winRate * 100).toFixed(1)}%</Mono>
                <Mono size={11} color={T.textMuted} style={{ textAlign: 'right' }}>{(r.usage * 100).toFixed(0)}% used</Mono>
                <Chip color={statusColor} size="sm">{r.status === 'overperform' ? 'OP' : r.status === 'underperform' ? 'UP' : 'ok'}</Chip>
              </div>
            );
          })}
        </div>
      </StatsPanel>

      <StatsPanel label="top compositions" style={{ overflow: 'hidden' }}>
        <BarChart
          width={460}
          rows={meta.topComps.map((c) => ({
            label: c.label, value: c.winRate * 100, secondary: `${c.played.toLocaleString()} games`,
            color: (T.accent), max: 60,
          }))}
          max={60} labelWidth={170} valueWidth={90}
          format={(v) => v.toFixed(1) + '%'}
        />
      </StatsPanel>
    </div>
  );
}

function MetaTrends({ meta }) {
  const series = meta.trends.map((t) => ({
    label: t.rule, color: _PALETTE_BY_RULE(t.rule), points: t.series,
  }));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, height: '100%' }}>
      <StatsPanel label="win rate · 30 days">
        <LineChart
          width={720} height={300}
          yMin={0.4} yMax={0.6}
          yFormat={(v) => (v * 100).toFixed(0) + '%'}
          xLabels={['30d', '20d', '10d', 'today']}
          series={series}
        />
        <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
          {series.map((s) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 2, background: s.color }} />
              <Mono size={10} color={T.textPrimary} style={{ textTransform: 'capitalize' }}>{s.label}</Mono>
            </div>
          ))}
        </div>
      </StatsPanel>

      <StatsPanel label="rule encounters · crosstab" style={{ overflow: 'auto' }}>
        <Crosstab data={meta.crosstab} />
      </StatsPanel>
    </div>
  );
}

function Crosstab({ data }) {
  const max = Math.max(...data.slice(1).flatMap((row) => row.slice(1).filter((v) => typeof v === 'number')));
  return (
    <table style={{ borderCollapse: 'collapse', fontFamily: 'JetBrains Mono' }}>
      <tbody>
        {data.map((row, ri) => (
          <tr key={ri}>
            {row.map((cell, ci) => {
              const isHead = ri === 0 || ci === 0;
              if (isHead) {
                return (
                  <td key={ci} style={{
                    padding: '6px 10px', fontSize: 10, color: (T.textMuted),
                    textTransform: 'uppercase', letterSpacing: 1, textAlign: ci === 0 ? 'left' : 'center',
                    borderBottom: ri === 0 ? '1px solid rgba(255,255,255,.06)' : 'none',
                    borderRight: ci === 0 ? '1px solid rgba(255,255,255,.06)' : 'none',
                  }}>{cell}</td>
                );
              }
              const v = cell;
              const t = v / max;
              return (
                <td key={ci} style={{
                  padding: '8px 10px', textAlign: 'center', fontSize: 11, fontWeight: 600,
                  color: t > 0.5 ? (T.bg) : (T.textPrimary),
                  background: palettize(t, 'fire'),
                }}>{v.toLocaleString()}</td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MetaHeatmaps({ meta }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, height: '100%' }}>
      <StatsPanel label="ant spawn distribution">
        <HeatMap map={meta.heatmaps.starts} width={300} height={300} palette="ice" />
        <Mono size={10} color={T.textMuted}>where ants start · 1.2M samples</Mono>
      </StatsPanel>
      <StatsPanel label="death frequency">
        <HeatMap map={meta.heatmaps.deaths} width={300} height={300} palette="fire" />
        <Mono size={10} color={T.textMuted}>where colonies fall</Mono>
      </StatsPanel>
      <StatsPanel label="clash hotspots">
        <HeatMap map={meta.heatmaps.clashes} width={300} height={300} palette="#C77DFF" />
        <Mono size={10} color={T.textMuted}>enemy contact heat</Mono>
      </StatsPanel>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LEADERBOARD — desktop.
// ═════════════════════════════════════════════════════════════════════════════
function LeaderboardDesktop({ width = 1280, height = 800, data, actions }) {
  const S = data || defaultState();
  const A = actions || defaultActions();
  const t = (window.useT && window.useT()) || ((k) => k);
  const tx = (key, fallback) => { const out = t(key); return out === key ? fallback : out; };
  const lb = S.leaderboard;

  return (
    <Screen width={width} height={height}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 60,
        background: 'rgba(14,11,31,.6)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,.06)',
        display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between', zIndex: 5,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={A.onMenu} style={{ ...iconBtnStyle, width: 32, height: 32 }}>‹</button>
          <Logo size={16} />
          <Eyebrow>· {tx('leaderboard.title', 'leaderboard')}</Eyebrow>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Chip color={T.accent} size="sm" filled>{lb.scope}</Chip>
          <Mono size={11} color={T.textMuted}>your rank · #{lb.yourRank.toLocaleString()}</Mono>
        </div>
      </div>

      <div style={{
        position: 'absolute', top: 80, left: 24, right: 24, bottom: 24,
        display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14,
      }}>
        <StatsPanel label="top 100 · ranked SR" style={{ overflow: 'auto' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '40px 30px 1fr 70px 90px 70px 40px',
            gap: 10, padding: '0 8px 8px', borderBottom: '1px solid rgba(255,255,255,.06)',
          }}>
            {['#', '', 'player', 'sr', 'win rate', 'matches', ''].map((h, i) => (
              <Eyebrow key={i} style={{ textAlign: i >= 3 && i < 6 ? 'right' : 'left' }}>{h}</Eyebrow>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {lb.rows.map((r) => {
              const p = PLAYER_COLORS[r.playerId];
              const top3 = r.rank <= 3;
              return (
                <div key={r.rank} style={{
                  display: 'grid', gridTemplateColumns: '40px 30px 1fr 70px 90px 70px 40px',
                  gap: 10, padding: '10px 8px', alignItems: 'center', borderRadius: 7,
                  background: top3 ? 'rgba(255,214,10,.06)' : 'rgba(255,255,255,.02)',
                  border: top3 ? '1px solid rgba(255,214,10,.18)' : '1px solid rgba(255,255,255,.04)',
                }}>
                  <Mono size={13} weight={700} color={top3 ? (T.accent) : (T.textMuted)}>
                    {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank}
                  </Mono>
                  <AntMarker color={p.hex} size={18} />
                  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</span>
                    <Mono size={10} color={T.textDim}>{r.country}</Mono>
                  </div>
                  <Mono size={14} weight={700} style={{ textAlign: 'right' }}>{r.sr}</Mono>
                  <Mono size={12} color={r.winRate >= 0.65 ? T.success : (T.textPrimary)} style={{ textAlign: 'right' }}>{(r.winRate * 100).toFixed(1)}%</Mono>
                  <Mono size={11} color={T.textMuted} style={{ textAlign: 'right' }}>{r.matches.toLocaleString()}</Mono>
                  <span style={{ fontSize: 11, color: (T.textMuted) }}>›</span>
                </div>
              );
            })}
            <div style={{ height: 16 }} />
            {/* your line */}
            <div style={{
              display: 'grid', gridTemplateColumns: '40px 30px 1fr 70px 90px 70px 40px',
              gap: 10, padding: '10px 8px', alignItems: 'center', borderRadius: 7,
              background: 'rgba(255,84,112,.10)', border: '1px solid rgba(255,84,112,.45)',
            }}>
              <Mono size={13} weight={700} color="#FF5470">{lb.yourRank.toLocaleString()}</Mono>
              <AntMarker color={PLAYER_COLORS[S.user.colorId].hex} size={18} />
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{S.user.name} <span style={{ color: (T.accent) }}>·you</span></span>
                <Mono size={10} color={T.textDim}>{(S.profile.player?.rank?.label || S.profile.rank?.tier)}</Mono>
              </div>
              <Mono size={14} weight={700} style={{ textAlign: 'right' }}>{S.user.sr}</Mono>
              <Mono size={12} style={{ textAlign: 'right' }}>{((S.profile.player?.winRate ?? S.profile.totals?.winRate) * 100).toFixed(1)}%</Mono>
              <Mono size={11} color={T.textMuted} style={{ textAlign: 'right' }}>{(S.profile.stats?.matchesPlayed ?? S.profile.player?.matchesPlayed ?? S.profile.totals?.matches).toLocaleString()}</Mono>
              <span style={{ fontSize: 11, color: (T.textMuted) }}>›</span>
            </div>
          </div>
        </StatsPanel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <StatsPanel label="scope">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['global', 'friends', 'country', 'season'].map((s) => (
                <button key={s} style={{
                  appearance: 'none', cursor: 'pointer', textAlign: 'left',
                  padding: '10px 12px', borderRadius: 8,
                  background: s === lb.scope ? 'rgba(255,214,10,.12)' : 'rgba(255,255,255,.02)',
                  border: `1px solid ${s === lb.scope ? '#FFD60A55' : (T.border)}`,
                  color: (T.textPrimary), fontFamily: 'Inter, sans-serif',
                  fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span>{s}</span>
                  {s === lb.scope && <span style={{ color: (T.accent) }}>✓</span>}
                </button>
              ))}
            </div>
          </StatsPanel>

          <StatsPanel label="climb to top-100">
            <Mono size={11} color={T.textMuted}>your SR · {S.user.sr}</Mono>
            <Mono size={22} weight={700} color={T.accent}>
              need {lb.rows.at(-1).sr - S.user.sr} more
            </Mono>
            <Mono size={10} color={T.textDim}>at your current rate · ~12 matches</Mono>
            <Progress value={S.user.sr - 1000} max={lb.rows.at(-1).sr - 1000} color={T.accent} height={4} />
          </StatsPanel>

          <StatsPanel label="leaderboard scope info" style={{ flex: 1 }}>
            <Mono size={10} color={T.textMuted} style={{ lineHeight: 1.6 }}>
              global standings update every 60s.<br />
              minimum 50 matches required to qualify.<br />
              season 02 ends in 18 days.
            </Mono>
          </StatsPanel>
        </div>
      </div>
    </Screen>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PROFILE — mobile (compact).
// ═════════════════════════════════════════════════════════════════════════════
function ProfileMobile({ width = 390, height = 844, data, actions }) {
  const S = data || defaultState();
  const A = actions || defaultActions();
  const user = S.user;
  const p = S.profile;
  const userColor = PLAYER_COLORS[user.colorId].hex;
  const tabs = [
    { id: 'overview', label: tx('profile.tab.overview', 'Overview') },
    { id: 'history',  label: tx('profile.tab.history',  'History') },
    { id: 'ach',      label: tx('profile.tab.achievements', 'Awards') },
  ];
  const [tab, setTab] = React.useState('overview');

  return (
    <Screen width={width} height={height}>
      <StatusBarMobile />
      <div style={{
        position: 'absolute', top: 60, left: 16, right: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button onClick={A.onMenu} style={{ ...iconBtnStyle, width: 32, height: 32 }}>‹</button>
        <Eyebrow>profile</Eyebrow>
        <button onClick={A.onOpenLeaderboard} style={{ ...iconBtnStyle, width: 32, height: 32 }}>≡</button>
      </div>

      {/* Identity */}
      <div style={{
        position: 'absolute', top: 110, left: 16, right: 16,
        background: 'rgba(22,18,42,.6)', backdropFilter: 'blur(20px)',
        borderRadius: 14, border: `1px solid ${userColor}33`, padding: 16,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <AntMarker color={userColor} size={40} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{user.name}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Chip color={userColor} size="sm">{p.player?.rank?.label || p.rank?.tier}</Chip>
            <Mono size={11} color={T.textPrimary}>SR {user.sr}</Mono>
          </div>
          <Mono size={9} color={T.textMuted}>{p.overview?.playStyle || p.playstyle?.type} · {p.hoursPlayed}h</Mono>
        </div>
      </div>

      {/* Quick stats */}
      <div style={{
        position: 'absolute', top: 220, left: 16, right: 16,
        display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8,
      }}>
        <StatPill label="matches" value={(p.stats?.matchesPlayed ?? p.player?.matchesPlayed ?? p.totals?.matches)} />
        <StatPill label="win rate" value={`${((p.player?.winRate ?? p.totals?.winRate) * 100).toFixed(0)}%`} color={T.success} />
        <StatPill label="streak" value={`${(p.player?.currentStreak ?? p.totals?.streak?.current ?? 0)}W`} color={T.accent} />
      </div>

      <div style={{ position: 'absolute', top: 320, left: 16, right: 16 }}>
        <TabsBar tabs={tabs} active={tab} onSelect={setTab} />
      </div>

      <div style={{ position: 'absolute', top: 372, left: 16, right: 16, bottom: 16, overflow: 'auto' }}>
        {tab === 'overview' && (
          <StatsPanel label="ELO · 30 days">
            <LineChart
              series={[{ color: (T.accent), points: p.eloSeries }]}
              width={width - 64} height={140} fill
              yFormat={(v) => v.toFixed(0)}
              xLabels={['30d', '15d', 'now']}
            />
            <div style={{ marginTop: 8 }}>
              <BarChart
                width={width - 64}
                rows={p.rulePerf.map((r) => ({
                  label: r.rule, value: r.winRate * 100, secondary: `${r.played}×`,
                  color: _PALETTE_BY_RULE(r.rule), max: 60,
                }))}
                max={60} labelWidth={70} valueWidth={50}
                format={(v) => v.toFixed(1) + '%'}
              />
            </div>
          </StatsPanel>
        )}
        {tab === 'history' && (
          <StatsPanel label="recent matches">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {S.matchHistory.matches.slice(0, 6).map((m) => {
                const win = m.outcome === 'victory', lose = m.outcome === 'defeat';
                return (
                  <button key={m.id} onClick={() => A.onOpenMatch?.(m.id)} style={{
                    appearance: 'none', cursor: 'pointer', textAlign: 'left',
                    display: 'grid', gridTemplateColumns: '20px 1fr auto auto', gap: 8, alignItems: 'center',
                    padding: 10, borderRadius: 8,
                    background: 'rgba(255,255,255,.02)',
                    borderLeft: `3px solid ${win ? T.success : lose ? T.danger : (T.textMuted)}`,
                    color: (T.textPrimary),
                  }}>
                    <span>{win ? '🏆' : lose ? '✕' : '–'}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{m.players}P · {m.duration}</span>
                      <Mono size={9} color={T.textMuted}>{m.when}</Mono>
                    </div>
                    <Mono size={12} weight={600}>{(m.territory * 100).toFixed(1)}%</Mono>
                    <Mono size={11} color={m.srDelta.startsWith('+') ? T.success : T.danger}>{m.srDelta}</Mono>
                  </button>
                );
              })}
            </div>
          </StatsPanel>
        )}
        {tab === 'ach' && (
          <StatsPanel label="awards">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {p.achievements.map((a) => (
                <div key={a.id} style={{
                  display: 'grid', gridTemplateColumns: '30px 1fr auto', gap: 10, alignItems: 'center',
                  padding: 8, borderRadius: 7,
                  background: a.done ? 'rgba(255,214,10,.08)' : 'rgba(255,255,255,.02)',
                }}>
                  <span style={{ fontSize: 16 }}>{a.done ? '🏆' : '🔒'}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{a.name}</span>
                    <Mono size={9} color={T.textMuted}>{a.desc}</Mono>
                  </div>
                  <Mono size={10} color={T.textMuted}>{a.done ? a.unlocked : `${a.progress}/${a.target}`}</Mono>
                </div>
              ))}
            </div>
          </StatsPanel>
        )}
      </div>
    </Screen>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LEADERBOARD — mobile.
// ═════════════════════════════════════════════════════════════════════════════
function LeaderboardMobile({ width = 390, height = 844, data, actions }) {
  const S = data || defaultState();
  const A = actions || defaultActions();
  const lb = S.leaderboard;
  return (
    <Screen width={width} height={height}>
      <StatusBarMobile />
      <div style={{
        position: 'absolute', top: 60, left: 16, right: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button onClick={A.onMenu} style={{ ...iconBtnStyle, width: 32, height: 32 }}>‹</button>
        <Eyebrow>leaderboard</Eyebrow>
        <Chip color={T.accent} size="sm" filled>{lb.scope}</Chip>
      </div>

      <div style={{
        position: 'absolute', top: 110, left: 16, right: 16, bottom: 16,
        background: 'rgba(22,18,42,.6)', backdropFilter: 'blur(20px)',
        borderRadius: 14, border: '1px solid rgba(255,255,255,.06)', padding: 12,
        display: 'flex', flexDirection: 'column', gap: 6, overflow: 'auto',
      }}>
        {lb.rows.slice(0, 10).map((r) => {
          const p = PLAYER_COLORS[r.playerId];
          const top3 = r.rank <= 3;
          return (
            <div key={r.rank} style={{
              display: 'grid', gridTemplateColumns: '30px 22px 1fr 60px 50px', gap: 10,
              alignItems: 'center', padding: 8, borderRadius: 7,
              background: top3 ? 'rgba(255,214,10,.06)' : 'transparent',
            }}>
              <Mono size={12} weight={700} color={top3 ? (T.accent) : (T.textMuted)}>
                {r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank}
              </Mono>
              <AntMarker color={p.hex} size={14} />
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{r.name}</span>
                <Mono size={9} color={T.textDim}>{r.country}</Mono>
              </div>
              <Mono size={12} weight={700} style={{ textAlign: 'right' }}>{r.sr}</Mono>
              <Mono size={10} color={T.success} style={{ textAlign: 'right' }}>{(r.winRate * 100).toFixed(0)}%</Mono>
            </div>
          );
        })}
        <div style={{ height: 12 }} />
        <div style={{
          display: 'grid', gridTemplateColumns: '30px 22px 1fr 60px 50px', gap: 10,
          alignItems: 'center', padding: 8, borderRadius: 7,
          background: 'rgba(255,84,112,.10)', border: '1px solid rgba(255,84,112,.45)',
        }}>
          <Mono size={12} weight={700} color="#FF5470">{lb.yourRank}</Mono>
          <AntMarker color={PLAYER_COLORS[S.user.colorId].hex} size={14} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>{S.user.name} <span style={{ color: (T.accent) }}>·you</span></span>
          <Mono size={12} weight={700} style={{ textAlign: 'right' }}>{S.user.sr}</Mono>
          <Mono size={10} color={T.success} style={{ textAlign: 'right' }}>{((S.profile.player?.winRate ?? S.profile.totals?.winRate) * 100).toFixed(0)}%</Mono>
        </div>
      </div>
    </Screen>
  );
}

Object.assign(window, {
  ProfileDesktop, ProfileMobile,
  MatchDetailDesktop, MetaDesktop,
  LeaderboardDesktop, LeaderboardMobile,
});
