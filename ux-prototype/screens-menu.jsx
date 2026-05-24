// screens-menu.jsx — Main menu (D/M), match finding (D/M), pre-match lobby (D/M), tutorial.
// All screens accept { data, actions } props. Sensible defaults so the canvas still renders.

const iconBtnStyle = {
  width: 36, height: 36, borderRadius: 10,
  background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
  color: (T.textPrimary), cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)',
};

// Read user data, falling back to PLAYER_COLORS lookup.
function pickUserColor(user) {
  return PLAYER_COLORS[user?.colorId ?? 0]?.hex || '#FF5470';
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN MENU — desktop.
// ─────────────────────────────────────────────────────────────────────────────
function MainMenuDesktop({ width = 1280, height = 800, data, actions, tps = 18, fieldRule = 'spiral' }) {
  const S = data || defaultState();
  const A = actions || defaultActions();
  const user = S.user, status = S.status;
  // i18n — falls back to literal string if t() returns the key unchanged.
  const t = (window.useT && window.useT()) || ((k, _, fallback) => fallback || k);
  const tx = (key, fallback) => {
    const out = t(key);
    return out === key ? fallback : out;
  };

  const W = 64, H = 40;
  const ants = React.useMemo(() => spawnAnts({
    w: W, h: H, players: 6, perPlayer: 2,
    rule: () => LA_RULES[fieldRule] || LA_RULES.spiral, seed: 7,
  }), [fieldRule]);
  const palette = PLAYER_COLORS.slice(0, 6).map((p) => p.hex);

  return (
    <Screen width={width} height={height}>
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.35,
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 55%, black 30%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 55%, black 30%, transparent 80%)',
      }}>
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LangtonField w={W} h={H} cellSize={Math.floor(width / W)} ants={ants} palette={palette}
            tps={tps} glow={false} bg={T.bg} antScale={0.85} />
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 30%, #0E0B1F 95%)' }} />

      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 28, left: 32, right: 32,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Eyebrow>{status.version}</Eyebrow>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
            padding: '8px 14px 8px 10px', borderRadius: 999, backdropFilter: 'blur(8px)',
          }}>
            <AntMarker color={pickUserColor(user)} size={20} />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{user.name}</span>
              <Mono size={10} color={T.textMuted}>LVL {user.level} · {user.sr} SR</Mono>
            </div>
          </div>
          <button style={iconBtnStyle} onClick={A.onSettings} aria-label="Settings">⚙</button>
        </div>
      </div>

      {/* Hero */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 48,
      }}>
        <div style={{ textAlign: 'center' }}>
          <Eyebrow color={T.accent} style={{ marginBottom: 16 }}>cellular · automaton · pvp</Eyebrow>
          <Logo size={66} />
          <div style={{ marginTop: 20, color: (T.textMuted), fontSize: 14, maxWidth: 420, lineHeight: 1.5 }}>
            Develop colonies. Capture territory.<br />Outlast the rules of the world.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <PrimaryButton onClick={A.onPlay} style={{ width: 280, padding: '20px 28px', fontSize: 18, letterSpacing: 1 }}>
            ▶  {tx('menu.button.play', 'Play')}
          </PrimaryButton>
          <div style={{ display: 'flex', gap: 10 }}>
            <GhostButton onClick={A.onTrain}>{tx('menu.button.training', 'Training')}</GhostButton>
            <GhostButton onClick={A.onPrivate}>{tx('menu.button.private', 'Private lobby')}</GhostButton>
            <GhostButton onClick={A.onProfile}>Profile</GhostButton>
          </div>
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 24, left: 32, right: 32,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: T.success, boxShadow: '0 0 8px #39D98A' }} />
          <Mono size={11} color={T.textMuted}>{status.online.toLocaleString()} online · {status.activeMatches} active matches</Mono>
        </div>
        <Mono size={11} color={T.textDim}>{status.seasonLabel}</Mono>
      </div>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN MENU — mobile.
