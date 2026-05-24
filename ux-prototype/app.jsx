// app.jsx — Design canvas composition: every screen + tweaks panel.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "dark",
  "tps": 18,
  "fieldSize": 60,
  "playerCount": 4,
  "startHp": 3,
  "menuRule": "spiral"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Build the data tree from defaults + tweaks. Screens read everything from `data`.
  const data = React.useMemo(() => {
    const s = defaultState();
    s.match = {
      ...s.match,
      playerCount: t.playerCount > 8 ? 8 : t.playerCount,
      tps: t.tps,
      fieldW: t.fieldSize,
      fieldH: Math.round(t.fieldSize * 0.66),
      startHp: t.startHp,
      yourAnts: s.match.yourAnts.map((a, i) => ({ ...a, hp: i === 4 ? 0 : Math.min(t.startHp, a.hp) })),
    };
    s.matchmaking = {
      ...s.matchmaking,
      target: t.playerCount === 10 ? 10 : 8,
    };
    return s;
  }, [t.playerCount, t.tps, t.fieldSize, t.startHp]);

  // Canvas mode — no real router/actions, all callbacks are no-ops.
  const actions = defaultActions();

  return (
    <>
      <GlobalStyle />
      <DesignCanvas>

        <DCSection id="menu" title="01 — Main Menu" subtitle="Living automaton background. 3-click max to a match.">
          <DCArtboard id="menu-desktop" label="Desktop · 1280×800" width={1280} height={800}>
            <MainMenuDesktop width={1280} height={800} data={data} actions={actions} tps={t.tps} fieldRule={t.menuRule} />
          </DCArtboard>
          <DCArtboard id="menu-mobile" label="Mobile · 390×844" width={390} height={844}>
            <MainMenuMobile width={390} height={844} data={data} actions={actions} />
          </DCArtboard>
        </DCSection>

        <DCSection id="finding" title="02 — Match Finding" subtitle="Slots animate in as opponents are matched.">
          <DCArtboard id="find-desktop" label="Desktop · 8P search" width={1280} height={800}>
            <MatchFindingDesktop width={1280} height={800} data={data} actions={actions} />
          </DCArtboard>
          <DCArtboard id="find-mobile" label="Mobile · 6P search" width={390} height={844}>
            <MatchFindingMobile width={390} height={844} data={data} actions={actions} />
          </DCArtboard>
        </DCSection>

        <DCSection id="lobby" title="03 — Pre-Match Lobby" subtitle="Configure squad rules with a live phantom-bot preview.">
          <DCArtboard id="lobby-desktop" label="Desktop · squad setup" width={1280} height={800}>
            <LobbyDesktop width={1280} height={800} data={data} actions={actions} />
          </DCArtboard>
          <DCArtboard id="lobby-mobile" label="Mobile · squad setup" width={390} height={844}>
            <LobbyMobile width={390} height={844} data={data} actions={actions} />
          </DCArtboard>
          <DCArtboard id="tutorial-desktop" label="Tutorial · step 02" width={1280} height={800}>
            <TutorialScreen width={1280} height={800} data={data} actions={actions} />
          </DCArtboard>
        </DCSection>

        <DCSection id="hud" title="04 — Match HUD" subtitle="Live Langton's Ant simulation. Real ticks on the canvas.">
          <DCArtboard id="hud-desktop" label={`Desktop · ${data.match.playerCount}P · ${data.match.fieldW}² · ${data.match.tps}tps`} width={1280} height={800}>
            <MatchHudDesktop width={1280} height={800} data={data} actions={actions} />
          </DCArtboard>
          <DCArtboard id="hud-mobile" label="Mobile · 30² · 16tps" width={390} height={844}>
            <MatchHudMobile width={390} height={844} data={data} actions={actions} />
          </DCArtboard>
        </DCSection>

        <DCSection id="result" title="05 — Match Result" subtitle="Three desktop compositions + mobile compact.">
          <DCArtboard id="result-classic" label="A · Classic leaderboard" width={1280} height={800}>
            <ResultClassic width={1280} height={800} data={data} actions={actions} />
          </DCArtboard>
          <DCArtboard id="result-hero" label="B · Hero focus" width={1280} height={800}>
            <ResultHero width={1280} height={800} data={data} actions={actions} />
          </DCArtboard>
          <DCArtboard id="result-grid" label="C · Comparison grid" width={1280} height={800}>
            <ResultGrid width={1280} height={800} data={data} actions={actions} />
          </DCArtboard>
          <DCArtboard id="result-mobile" label="Mobile compact" width={390} height={844}>
            <ResultMobile width={390} height={844} data={data} actions={actions} />
          </DCArtboard>
        </DCSection>

        <DCSection id="reward" title="06 — Reward Box" subtitle="Post-match loot opening. Rarity tier on top, animated glyph in centre.">
          <DCArtboard id="reward-box" label="Epic · Violet Pulse" width={640} height={800}>
            <RewardBox width={640} height={800} data={data} actions={actions} />
          </DCArtboard>
        </DCSection>

        <DCSection id="stats" title="07 — Player Profile & Stats" subtitle="Profile with ELO graph, win rate by rule, vs-average radar, heat maps, achievements.">
          <DCArtboard id="profile-desktop" label="Profile · desktop" width={1280} height={800}>
            <ProfileDesktop width={1280} height={800} data={data} actions={actions} />
          </DCArtboard>
          <DCArtboard id="profile-mobile" label="Profile · mobile" width={390} height={844}>
            <ProfileMobile width={390} height={844} data={data} actions={actions} />
          </DCArtboard>
        </DCSection>

        <DCSection id="match-detail" title="08 — Match Detail" subtitle="Per-match deep dive: territory chart, win-probability, per-player breakdown, timeline.">
          <DCArtboard id="match-detail-desktop" label="Match #M-A47BC · 8P · 4:53" width={1280} height={800}>
            <MatchDetailDesktop width={1280} height={800} data={data} actions={actions} />
          </DCArtboard>
        </DCSection>

        <DCSection id="meta" title="09 — Global Meta" subtitle="Balance dashboard, win-rate trends, rule crosstab, world heat maps.">
          <DCArtboard id="meta-desktop" label="Meta · balance" width={1280} height={800}>
            <MetaDesktop width={1280} height={800} data={data} actions={actions} />
          </DCArtboard>
        </DCSection>

        <DCSection id="leaderboard" title="10 — Leaderboard" subtitle="Top-100 standings with your position highlighted.">
          <DCArtboard id="leaderboard-desktop" label="Global · top 15" width={1280} height={800}>
            <LeaderboardDesktop width={1280} height={800} data={data} actions={actions} />
          </DCArtboard>
          <DCArtboard id="leaderboard-mobile" label="Mobile · top 10" width={390} height={844}>
            <LeaderboardMobile width={390} height={844} data={data} actions={actions} />
          </DCArtboard>
        </DCSection>

      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Match" />
        <TweakSelect label="Players"
          value={t.playerCount}
          options={[
            { value: 2, label: '2 · duel' },
            { value: 4, label: '4 · default' },
            { value: 8, label: '8 · clash' },
            { value: 10, label: '10 · chaos' },
          ]}
          onChange={(v) => setTweak('playerCount', v)} />
        <TweakSlider label="Field size" value={t.fieldSize} min={20} max={100} step={10}
          unit="²" onChange={(v) => setTweak('fieldSize', v)} />
        <TweakSlider label="Sim speed" value={t.tps} min={4} max={40} unit=" tps"
          onChange={(v) => setTweak('tps', v)} />
        <TweakSlider label="Start HP" value={t.startHp} min={1} max={5}
          onChange={(v) => setTweak('startHp', v)} />

        <TweakSection label="Visual" />
        <TweakRadio label="Palette" value={t.palette} options={['dark', 'light']}
          onChange={(v) => setTweak('palette', v)} />
        <TweakSelect label="Menu rule"
          value={t.menuRule}
          options={[
            { value: 'classic', label: 'Classic (RL)' },
            { value: 'spiral',  label: 'Spiral (LRR)' },
            { value: 'reverse', label: 'Reverse (LR)' },
            { value: 'flower',  label: 'Flower (RLR)' },
          ]}
          onChange={(v) => setTweak('menuRule', v)} />
      </TweaksPanel>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
