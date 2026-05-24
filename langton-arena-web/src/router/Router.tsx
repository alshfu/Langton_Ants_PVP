// src/router/Router.tsx
//
// Простой роутер: читает state.currentScreen и рендерит нужный экран.
// Для production-роутинга позже можно подключить react-router, но для
// прототипа простого диспатча достаточно.

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
  const { state } = useAppState();
  const Component = SCREEN_MAP[state.currentScreen] ?? MenuScreen;
  return <Component />;
}
