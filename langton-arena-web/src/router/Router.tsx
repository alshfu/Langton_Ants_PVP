// src/router/Router.tsx
//
// Простой роутер: читает state.currentScreen и рендерит нужный экран.
// Для production-роутинга позже можно подключить react-router, но для
// прототипа простого диспатча достаточно.
//
// Stage 7: при загрузке страницы проверяет URL на ?p= или ?r= параметры.
// Если есть — загружает shared payload и переходит в sandbox.

import { useEffect, useRef } from 'react';
import { useAppState } from '@state/AppStateProvider';
import type { ScreenId } from '@core/contract/state';

import { MenuScreen } from '@screens/MenuScreen';
import { SandboxScreen } from '@screens/SandboxScreen';
import { SettingsScreen } from '@screens/SettingsScreen';
import { MatchmakingScreen } from '@screens/MatchmakingScreen';
import { LobbyScreen } from '@screens/LobbyScreen';
import { MatchScreen } from '@screens/MatchScreen';
import { ResultScreen } from '@screens/ResultScreen';
import { ProfileScreen } from '@screens/ProfileScreen';
import { CreditsScreen } from '@screens/CreditsScreen';
import { ChangelogScreen } from '@screens/ChangelogScreen';

const SCREEN_MAP: Record<ScreenId, () => JSX.Element> = {
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

export function Router() {
  const { state, setScreen, sandbox: sx } = useAppState();
  const handledRef = useRef(false);

  // Stage 7-8: разовая проверка URL при mount
  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    // Stage 8 Day 7: ?room=abc123 → MatchScreen
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
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
  return <Component />;
}
