// screens-result.jsx — Result variants (Classic / Hero / Grid) + Reward + mobile result.

// ─────────────────────────────────────────────────────────────────────────────
// RESULT A — Classic leaderboard.
// ─────────────────────────────────────────────────────────────────────────────
function ResultClassic({ width = 1280, height = 800, data, actions }) {
  const S = data || defaultState();
  const A = actions || defaultActions();
  const t = (window.useT && window.useT()) || ((k) => k);
  const tx = (key, fallback) => { const out = t(key); return out === key ? fallback : out; };
  const r = S.result;
  const isWin = r.outcome === 'victory';

  return (
    <Screen width={width} height={height}>
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.18,
        maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 20%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 20%, transparent 75%)',
      }}>
        <LangtonField w={64} h={40} cellSize={Math.floor(width / 64)}
          ants={spawnAnts({ w: 64, h: 40, players: 4, perPlayer: 3, rule: 'RL', seed: 5 })}
          palette={PLAYER_COLORS.slice(0, 4).map((p) => p.hex)} tps={12} glow={false} />
      </div>

      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 28, padding: 60,
      }}>
        <div style={{ textAlign: 'center' }}>
          <Eyebrow color={T.accent}>match complete · {r.duration}</Eyebrow>
          <div style={{
            fontSize: 84, fontWeight: 900, letterSpacing: -3,
            background: isWin ? 'linear-gradient(180deg, #FFD60A 0%, #FF8A3D 100%)' : 'linear-gradient(180deg, #FF453A 0%, #C77DFF 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            textShadow: isWin ? '0 0 32px #FFD60A44' : '0 0 32px #FF453A44',
            marginTop: 4, lineHeight: 1,
          }}>{isWin ? 'VICTORY' : 'DEFEAT'}</div>
          <div style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            <Mono size={13} color={T.textMuted}>place {r.place} of {r.of}</Mono>
            <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,.15)' }} />
            <Mono size={13} color={r.srGained >= 0 ? T.success : T.danger}>
              +{r.xpGained} xp · {r.srGained >= 0 ? '+' : ''}{r.srGained} SR
            </Mono>
          </div>
        </div>

        <div style={{
          width: 760, background: 'rgba(22,18,42,.7)', backdropFilter: 'blur(16px)',
          borderRadius: 18, border: '1px solid rgba(255,255,255,.08)', padding: 8,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '32px 28px 1fr 90px 80px 70px 60px', gap: 12, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            {['', '', 'player', 'territory', 'cells', 'clashes', 'rating'].map((h, i) => (
              <Eyebrow key={i} style={{ textAlign: i >= 3 ? 'right' : 'left' }}>{h}</Eyebrow>
            ))}
          </div>
          {r.rows.map((row, i) => {
            const p = PLAYER_COLORS[row.playerId];
            return (
              <div key={row.playerId} style={{
                display: 'grid', gridTemplateColumns: '32px 28px 1fr 90px 80px 70px 60px',
                gap: 12, padding: '14px 16px', alignItems: 'center',
                background: row.isYou ? `${p.hex}10` : 'transparent',
                borderBottom: i < r.rows.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
                borderLeft: row.isYou ? `3px solid ${p.hex}` : '3px solid transparent',
                borderRadius: row.isYou ? '8px' : 0,
              }}>
                <Mono size={16} weight={600} color={i === 0 ? (T.accent) : (T.textMuted)}>{i === 0 ? '🏆' : i + 1}</Mono>
                <AntMarker color={p.hex} size={22} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                  {row.isYou && <Chip color={T.accent} size="sm">you</Chip>}
                </div>
                <Mono size={16} weight={600} style={{ textAlign: 'right' }}>{row.pct.toFixed(1)}%</Mono>
                <Mono size={14} color={T.textMuted} style={{ textAlign: 'right' }}>{row.cells}</Mono>
                <Mono size={14} color={T.textMuted} style={{ textAlign: 'right' }}>{row.kills}</Mono>
                <Mono size={14} weight={600} color={row.sr.startsWith('+') ? T.success : T.danger} style={{ textAlign: 'right' }}>{row.sr}</Mono>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <PrimaryButton onClick={A.onRematch} size="lg" style={{ width: 200 }}>↻ Rematch</PrimaryButton>
          <GhostButton onClick={A.onNewMatch}    size="lg">{tx('result.button.newMatch', 'New match')}</GhostButton>
          <GhostButton onClick={A.onOpenReward}  size="lg">🎁 Open reward</GhostButton>
          <GhostButton onClick={A.onMenu}        size="lg">{tx('result.button.menu', 'Menu')}</GhostButton>
        </div>
      </div>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT B — Hero focus.
// ─────────────────────────────────────────────────────────────────────────────
function ResultHero({ width = 1280, height = 800, data, actions }) {
  const S = data || defaultState();
  const A = actions || defaultActions();
  const t = (window.useT && window.useT()) || ((k) => k);
  const tx = (key, fallback) => { const out = t(key); return out === key ? fallback : out; };
  const r = S.result;
  const youRow = r.rows.find((row) => row.isYou) || r.rows[0];
  const you = PLAYER_COLORS[youRow.playerId];
  const isWin = r.outcome === 'victory';

  return (
    <Screen width={width} height={height}>
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.25,
        background: `radial-gradient(ellipse 60% 50% at 35% 50%, ${you.hex}55 0%, transparent 60%)`,
      }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.12 }}>
        <LangtonField w={64} h={40} cellSize={Math.floor(width / 64)}
          ants={spawnAnts({ w: 64, h: 40, players: 1, perPlayer: 6, rule: 'LRR', seed: 1 })}
          palette={[you.hex]} tps={12} glow={false} />
      </div>

      <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 40, padding: 60, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Eyebrow color={T.accent}>arena · ranked · {r.of}P · season 02</Eyebrow>
          <div style={{
            fontSize: 110, fontWeight: 900, letterSpacing: -4, lineHeight: 0.95,
            color: (T.textPrimary), textShadow: `0 0 40px ${you.hex}66`,
          }}>
            you<br /><span style={{ color: you.hex }}>{isWin ? 'won.' : 'lost.'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <AntMarker color={you.hex} size={32} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{you.name}</div>
              <Mono size={11} color={T.textMuted}>LVL {S.user.level} · {S.user.sr} → {S.user.sr + r.srGained} SR</Mono>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <PrimaryButton onClick={A.onRematch} size="lg" style={{ minWidth: 200 }}>↻ Rematch</PrimaryButton>
            <GhostButton onClick={A.onNewMatch}   size="lg">{tx('result.button.newMatch', 'New match')}</GhostButton>
            <GhostButton onClick={A.onOpenReward} size="lg">🎁 Reward</GhostButton>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {r.yourStats.map((stat, i) => (
              <StatBlock key={i} label={stat.label} value={stat.value} delta={stat.delta}
                color={stat.accent ? (i === 0 ? you.hex : (T.accent)) : (T.textPrimary)} />
            ))}
          </div>

          <div style={{
            background: 'rgba(22,18,42,.6)', backdropFilter: 'blur(12px)',
            borderRadius: 14, border: '1px solid rgba(255,255,255,.06)', padding: 14,
          }}>
            <Eyebrow style={{ marginBottom: 10 }}>final standings</Eyebrow>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {r.rows.map((row, i) => {
                const p = PLAYER_COLORS[row.playerId];
                return (
                  <div key={row.playerId} style={{
                    display: 'grid', gridTemplateColumns: '16px 14px 1fr 50px 40px', gap: 8, alignItems: 'center',
                    padding: '6px 8px', borderRadius: 6,
                    background: i === 0 ? `${p.hex}14` : 'transparent',
                  }}>
                    <Mono size={10} color={i === 0 ? (T.accent) : (T.textMuted)} weight={600}>{i === 0 ? '★' : i + 1}</Mono>
                    <AntMarker color={p.hex} size={12} />
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{p.name}</span>
                    <Mono size={11} weight={600} style={{ textAlign: 'right' }}>{row.pct.toFixed(1)}%</Mono>
                    <Mono size={11} color={row.sr.startsWith('+') ? T.success : T.danger} style={{ textAlign: 'right' }}>{row.sr}</Mono>
                  </div>
                );
              })}
            </div>
          </div>

          {r.achievement && (
            <div style={{
              background: 'rgba(22,18,42,.6)', backdropFilter: 'blur(12px)',
              border: '1px solid #FFD60A33', borderRadius: 14, padding: 14,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, background: (T.accent),
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                boxShadow: '0 0 20px #FFD60A66',
              }}>🏆</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Achievement unlocked</div>
                <Mono size={11} color={T.textMuted}>{r.achievement.name} · +{r.achievement.xp} xp</Mono>
              </div>
              <Chip color={T.accent} filled size="sm">{r.achievement.rarity}</Chip>
            </div>
          )}
        </div>
      </div>
    </Screen>
  );
}

function StatBlock({ label, value, delta, color = (T.textPrimary) }) {
  return (
    <div style={{
      background: 'rgba(22,18,42,.6)', backdropFilter: 'blur(12px)',
      borderRadius: 12, border: '1px solid rgba(255,255,255,.06)', padding: '12px 14px',
    }}>
      <Eyebrow color={T.textMuted}>{label}</Eyebrow>
      <div style={{ fontSize: 28, fontWeight: 800, color, marginTop: 6, letterSpacing: -1, lineHeight: 1 }}>{value}</div>
      <Mono size={10} color={T.textMuted} style={{ marginTop: 4, display: 'block' }}>{delta}</Mono>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT C — Comparison grid.
// ─────────────────────────────────────────────────────────────────────────────
function ResultGrid({ width = 1280, height = 800, data, actions }) {
  const S = data || defaultState();
  const A = actions || defaultActions();
  const t = (window.useT && window.useT()) || ((k) => k);
  const tx = (key, fallback) => { const out = t(key); return out === key ? fallback : out; };
  const r = S.result;

  return (
    <Screen width={width} height={height}>
      <div style={{ position: 'absolute', top: 32, left: 32, right: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <Eyebrow color={T.accent}>arena · {r.duration} · ranked</Eyebrow>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1, marginTop: 4 }}>Final standings</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Mono size={11} color={T.textMuted}>
            tick {r.totals.tick} · {r.totals.captures} captures · {r.totals.clashes} clashes
          </Mono>
          <Chip color={r.srGained >= 0 ? T.success : T.danger} size="md" filled>
            {r.srGained >= 0 ? '+' : ''}{r.srGained} SR
          </Chip>
        </div>
      </div>

      <div style={{
        position: 'absolute', top: 130, left: 32, right: 32, bottom: 120,
        display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, r.rows.length)}, 1fr)`, gap: 14,
      }}>
        {r.rows.map((row, i) => {
          const p = PLAYER_COLORS[row.playerId];
          return (
            <div key={row.playerId} style={{
              background: row.isYou ? `linear-gradient(180deg, ${p.hex}22 0%, ${p.hex}06 100%)` : 'rgba(22,18,42,.5)',
              border: `1px solid ${row.isYou ? p.hex : (T.border)}`,
              borderRadius: 16, padding: 22, display: 'flex', flexDirection: 'column', gap: 14,
              position: 'relative', overflow: 'hidden',
            }}>
              {i === 0 && <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 22, filter: 'drop-shadow(0 0 12px #FFD60A88)' }}>🏆</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Mono size={20} weight={700} color={i === 0 ? (T.accent) : T.textDim}>{i + 1}</Mono>
                <AntMarker color={p.hex} size={20} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  {p.name}{row.isYou && <span style={{ color: (T.accent), marginLeft: 6 }}>·you</span>}
                </div>
                <Mono size={10} color={T.textMuted}>{row.peak}</Mono>
              </div>
              <div style={{ marginTop: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 38, fontWeight: 900, letterSpacing: -1.5, color: p.hex }}>
                    {row.pct.toFixed(1)}
                  </span>
                  <Mono size={14} color={T.textMuted}>%</Mono>
                </div>
                <div style={{ marginTop: 8, height: 4, background: (T.border), borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${row.pct}%`, height: '100%', background: p.hex, boxShadow: `0 0 10px ${p.hex}` }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div><Eyebrow color={T.textMuted}>cells</Eyebrow><Mono size={14} weight={600}>{row.cells}</Mono></div>
                <div><Eyebrow color={T.textMuted}>lost</Eyebrow><Mono size={14} weight={600}>{row.lost}/5</Mono></div>
                <div><Eyebrow color={T.textMuted}>SR</Eyebrow><Mono size={14} weight={600} color={row.sr.startsWith('+') ? T.success : T.danger}>{row.sr}</Mono></div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        position: 'absolute', bottom: 32, left: 32, right: 32,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Mono size={11} color={T.textMuted}>
            {r.rematchReady.filter(Boolean).length}/{r.rematchReady.length} ready for rematch
          </Mono>
          <div style={{ display: 'flex', gap: 4 }}>
            {r.rematchReady.map((v, i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: v ? T.success : 'rgba(255,255,255,.1)' }} />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <GhostButton onClick={A.onMenu}        size="lg">{tx('result.button.menu', 'Menu')}</GhostButton>
          <GhostButton onClick={A.onOpenReward}  size="lg">🎁 Reward</GhostButton>
          <PrimaryButton onClick={A.onRematch}   size="lg" style={{ minWidth: 200 }}>↻ Rematch</PrimaryButton>
        </div>
      </div>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT — mobile (compact stack).
// ─────────────────────────────────────────────────────────────────────────────
function ResultMobile({ width = 390, height = 844, data, actions }) {
  const S = data || defaultState();
  const A = actions || defaultActions();
  const r = S.result;
  const isWin = r.outcome === 'victory';

  return (
    <Screen width={width} height={height}>
      <StatusBarMobile />

      <div style={{ position: 'absolute', top: 60, left: 20, right: 20, textAlign: 'center' }}>
        <Eyebrow color={T.accent}>match complete · {r.duration}</Eyebrow>
        <div style={{
          fontSize: 56, fontWeight: 900, letterSpacing: -2.5, marginTop: 4, lineHeight: 1,
          background: isWin ? 'linear-gradient(180deg,#FFD60A,#FF8A3D)' : 'linear-gradient(180deg,#FF453A,#C77DFF)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>{isWin ? 'VICTORY' : 'DEFEAT'}</div>
        <Mono size={11} color={T.textMuted} style={{ marginTop: 6 }}>
          place {r.place} of {r.of} · +{r.xpGained} xp · {r.srGained >= 0 ? '+' : ''}{r.srGained} SR
        </Mono>
      </div>

      <div style={{
        position: 'absolute', top: 200, left: 20, right: 20,
        background: 'rgba(22,18,42,.6)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: 8,
        display: 'flex', flexDirection: 'column',
      }}>
        {r.rows.map((row, i) => {
          const p = PLAYER_COLORS[row.playerId];
          return (
            <div key={row.playerId} style={{
              display: 'grid', gridTemplateColumns: '20px 18px 1fr 70px 50px', gap: 8, alignItems: 'center',
              padding: '10px 10px', borderRadius: 8,
              background: row.isYou ? `${p.hex}10` : 'transparent',
              borderBottom: i < r.rows.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
            }}>
              <Mono size={13} weight={600} color={i === 0 ? (T.accent) : (T.textMuted)}>{i === 0 ? '🏆' : i + 1}</Mono>
              <AntMarker color={p.hex} size={14} />
              <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}{row.isYou && <span style={{ color: (T.accent), marginLeft: 4 }}>·you</span>}
              </span>
              <Mono size={13} weight={600} style={{ textAlign: 'right' }}>{row.pct.toFixed(1)}%</Mono>
              <Mono size={12} color={row.sr.startsWith('+') ? T.success : T.danger} style={{ textAlign: 'right' }}>{row.sr}</Mono>
            </div>
          );
        })}
      </div>

      {r.achievement && (
        <div style={{
          position: 'absolute', top: 510, left: 20, right: 20,
          background: 'rgba(22,18,42,.6)', backdropFilter: 'blur(12px)',
          border: '1px solid #FFD60A33', borderRadius: 14, padding: 12,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: (T.accent), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏆</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Achievement</div>
            <Mono size={10} color={T.textMuted}>{r.achievement.name} · +{r.achievement.xp} xp</Mono>
          </div>
        </div>
      )}

      <div style={{ position: 'absolute', bottom: 28, left: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PrimaryButton onClick={A.onRematch} full style={{ padding: '16px 0', fontSize: 14 }}>↻ Rematch</PrimaryButton>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <GhostButton onClick={A.onOpenReward} full size="sm" style={{ padding: '12px 0' }}>🎁 Reward</GhostButton>
          <GhostButton onClick={A.onMenu}        full size="sm" style={{ padding: '12px 0' }}>{tx('result.button.menu', 'Menu')}</GhostButton>
        </div>
      </div>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REWARD BOX — works for desktop modal + mobile fullscreen.
// ─────────────────────────────────────────────────────────────────────────────
function RewardBox({ width = 640, height = 800, data, actions }) {
  const S = data || defaultState();
  const A = actions || defaultActions();
  const t = (window.useT && window.useT()) || ((k) => k);
  const tx = (key, fallback) => { const out = t(key); return out === key ? fallback : out; };
  const reward = S.reward;
  const rarity = RARITY_COLORS[reward.rarity] || RARITY_COLORS.epic;
  const primary = reward.primary || rarity.primary;
  const secondary = reward.secondary || rarity.secondary;

  return (
    <Screen width={width} height={height}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse 60% 60% at 50% 45%, ${primary}33 0%, transparent 70%)`,
      }} />
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24, padding: 40,
      }}>
        <Eyebrow color={primary}>reward unlocked · season 02</Eyebrow>

        <div style={{
          width: Math.min(width - 80, 280), height: 380, position: 'relative',
          borderRadius: 20, padding: 2,
          background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
          boxShadow: `0 0 60px ${primary}66, 0 0 120px ${secondary}33`,
          animation: 'float 3s ease-in-out infinite',
        }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: 18,
            background: 'linear-gradient(180deg, #1A1432 0%, #0E0B1F 100%)',
            padding: 28, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
              <Chip color={primary} size="sm" filled>{reward.rarity}</Chip>
              <Mono size={9} color={T.textDim}>{reward.serial}</Mono>
            </div>

            <div style={{
              width: 120, height: 120, position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: `radial-gradient(circle, ${primary}66 0%, transparent 70%)`,
                animation: 'glow 2s ease-in-out infinite',
              }} />
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="36" fill="none" stroke={primary} strokeWidth="2" strokeDasharray="4 4" />
                <circle cx="50" cy="50" r="22" fill={primary} filter={`drop-shadow(0 0 12px ${primary})`} />
                <circle cx="58" cy="50" r="8" fill="#fff" />
              </svg>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{reward.name}</div>
              <Mono size={10} color={T.textMuted} style={{ marginTop: 4, display: 'block' }}>{reward.category}</Mono>
              <Mono size={9} color={T.textDim} style={{ marginTop: 10, display: 'block', maxWidth: 200, lineHeight: 1.5 }}>
                {reward.description}
              </Mono>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <PrimaryButton onClick={A.onEquipReward} size="md">Equip</PrimaryButton>
          <GhostButton size="md">Inventory</GhostButton>
          <GhostButton onClick={A.onMenu} size="md">Continue</GhostButton>
        </div>
      </div>
    </Screen>
  );
}

Object.assign(window, {
  ResultClassic, ResultHero, ResultGrid, ResultMobile, RewardBox, StatBlock,
});
