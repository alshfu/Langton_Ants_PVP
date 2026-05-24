// core/src/contract/actions.ts
//
// Контракт интерфейса — типы actions.
// Соответствие: docs/interface-contract.md §5.
//
// UI вызывает actions через callback. Каждое действие возвращает Promise<ActionResult>.
// Сервер обрабатывает асинхронно.

export interface ActionError {
  code: string;
  message: string;
  recoverable: boolean;
  retryAfterMs?: number;
}

export type ActionResult<T = void> = Promise<{
  success: boolean;
  data?: T;
  error?: ActionError;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// Полный список actions (см. interface-contract.md §5.2)
// ─────────────────────────────────────────────────────────────────────────────
// Все методы — async. Если callback не подключён — реализация-заглушка
// возвращает { success: true } без побочных эффектов.

export interface AppActions {
  // Меню и навигация
  onScreenChange: (screenId: string) => ActionResult;
  onPlay: () => ActionResult;
  onResumeMatch: (matchId: string) => ActionResult;
  onOpenProfile: (playerId: string) => ActionResult;
  onOpenSettings: () => ActionResult;
  onOpenSandbox: () => ActionResult;
  onOpenTutorial: () => ActionResult;
  onOpenChangelog: () => ActionResult;
  onLogout: () => ActionResult;
  onQuit: () => ActionResult;

  // Матчмейкинг
  onStartMatchmaking: (mode: string, options?: unknown) => ActionResult;
  onCancelMatchmaking: () => ActionResult;
  onChangeRegion: (region: string) => ActionResult;
  onAcceptMatch: () => ActionResult;
  onDeclineMatch: () => ActionResult;

  // Лобби
  onLobbyReady: () => ActionResult;
  onLobbyUnready: () => ActionResult;
  onLobbyLeave: () => ActionResult;
  onSquadChange: (antIndex: number, ruleId: string) => ActionResult;
  onSquadShuffle: () => ActionResult;
  onSquadLoadPreset: (presetId: string) => ActionResult;
  onSquadSavePreset: (name: string) => ActionResult;
  onLobbyPreviewToggle: (enabled: boolean) => ActionResult;
  onLobbyChatSend: (text: string) => ActionResult;
  onLobbyQuickChat: (quickChatId: string) => ActionResult;
  onLobbyKickPlayer: (playerId: string) => ActionResult;

  // Матч
  onMatchPause: () => ActionResult;
  onMatchResume: () => ActionResult;
  onMatchForfeit: () => ActionResult;
  onSelectAnt: (antId: string) => ActionResult;
  onDeselectAnt: () => ActionResult;
  onCameraPan: (delta: { x: number; y: number }) => ActionResult;
  onCameraZoom: (delta: number, center: { x: number; y: number }) => ActionResult;
  onCameraReset: () => ActionResult;
  onCameraCenterOn: (target: { x: number; y: number } | string) => ActionResult;
  onCameraToggleAutoFollow: (enabled: boolean) => ActionResult;
  onSendQuickChat: (emoteId: string) => ActionResult;

  // Управление муравьями (v0.5+)
  onChangeAntRule: (antId: string, newRuleId: string) => ActionResult;
  onRecallAnt: (antId: string) => ActionResult;
  onDeployFromReserve: (reserveAntId: string, position: { x: number; y: number }) => ActionResult;
  onDeployStrategy: (reserveAntId: string, strategy: string) => ActionResult;
  onSwapReserveRule: (reserveAntId: string, newRuleId: string) => ActionResult;
  onDiscardReserve: (reserveAntId: string) => ActionResult;
  onCreateCustomRule: (name: string, pattern: string) => ActionResult;

  // Результаты
  onRematch: () => ActionResult;
  onCancelRematch: () => ActionResult;
  onNewMatch: () => ActionResult;
  onReturnToMenu: () => ActionResult;
  onOpenReward: () => ActionResult;
  onShareResult: () => ActionResult;
  onWatchReplay: (matchId: string) => ActionResult;
  onDownloadReplay: (matchId: string) => ActionResult;
  onReportPlayer: (playerId: string, reason: string) => ActionResult;

  // Награда
  onOpenLootbox: () => ActionResult;
  onClaimReward: () => ActionResult;
  onEquipReward: (itemId: string) => ActionResult;
  onSkipRewardAnimation: () => ActionResult;

  // Туториал
  onTutorialNext: () => ActionResult;
  onTutorialPrev: () => ActionResult;
  onTutorialReplay: () => ActionResult;
  onTutorialSkip: () => ActionResult;
  onTutorialComplete: () => ActionResult;

  // Профиль
  onProfileTabChange: (tab: string) => ActionResult;
  onLoadMoreHistory: () => ActionResult;
  onFilterHistory: (filters: unknown) => ActionResult;
  onAddFriend: (playerId: string) => ActionResult;
  onRemoveFriend: (playerId: string) => ActionResult;
  onBlockPlayer: (playerId: string) => ActionResult;
  onUnblockPlayer: (playerId: string) => ActionResult;
  onChangeUsername: (newName: string) => ActionResult;
  onChangeColor: (colorId: number) => ActionResult;
  onEquipCosmetic: (slot: string, itemId: string) => ActionResult;

  // Sandbox
  onSandboxConfigChange: (patch: unknown) => ActionResult;
  onSandboxPlay: () => ActionResult;
  onSandboxPause: () => ActionResult;
  onSandboxStep: () => ActionResult;
  onSandboxReset: () => ActionResult;
  onSandboxLoadPreset: (presetId: string) => ActionResult;
  onSandboxSaveSlot: (name: string) => ActionResult;
  onSandboxLoadSlot: (slotId: string) => ActionResult;
  onSandboxDeleteSlot: (slotId: string) => ActionResult;
  onSandboxExportConfig: () => ActionResult;
  onSandboxImportConfig: (json: string) => ActionResult;
  onSandboxAddPlayer: () => ActionResult;
  onSandboxRemovePlayer: (index: number) => ActionResult;
  onSandboxPlayerChange: (index: number, patch: unknown) => ActionResult;
  onSandboxResetHeatmaps: () => ActionResult;
  onSandboxExportHeatmap: (type: string) => ActionResult;

  // Настройки
  onSettingsChange: (category: string, key: string, value: unknown) => ActionResult;
  onSettingsReset: (category?: string) => ActionResult;
  onSettingsApply: () => ActionResult;
  onChangeLocale: (locale: string) => ActionResult;
  onChangeHotkey: (action: string, newKey: string) => ActionResult;

  // Модалки и тосты
  onModalClose: () => ActionResult;
  onModalAction: (actionId: string) => ActionResult;
  onToastDismiss: (toastId: string) => ActionResult;
  onToastAction: (toastId: string) => ActionResult;

  // Системные
  onReconnect: () => ActionResult;
  onCancelReconnect: () => ActionResult;
  onSendBugReport: (text: string, includeLogs: boolean) => ActionResult;
  onContactSupport: () => ActionResult;
}

/**
 * No-op actions для тестирования и preview.
 * Возвращает каждое действие как `Promise<{ success: true }>` без побочных эффектов.
 *
 * UI должен корректно рендерить с noopActions() для design-canvas и storybook.
 */
export function noopActions(): AppActions {
  const noop = async (): Promise<{ success: true }> => ({ success: true });
  return new Proxy({} as AppActions, {
    get: () => noop,
  });
}
