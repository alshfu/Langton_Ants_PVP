// desktop-app.jsx — Full-bleed desktop prototype.
// All screens wired to a single state. Controllers hook into `actions`.
// v0.5: live gameplay — match.live flips when entering HUD, auto-transitions to Result.

function DesktopApp() {
  const { data, setData, updateKey } = useAppState();
  const { screen, setScreen, next, prev } = useRouter(DESKTOP_FLOW, 'menu');

  // Sync audio mixer with settings.audio whenever it changes.
  React.useEffect(() => {
    if (window.fx?.bind && data.settings?.audio) window.fx.bind(data.settings.audio);
    window.__ARENA_AUDIO_MUTE_BG = !!data.settings?.audio?.muteWhenInBackground;
  }, [JSON.stringify(data.settings?.audio)]);

  // When entering the HUD → start a live match. When leaving → freeze.
  React.useEffect(() => {
    if (screen === 'hud') {
      updateKey('match', { live: true });
    } else {
      updateKey('match', { live: false });
    }
  }, [screen, updateKey]);

  const actions = React.useMemo(() => ({
    ...defaultActions(),

    onPlay:          () => setScreen('finding'),
    onTrain:         () => setScreen('tutorial'),
    onPrivate:       () => setScreen('lobby'),
    onProfile:       () => setScreen('profile'),
    onSettings:      () => setScreen('settings'),
    onOpenSettings:  () => setScreen('settings'),
    onOpenSandbox:   () => setScreen('sandbox'),
    onOpenChangelog: () => setScreen('changelog'),
    onOpenCredits:   () => setScreen('credits'),
    onReturnToMenu:  () => setScreen('menu'),
    onBack:          () => prev(),

    onOpenProfile:     () => setScreen('profile'),
    onOpenMatch:       () => setScreen('match-detail'),
    onOpenMeta:        () => setScreen('meta'),
    onOpenLeaderboard: () => setScreen('leaderboard'),
    onPlayReplay:      () => setScreen('hud'),
    onProfileTab:      () => {},

    onCancelSearch:  () => setScreen('menu'),
    onReady:         () => setScreen('hud'),
    onSquadChange:   (idx, rule) => updateKey('lobby', (l) => ({
      ...l, squad: l.squad.map((r, i) => (i === idx ? rule : r)),
    })),

    onSelectAnt:     (idx) => console.log('focus ant', idx),
    onPause:         () => {},
    onQuit:          () => setScreen('result-a'),

    onRematch:       () => setScreen('lobby'),
    onNewMatch:      () => setScreen('finding'),
    onMenu:          () => setScreen('menu'),
    onOpenReward:    () => setScreen('reward'),
    onEquipReward:   () => setScreen('menu'),

    onTutorialNext:    () => updateKey('tutorial', (t) =>
      t.step < t.of ? { ...t, step: t.step + 1 } : t),
    onTutorialReplay:  () => updateKey('tutorial', (t) => ({ ...t, step: 1 })),
    onTutorialSkip:    () => setScreen('menu'),

    // Gameplay v0.5
    onMatchEnd: (payload) => {
      // payload: { rows, outcome, place, of, duration, totals }
      const youRow = payload.rows.find((r) => r.isYou);
      const srGain = payload.outcome === 'victory' ? 12 : -8;
      const xpGain = payload.outcome === 'victory' ? 24 : 10;
      // Decorate rows with sr/peak so the existing Result screens still look filled.
      const rows = payload.rows.map((r) => ({
        ...r,
        sr: r.isYou ? (srGain >= 0 ? `+${srGain}` : `${srGain}`) :
            (r.pct >= payload.rows[0].pct * 0.7 ? '+5' : '-2'),
        peak: r.place === 1 ? '★ ended on top' : (r.place === payload.of ? 'never led' : 'mid-tier run'),
      }));
      updateKey('result', {
        rows,
        outcome: payload.outcome,
        place: payload.place,
        of: payload.of,
        duration: payload.duration,
        xpGained: xpGain,
        srGained: srGain,
        totals: payload.totals,
      });
      // Cinematic delay before showing result (lets the death/victory tone play).
      setTimeout(() => setScreen('result-a'), 900);
    },

    onSwapRule: (antId, rule) => {
      console.log('swap', antId, '→', rule);
    },

    onToggleMute: () => {
      window.fx?.setMuted(!window.fx?.isMuted());
    },
  }), [setScreen, updateKey, prev]);

  const Screens = {
    menu:     <MainMenuDesktop      width={1280} height={800} data={data} actions={actions} tps={data.match.tps} />,
    finding:  <MatchFindingDesktop  width={1280} height={800} data={data} actions={actions} />,
    lobby:    <LobbyDesktop         width={1280} height={800} data={data} actions={actions} />,
    hud:      <MatchHudDesktop      width={1280} height={800} data={data} actions={actions} />,
    'result-a': <ResultClassic      width={1280} height={800} data={data} actions={actions} />,
    'result-b': <ResultHero         width={1280} height={800} data={data} actions={actions} />,
    'result-c': <ResultGrid         width={1280} height={800} data={data} actions={actions} />,
    reward:   <RewardBox            width={1280} height={800} data={data} actions={actions} />,
    tutorial: <TutorialScreen       width={1280} height={800} data={data} actions={actions} />,
    profile:      <ProfileDesktop       width={1280} height={800} data={data} actions={actions} />,
    'match-detail': <MatchDetailDesktop width={1280} height={800} data={data} actions={actions} />,
    meta:         <MetaDesktop          width={1280} height={800} data={data} actions={actions} />,
    leaderboard:  <LeaderboardDesktop   width={1280} height={800} data={data} actions={actions} />,
    sandbox:      <SandboxDesktop       width={1280} height={800} data={data} actions={actions} />,
    settings:     <SettingsDesktop      width={1280} height={800} data={data} actions={actions} />,
    credits:      <CreditsDesktop       width={1280} height={800} data={data} actions={actions} />,
    changelog:    <ChangelogDesktop     width={1280} height={800} data={data} actions={actions} />,
  };

  return (
    <ThemeProvider initial={(window.__ARENA_THEME) || 'dark'}>
      <I18nProvider locale={data?.settings?.account?.locale || data?.locale?.current || 'en'}>
        <GlobalStyle />
        <FullBleedStage width={1280} height={800}>
          {Screens[screen]}
        </FullBleedStage>
        <NavBar flow={DESKTOP_FLOW} screen={screen} onSet={setScreen} onPrev={prev} onNext={next} />
      </I18nProvider>
    </ThemeProvider>
  );
}

const dRoot = ReactDOM.createRoot(document.getElementById('root'));
dRoot.render(<DesktopApp />);