// ─────────────────────────────────────────────────────────────────────────────
function MainMenuMobile({ width = 390, height = 844, data, actions }) {
  const S = data || defaultState();
  const A = actions || defaultActions();
  const user = S.user;
  const W = 28, H = 60;
  const ants = React.useMemo(() => spawnAnts({ w: W, h: H, players: 4, perPlayer: 2, rule: 'LRR', seed: 11 }), []);
  const palette = PLAYER_COLORS.slice(0, 4).map((p) => p.hex);

  return (
    <Screen width={width} height={height}>
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.32,
        maskImage: 'radial-gradient(ellipse 80% 60% at 50% 55%, black 30%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 55%, black 30%, transparent 80%)',
      }}>
        <LangtonField w={W} h={H} cellSize={14} ants={ants} palette={palette} tps={16}
          glow={false} antScale={0.85} bg={T.bg} />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 30%, #0E0B1F 95%)' }} />

      <StatusBarMobile />

      {/* Profile pill */}
      <div style={{
        position: 'absolute', top: 60, left: 20, right: 20,
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
        padding: 10, borderRadius: 14, backdropFilter: 'blur(8px)',
      }}>
        <AntMarker color={pickUserColor(user)} size={28} />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{user.name}</span>
          <Mono size={11} color={T.textMuted}>LVL {user.level} · {user.sr} SR</Mono>
        </div>
        <button onClick={A.onSettings} style={{ ...iconBtnStyle, width: 32, height: 32 }}>⚙</button>
      </div>

      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 36, padding: '0 24px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <Eyebrow color={T.accent} style={{ marginBottom: 14 }}>cellular · pvp</Eyebrow>
          <Logo size={36} />
          <div style={{ marginTop: 14, color: (T.textMuted), fontSize: 12, lineHeight: 1.5 }}>
            Capture territory.<br />Outlast the rules.
          </div>
        </div>
        <PrimaryButton onClick={A.onPlay} style={{ width: '100%', padding: '20px 28px', fontSize: 17, letterSpacing: 1 }}>
          ▶  Play
        </PrimaryButton>
      </div>

      <div style={{
        position: 'absolute', bottom: 24, left: 20, right: 20,
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
      }}>
        <GhostButton onClick={A.onTrain}  size="sm" full style={{ padding: '12px 0', fontSize: 11 }}>Training</GhostButton>
        <GhostButton onClick={A.onPrivate} size="sm" full style={{ padding: '12px 0', fontSize: 11 }}>Private</GhostButton>
        <GhostButton onClick={A.onProfile} size="sm" full style={{ padding: '12px 0', fontSize: 11 }}>Friends</GhostButton>
      </div>
    </Screen>
  );
}

// Reused tiny iOS status bar.
function StatusBarMobile({ time = '9:41' }) {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 50,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', zIndex: 10,
    }}>
      <Mono size={14} weight={600}>{time}</Mono>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', opacity: .8 }}>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="white"><rect x="1" y="2" width="3" height="7" rx="1"/><rect x="5" y="0" width="3" height="9" rx="1"/><rect x="9" y="3" width="3" height="6" rx="1" opacity=".5"/></svg>
        <svg width="14" height="11" viewBox="0 0 14 11" fill="none" stroke="white" strokeWidth="1.2"><path d="M1 5.5 A7 7 0 0 1 13 5.5 M3 7 A4 4 0 0 1 11 7 M5.5 8.5 A1.5 1.5 0 0 1 8.5 8.5"/></svg>
        <svg width="22" height="10" viewBox="0 0 22 10" fill="none"><rect x=".5" y=".5" width="18" height="9" rx="2" stroke="white" opacity=".5"/><rect x="2" y="2" width="14" height="6" rx="1" fill="white"/><rect x="20" y="3" width="1.5" height="4" rx=".5" fill="white" opacity=".5"/></svg>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCH FINDING — desktop.
