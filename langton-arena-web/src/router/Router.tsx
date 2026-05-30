// src/router/Router.tsx
//
// Простой роутер: читает state.currentScreen и рендерит нужный экран.
// Для production-роутинга позже можно подключить react-router, но для
// прототипа простого диспатча достаточно.
//
// Stage 7: при загрузке страницы проверяет URL на ?p= или ?r= параметры.
// Если есть — загружает shared payload и переходит в sandbox.

import { useEffect, useRef, lazy, Suspense } from 'react';
import { useAppState } from '@state/AppStateProvider';
import type { ScreenId } from '@core/contract/state';

// Day 37: code splitting. MenuScreen + MatchScreen остаются в main bundle
// (entry points + most common). Sandbox, Settings, Profile, etc — lazy chunks.
import { MenuScreen } from '@screens/MenuScreen';
import { MatchScreen } from '@screens/MatchScreen';
const SandboxScreen = lazy(() => import('@screens/SandboxScreen').then(m => ({ default: m.SandboxScreen })));
const SettingsScreen = lazy(() => import('@screens/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
const MatchmakingScreen = lazy(() => import('@screens/MatchmakingScreen').then(m => ({ default: m.MatchmakingScreen })));
const LobbyScreen = lazy(() => import('@screens/LobbyScreen').then(m => ({ default: m.LobbyScreen })));
const ResultScreen = lazy(() => import('@screens/ResultScreen').then(m => ({ default: m.ResultScreen })));
const ProfileScreen = lazy(() => import('@screens/ProfileScreen').then(m => ({ default: m.ProfileScreen })));
const CreditsScreen = lazy(() => import('@screens/CreditsScreen').then(m => ({ default: m.CreditsScreen })));
const ChangelogScreen = lazy(() => import('@screens/ChangelogScreen').then(m => ({ default: m.ChangelogScreen })));

const SCREEN_MAP: Record<ScreenId, React.ComponentType> = {
  menu:         MenuScreen,
  sandbox:      SandboxScreen,
  settings:     SettingsScreen,
  matchmaking:  MatchmakingScreen,
  lobby:        LobbyScreen,
  match:        MatchScreen,
  result:       ResultScreen,
  profile:      ProfileScreen,
  credits:      CreditsScreen,
  changelog:    ChangelogScreen,
};

function ScreenFallback() {
  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0E0B1F', color: '#888',
      fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
    }}>
      Loading…
    </div>
  );
}

export function Router() {
  const { state, setScreen, sandbox: sx } = useAppState();
  const handledRef = useRef(false);

  // Stage 7-8: разовая проверка URL при mount
  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    // Stage 8 Day 7: ?room=abc123 → MatchScreen
    // Stage 9.4: ?spectate=abc123 → MatchScreen в spectator mode
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room') ?? params.get('spectate');
    if (roomCode && roomCode.length > 0) {
      setScreen('match');
      return; // не парсим preset/replay одновременно с room
    }

    (async () => {
      const { parseSharedFromCurrentUrl, clearSharedFromUrl } = await import('@lib/urlShare');
      const result = parseSharedFromCurrentUrl();
      if (!result) return;
      if (!result.ok) {
        console.warn('[shared URL]', result.reason);
        return;
      }
      if (result.kind === 'preset') {
        sx.loadPreset(result.data as any);
        setScreen('sandbox');
        // Удаляем URL params чтобы при F5 не загружать снова
        clearSharedFromUrl();
      } else if (result.kind === 'replay') {
        const { saveReplay } = await import('@lib/replayStorage');
        const replay = result.data as any;
        const newId = `replay-${Date.now()}-shared`;
        const stored = { ...replay, metadata: { ...replay.metadata, id: newId } };
        saveReplay(stored);
        // Загружаем config из replay + переходим в sandbox с Replays tab
        sx.loadPreset(replay.config);
        setScreen('sandbox');
        clearSharedFromUrl();
        // Уведомление пользователю через alert (нет toast в Router)
        setTimeout(() => {
          alert(`Shared replay "${replay.metadata.name}" loaded — see Replays tab to play.`);
        }, 100);
      }
    })();
  }, [sx, setScreen]);

  const Component = SCREEN_MAP[state.currentScreen] ?? MenuScreen;
  return (
    <Suspense fallback={<ScreenFallback />}>
      <Component />
    </Suspense>
  );
}
