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
export interface AppActions {
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
    onStartMatchmaking: (mode: string, options?: unknown) => ActionResult;
    onCancelMatchmaking: () => ActionResult;
    onChangeRegion: (region: string) => ActionResult;
    onAcceptMatch: () => ActionResult;
    onDeclineMatch: () => ActionResult;
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
    onMatchPause: () => ActionResult;
    onMatchResume: () => ActionResult;
    onMatchForfeit: () => ActionResult;
    onSelectAnt: (antId: string) => ActionResult;
    onDeselectAnt: () => ActionResult;
    onCameraPan: (delta: {
        x: number;
        y: number;
    }) => ActionResult;
    onCameraZoom: (delta: number, center: {
        x: number;
        y: number;
    }) => ActionResult;
    onCameraReset: () => ActionResult;
    onCameraCenterOn: (target: {
        x: number;
        y: number;
    } | string) => ActionResult;
    onCameraToggleAutoFollow: (enabled: boolean) => ActionResult;
    onSendQuickChat: (emoteId: string) => ActionResult;
    onChangeAntRule: (antId: string, newRuleId: string) => ActionResult;
    onRecallAnt: (antId: string) => ActionResult;
    onDeployFromReserve: (reserveAntId: string, position: {
        x: number;
        y: number;
    }) => ActionResult;
    onDeployStrategy: (reserveAntId: string, strategy: string) => ActionResult;
    onSwapReserveRule: (reserveAntId: string, newRuleId: string) => ActionResult;
    onDiscardReserve: (reserveAntId: string) => ActionResult;
    onCreateCustomRule: (name: string, pattern: string) => ActionResult;
    onRematch: () => ActionResult;
    onCancelRematch: () => ActionResult;
    onNewMatch: () => ActionResult;
    onReturnToMenu: () => ActionResult;
    onOpenReward: () => ActionResult;
    onShareResult: () => ActionResult;
    onWatchReplay: (matchId: string) => ActionResult;
    onDownloadReplay: (matchId: string) => ActionResult;
    onReportPlayer: (playerId: string, reason: string) => ActionResult;
    onOpenLootbox: () => ActionResult;
    onClaimReward: () => ActionResult;
    onEquipReward: (itemId: string) => ActionResult;
    onSkipRewardAnimation: () => ActionResult;
    onTutorialNext: () => ActionResult;
    onTutorialPrev: () => ActionResult;
    onTutorialReplay: () => ActionResult;
    onTutorialSkip: () => ActionResult;
    onTutorialComplete: () => ActionResult;
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
    onSettingsChange: (category: string, key: string, value: unknown) => ActionResult;
    onSettingsReset: (category?: string) => ActionResult;
    onSettingsApply: () => ActionResult;
    onChangeLocale: (locale: string) => ActionResult;
    onChangeHotkey: (action: string, newKey: string) => ActionResult;
    onModalClose: () => ActionResult;
    onModalAction: (actionId: string) => ActionResult;
    onToastDismiss: (toastId: string) => ActionResult;
    onToastAction: (toastId: string) => ActionResult;
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
export declare function noopActions(): AppActions;
//# sourceMappingURL=actions.d.ts.map