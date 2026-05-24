// mobile-app.jsx — Full-bleed mobile prototype.

function MobileApp() {
  const { data, setData, updateKey } = useAppState();
  const { screen, setScreen, next, prev } = useRouter(MOBILE_FLOW, 'menu');

  React.useEffect(() => {
    updateKey('match', { live: screen === 'hud' });
  }, [screen, updateKey]);

  const actions = React.useMemo(() => ({
    ...defaultActions(),

    onPlay:          () => setScreen('finding'),
    onTrain:         () => setScreen('lobby'),
    onPrivate:       () => setScreen('lobby'),
    onProfile:       () => setScreen('profile'),
    onSettings:      () => {},
    onBack:          () => prev(),

    onOpenProfile:     () => setScreen('profile'),
    onOpenLeaderboard: () => setScreen('leaderboard'),
    onOpenMatch:       () => {},
    onOpenMeta:        () => {},

    onCancelSearch:  () => setScreen('menu'),
    onReady:         () => setScreen('hud'),
    onSquadChange:   (idx, rule) => updateKey('lobby', (l) => ({
      ...l, squad: l.squad.map((r, i) => (i === idx ? rule : r)),
    })),

    onSelectAnt:     (idx) => console.log('focus ant', idx),
    onQuit:          () => setScreen('result'),

    onRematch:       () => setScreen('lobby'),
    onNewMatch:      () => setScreen('finding'),
    onMenu:          () => setScreen('menu'),
    onOpenReward:    () => setScreen('reward'),
    onEquipReward:   () => setScreen('menu'),

    onMatchEnd: (payload) => {
      const srGain = payload.outcome === 'victory' ? 12 : -8;
      const xpGain = payload.outcome === 'victory' ? 24 : 10;
      const rows = payload.rows.map((r) => ({
        ...r,
        sr: r.isYou ? (srGain >= 0 ? `+${srGain}` : `${srGain}`) :
            (r.pct >= payload.rows[0].pct * 0.7 ? '+5' : '-2'),
        peak: r.place === 1 ? '★ ended on top' : 'mid-tier run',
      }));
      updateKey('result', {
        rows, outcome: payload.outcome, place: payload.place, of: payload.of,
        duration: payload.duration, xpGained: xpGain, srGained: srGain,
        totals: payload.totals,
      });
      setTimeout(() => setScreen('result'), 900);
    },
    onSwapRule: (id, rule) => console.log('swap', id, rule),
    onToggleMute: () => window.fx?.setMuted(!window.fx?.isMuted()),
  }), [setScreen, updateKey, prev]);

  const Screens = {
    menu:    <MainMenuMobile      width={390} height={844} data={data} actions={actions} />,
    finding: <MatchFindingMobile  width={390} height={844} data={data} actions={actions} />,
    lobby:   <LobbyMobile         width={390} height={844} data={data} actions={actions} />,
    hud:     <MatchHudMobile      width={390} height={844} data={data} actions={actions} />,
    result:  <ResultMobile        width={390} height={844} data={data} actions={actions} />,
    reward:  <RewardBox           width={390} height={844} data={data} actions={actions} />,
    profile:     <ProfileMobile       width={390} height={844} data={data} actions={actions} />,
    leaderboard: <LeaderboardMobile   width={390} height={844} data={data} actions={actions} />,
  };

  return (
    <ThemeProvider initial={(window.__ARENA_THEME) || 'dark'}>
      <I18nProvider locale={data?.settings?.account?.locale || data?.locale?.current || 'en'}>
        <GlobalStyle />
        <FullBleedStage width={390} height={844}>
          {Screens[screen]}
        </FullBleedStage>
        <NavBar flow={MOBILE_FLOW} screen={screen} onSet={setScreen} onPrev={prev} onNext={next} />
      </I18nProvider>
    </ThemeProvider>
  );
}

const mRoot = ReactDOM.createRoot(document.getElementById('root'));
mRoot.render(<MobileApp />);
