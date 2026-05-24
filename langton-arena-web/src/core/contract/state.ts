// src/core/contract/state.ts
//
// Урезанные типы AppState — только то что нужно для web-клиента.
// Полная версия — в /docs/interface-contract.md и backend core.

export type ScreenId =
  | 'menu' | 'matchmaking' | 'lobby' | 'match' | 'result'
  | 'profile' | 'sandbox' | 'settings' | 'credits' | 'changelog';

export type LocaleCode = 'en' | 'ru' | 'uk' | 'de' | 'es' | 'fr' | 'zh' | 'ja' | 'ko' | 'pt';

export interface User {
  id: string;
  username: string;
  colorId: number;
  level: number;
  sr: number;
}

export interface SandboxPlayerConfig {
  color: string;
  antCount: number;
  ruleId: string;
  startHp: number;
  spawnPattern: 'radial' | 'corner' | 'random' | 'cluster' | 'center';
}

export interface SandboxConfig {
  width: number;
  height: number;
  topology: 'torus' | 'bounce' | 'wall' | 'void';
  bgColor: string;

  players: SandboxPlayerConfig[];

  birthEnabled: boolean;
  birthMinNeighbors: number;
  birthCooldownTicks: number;
  maxAntsPerPlayer: number;
  hybridChance: number;
  wildBirthChance: number;

  hpEnabled: boolean;
  collisionCooldownTicks: number;

  baseTps: number;
  speedMultiplier: number;

  showGrid: boolean;
  showGlow: boolean;
  showTrails: boolean;
  showHpDots: boolean;
  antScale: number;

  seed: number;
}

export interface AppState {
  currentScreen: ScreenId;
  user: User;
  locale: LocaleCode;
  themeId: string;
  sandbox: SandboxConfig;
}