// ─────────────────────────────────────────────────────────────────────────────
function MatchFindingDesktop({ width = 1280, height = 800, data, actions }) {
  const S = data || defaultState();
  const A = actions || defaultActions();
  const m = S.matchmaking;

  return (
    <Screen width={width} height={height}>
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.15,
        maskImage: 'radial-gradient(circle at 50% 50%, black 0%, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 0%, transparent 70%)',
      }}>
        <LangtonField w={48} h={30} cellSize={Math.floor(width / 48)}
          ants={spawnAnts({ w: 48, h: 30, players: 4, perPlayer: 1, rule: 'RL', seed: 99 })}
          palette={PLAYER_COLORS.slice(0, 4).map((p) => p.hex)} tps={14} glow={false} />
      </div>

      <div style={{ position: 'absolute', top: 28, left: 32, right: 32, display: 'flex', justifyContent: 'space-between' }}>
        <GhostButton onClick={A.onBack} size="sm">← Back</GhostButton>
        <Logo size={18} />
        <div style={{ width: 80 }} />
      </div>

      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 36, padding: '0 80px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <Eyebrow color={T.accent}>{m.mode}</Eyebrow>
          <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1.2, marginTop: 8 }}>
            Searching for opponents
          </div>
          <Mono size={14} color={T.textMuted} style={{ marginTop: 8 }}>
            estimated wait · {m.estimatedWait}
          </Mono>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, m.target)}, 220px)`, gap: 14,
          background: 'rgba(255,255,255,.02)', padding: 18, borderRadius: 18,
          border: '1px solid rgba(255,255,255,.06)',
        }}>
          {m.slots.slice(0, m.target).map((slot, i) => <SlotCard key={i} slot={slot} index={i} />)}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Mono size={14} color={T.textPrimary}>{m.found} / {m.target} players</Mono>
          <div style={{ width: 260 }}>
            <Progress value={m.found} max={m.target} color={T.accent} height={4} />
          </div>
          <GhostButton onClick={A.onCancelSearch} size="sm">Cancel</GhostButton>
        </div>
      </div>
    </Screen>
  );
}

function SlotCard({ slot, index }) {
  if (!slot.filled) {
    return (
      <div style={{
        height: 64, borderRadius: 12, padding: '0 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(255,255,255,.02)',
        border: '1px dashed rgba(255,255,255,.10)', opacity: 0.6,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          border: '1.5px dashed rgba(255,255,255,.18)',
          animation: 'spin360 3s linear infinite', flex: '0 0 auto',
        }} />
        <Mono size={11} color={T.textDim}>searching · slot {index + 1}</Mono>
      </div>
    );
  }
  // Contract: slot.player.{colorId, username, level, sr, isYou}
  // Legacy:   slot.{playerId, level, sr, isYou}
  const player = slot.player || slot;
  const colorIdx = player.colorId ?? (typeof player.playerId === 'number' ? player.playerId : 0);
  const p = PLAYER_COLORS[colorIdx] || PLAYER_COLORS[0];
  const name = player.username || p.name;
  return (
    <div style={{
      height: 64, borderRadius: 12, padding: '0 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      background: `${p.hex}10`, border: `1px solid ${p.hex}55`,
      boxShadow: `0 0 24px ${p.hex}22`, transition: 'all .25s ease',
    }}>
      <AntMarker color={p.hex} size={28} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {name}{player.isYou && <span style={{ color: (T.accent), marginLeft: 6 }}>·you</span>}
        </span>
        <Mono size={10} color={T.textMuted}>LVL {player.level} · {player.sr} SR</Mono>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCH FINDING — mobile.
// ─────────────────────────────────────────────────────────────────────────────
function MatchFindingMobile({ width = 390, height = 844, data, actions }) {
  const S = data || defaultState();
  const A = actions || defaultActions();
  const m = S.matchmaking;

  return (
    <Screen width={width} height={height}>
      <StatusBarMobile />
      <div style={{ position: 'absolute', top: 60, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={A.onBack} style={{ ...iconBtnStyle, width: 32, height: 32 }}>‹</button>
        <Logo size={14} />
        <div style={{ width: 32 }} />
      </div>

      <div style={{ position: 'absolute', top: 120, left: 20, right: 20, textAlign: 'center' }}>
        <Eyebrow color={T.accent}>{m.mode}</Eyebrow>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.6, marginTop: 6 }}>Searching...</div>
        <Mono size={12} color={T.textMuted} style={{ marginTop: 4 }}>est. wait · {m.estimatedWait}</Mono>
      </div>

      <div style={{
        position: 'absolute', top: 210, left: 20, right: 20, bottom: 130,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {m.slots.slice(0, m.target).map((slot, i) => <SlotRowMobile key={i} slot={slot} index={i} />)}
      </div>

      <div style={{ position: 'absolute', bottom: 28, left: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Mono size={12}>{m.found} / {m.target}</Mono>
          <Mono size={10} color={T.textMuted}>matchmaking</Mono>
        </div>
        <Progress value={m.found} max={m.target} color={T.accent} height={4} />
        <GhostButton onClick={A.onCancelSearch} full size="sm">Cancel</GhostButton>
      </div>
    </Screen>
  );
}

function SlotRowMobile({ slot, index }) {
  if (!slot.filled) {
    return (
      <div style={{
        height: 56, borderRadius: 12, padding: '0 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(255,255,255,.02)',
        border: '1px dashed rgba(255,255,255,.10)', opacity: 0.6,
      }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,.18)', animation: 'spin360 3s linear infinite' }} />
        <Mono size={11} color={T.textDim}>slot {index + 1} · searching</Mono>
      </div>
    );
  }
  const player = slot.player || slot;
  const colorIdx = player.colorId ?? (typeof player.playerId === 'number' ? player.playerId : 0);
  const p = PLAYER_COLORS[colorIdx] || PLAYER_COLORS[0];
  const name = player.username || p.name;
  return (
    <div style={{
      height: 56, borderRadius: 12, padding: '0 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      background: `${p.hex}12`, border: `1px solid ${p.hex}55`,
    }}>
      <AntMarker color={p.hex} size={24} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {name}{player.isYou && <span style={{ color: (T.accent), marginLeft: 6 }}>·you</span>}
        </span>
        <Mono size={10} color={T.textMuted}>LVL {player.level} · {player.sr} SR</Mono>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRE-MATCH LOBBY — desktop.
// ─────────────────────────────────────────────────────────────────────────────
function LobbyDesktop({ width = 1280, height = 800, data, actions }) {
  const S = data || defaultState();
  const A = actions || defaultActions();
  const lobby = S.lobby;
  const squad = lobby.squad;

  const previewAnts = React.useMemo(() => squad.map((r, i) => ({
    x: 10 + i * 2, y: 10 + (i % 2) * 4, dir: i % 4,
    owner: 0, rule: LA_RULES[r] || 'RL',
  })).concat([{ x: 16, y: 16, dir: 0, owner: 1, rule: LA_RULES.classic }]),
    [JSON.stringify(squad)]);

  return (
    <Screen width={width} height={height}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 60,
        display: 'flex', alignItems: 'center', padding: '0 32px', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,.06)',
      }}>
        <Logo size={18} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Eyebrow>match begins in</Eyebrow>
          <Mono size={26} weight={600} color={T.accent}>{lobby.countdown}</Mono>
        </div>
        <Chip color={T.success} size="md">{lobby.mode}</Chip>
      </div>

      <div style={{ position: 'absolute', top: 60, left: 0, right: 0, bottom: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        <div style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 24, borderRight: '1px solid rgba(255,255,255,.06)' }}>
          <div>
            <Eyebrow color={T.textMuted}>pick rules · {squad.length} ants · your squad</Eyebrow>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.6, marginTop: 6 }}>Configure colony</div>
            <div style={{ color: (T.textMuted), fontSize: 12, marginTop: 6, lineHeight: 1.5, maxWidth: 460 }}>
              Each ant follows a turning rule. Mix them to balance aggression and territory growth.
              Test against the phantom bot below in real time.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {squad.map((rule, i) => (
              <SquadRuleRow key={i} index={i} rule={rule} onChange={(v) => A.onSquadChange(i, v)} options={lobby.rulesAvailable} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
            <PrimaryButton onClick={A.onReady} size="md" style={{ flex: 1 }}>Ready</PrimaryButton>
            <GhostButton size="md">Random</GhostButton>
            <GhostButton size="md">Save preset</GhostButton>
          </div>
        </div>

        <div style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <Eyebrow color={T.textMuted}>squad preview · vs phantom</Eyebrow>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>Test arena</div>
          </div>
          <div style={{
            background: '#0A081A', borderRadius: 14, padding: 16,
            border: '1px solid rgba(255,255,255,.06)', position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <LangtonField w={32} h={20} cellSize={11} ants={previewAnts}
              palette={[pickUserColor(S.user), '#5A5870']} tps={20}
              glow={true} antScale={0.85} bg="#0A081A" radius={8} />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Eyebrow color={T.textMuted}>players · {lobby.players.length} / {lobby.players.length}</Eyebrow>
              <Mono size={10} color={T.textMuted}>
                {lobby.players.filter(p => p.status === 'ready').length} ready ·{' '}
                {lobby.players.filter(p => p.status === 'picking').length} picking
              </Mono>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lobby.players.map((player, i) => {
                // Contract: player.colorId (0..9), player.username, player.ready (bool), player.isYou
                // Legacy:   player.playerId (numeric), player.status ('ready'|'picking'), player.isYou
                const colorIdx = player.colorId ?? (typeof player.playerId === 'number' ? player.playerId : i);
                const isReady  = player.ready ?? (player.status === 'ready');
                const isYou    = player.isYou;
                const p = PLAYER_COLORS[colorIdx] || PLAYER_COLORS[0];
                const displayName = player.username || p.name;
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 8,
                    background: isYou ? `${p.hex}10` : 'transparent',
                    border: isYou ? `1px solid ${p.hex}33` : '1px solid transparent',
                  }}>
                    <AntMarker color={p.hex} size={16} />
                    <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>
                      {displayName}{isYou && <span style={{ color: (T.accent), marginLeft: 6 }}>·you</span>}
                    </span>
                    {isReady ? (
                      <Chip color={T.success} size="sm">✓ ready</Chip>
                    ) : (
                      <Mono size={10} color={T.textMuted}>picking…</Mono>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}

function SquadRuleRow({ index, rule, onChange, options }) {
  const m = RULE_META[rule] || RULE_META.classic;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '24px 1fr auto',
      gap: 14, alignItems: 'center', padding: '14px 16px',
      background: 'rgba(255,255,255,.025)', borderRadius: 12,
      border: '1px solid rgba(255,255,255,.06)',
    }}>
      <Mono size={11} color={T.textDim}>0{index + 1}</Mono>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: `${m.color}22`, border: `1px solid ${m.color}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 16px ${m.color}33`,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{rule}</span>
          <Mono size={10} color={T.textMuted}>{m.desc} · {m.code}</Mono>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map((o) => (
          <button key={o} onClick={() => onChange(o)} style={{
            width: 30, height: 30, borderRadius: 7, cursor: 'pointer',
            background: o === rule ? `${RULE_META[o].color}33` : 'transparent',
            border: `1px solid ${o === rule ? RULE_META[o].color : 'rgba(255,255,255,.12)'}`,
            color: RULE_META[o].color, fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 700,
          }}>
            {o[0].toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRE-MATCH LOBBY — mobile.
// ─────────────────────────────────────────────────────────────────────────────
function LobbyMobile({ width = 390, height = 844, data, actions }) {
  const S = data || defaultState();
  const A = actions || defaultActions();
  const lobby = S.lobby;

  const previewAnts = React.useMemo(() => lobby.squad.map((r, i) => ({
    x: 6 + i * 2, y: 6 + (i % 2) * 4, dir: i % 4,
    owner: 0, rule: LA_RULES[r] || 'RL',
  })).concat([{ x: 12, y: 12, dir: 0, owner: 1, rule: LA_RULES.classic }]),
    [JSON.stringify(lobby.squad)]);

  return (
    <Screen width={width} height={height}>
      <StatusBarMobile />
      <div style={{ position: 'absolute', top: 60, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={A.onBack} style={{ ...iconBtnStyle, width: 32, height: 32 }}>‹</button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
          <Eyebrow color={T.textMuted}>starts in</Eyebrow>
          <Mono size={18} weight={600} color={T.accent}>{lobby.countdown}</Mono>
        </div>
        <div style={{ width: 32 }} />
      </div>

      <div style={{ position: 'absolute', top: 130, left: 20, right: 20 }}>
        <Eyebrow color={T.textMuted}>squad preview</Eyebrow>
        <div style={{
          marginTop: 8, background: '#0A081A', borderRadius: 12, padding: 12,
          border: '1px solid rgba(255,255,255,.06)',
          display: 'flex', justifyContent: 'center',
        }}>
          <LangtonField w={20} h={14} cellSize={14} ants={previewAnts}
            palette={[pickUserColor(S.user), '#5A5870']} tps={18}
            glow antScale={0.85} bg="#0A081A" radius={6} />
        </div>
      </div>

      <div style={{ position: 'absolute', top: 400, left: 20, right: 20, bottom: 90, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
        <Eyebrow color={T.textMuted}>your colony · pick rules</Eyebrow>
        {lobby.squad.map((rule, i) => (
          <SquadRowMobile key={i} index={i} rule={rule}
            onChange={(v) => A.onSquadChange(i, v)} options={lobby.rulesAvailable} />
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: 24, left: 20, right: 20 }}>
        <PrimaryButton onClick={A.onReady} full style={{ padding: '16px 0', fontSize: 15 }}>Ready</PrimaryButton>
      </div>
    </Screen>
  );
}

function SquadRowMobile({ index, rule, onChange, options }) {
  const m = RULE_META[rule] || RULE_META.classic;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px', borderRadius: 10,
      background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)',
    }}>
      <Mono size={10} color={T.textDim}>0{index + 1}</Mono>
      <div style={{ width: 18, height: 18, borderRadius: 5, background: `${m.color}22`, border: `1px solid ${m.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: m.color }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize', flex: 1 }}>{rule}</span>
      <div style={{ display: 'flex', gap: 3 }}>
        {options.map((o) => (
          <button key={o} onClick={() => onChange(o)} style={{
            width: 24, height: 24, borderRadius: 5, cursor: 'pointer',
            background: o === rule ? `${RULE_META[o].color}33` : 'transparent',
            border: `1px solid ${o === rule ? RULE_META[o].color : 'rgba(255,255,255,.12)'}`,
            color: RULE_META[o].color, fontFamily: 'JetBrains Mono', fontSize: 9, fontWeight: 700,
          }}>
            {o[0].toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TUTORIAL.
// ─────────────────────────────────────────────────────────────────────────────
function TutorialScreen({ width = 1280, height = 800, data, actions }) {
  const S = data || defaultState();
  const A = actions || defaultActions();
  const t = S.tutorial;

  const ants = React.useMemo(() => [
    { x: 12, y: 9, dir: 0, owner: 0, rule: 'RL' },
    { x: 5,  y: 5, dir: 2, owner: 1, rule: 'RL' },
  ], []);

  return (
    <Screen width={width} height={height}>
      <div style={{ position: 'absolute', top: 28, left: 32, right: 32, display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Logo size={16} />
          <Chip color={T.accent} size="md">tutorial · step {String(t.step).padStart(2, '0')} / {String(t.of).padStart(2, '0')}</Chip>
        </div>
        <GhostButton onClick={A.onTutorialSkip} size="sm">Skip tutorial</GhostButton>
      </div>

      <div style={{
        position: 'absolute', top: 90, left: 60, right: 60, bottom: 90,
        display: 'grid', gridTemplateColumns: '1fr 360px', gap: 40, alignItems: 'center',
      }}>
        <div style={{
          background: '#0A081A', borderRadius: 16, padding: 24,
          border: '1px solid rgba(255,255,255,.06)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <LangtonField w={24} h={18} cellSize={28} ants={ants}
            palette={[PLAYER_COLORS[0].hex, PLAYER_COLORS[1].hex]} tps={6}
            glow antScale={0.85} bg="#0A081A" radius={6} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Eyebrow color={T.accent}>{t.eyebrow}</Eyebrow>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.6, lineHeight: 1.1 }}>{t.title}</div>
          <div style={{ color: (T.textMuted), fontSize: 13, lineHeight: 1.6 }}>{t.body}</div>

          <div style={{
            background: 'rgba(255,69,58,.08)', border: '1px solid rgba(255,69,58,.25)',
            borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: '#FF453A22', border: '1px solid #FF453A66', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 14 }}>⚠</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{t.hint.title}</div>
              <Mono size={10} color={T.textMuted}>{t.hint.sub}</Mono>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {Array.from({ length: t.of }).map((_, i) => {
              const done = i < t.step;
              return (
                <div key={i} style={{
                  flex: 1, height: 3, borderRadius: 999,
                  background: done ? (T.accent) : 'rgba(255,255,255,.1)',
                  boxShadow: done ? '0 0 8px #FFD60A88' : 'none',
                }} />
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <PrimaryButton onClick={A.onTutorialNext} size="md" style={{ flex: 1 }}>Next →</PrimaryButton>
            <GhostButton onClick={A.onTutorialReplay} size="md">Replay</GhostButton>
          </div>
        </div>
      </div>
    </Screen>
  );
}

Object.assign(window, {
  iconBtnStyle, pickUserColor, StatusBarMobile,
  MainMenuDesktop, MainMenuMobile,
  MatchFindingDesktop, MatchFindingMobile,
  LobbyDesktop, LobbyMobile,
  TutorialScreen,
});
