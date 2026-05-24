// src/core/shared/constants.ts
//
// Глобальные константы. См. /docs/interface-contract.md для подробностей.

export interface PlayerColor {
  id: number;
  hex: string;
  name: string;
  shape: 'circle' | 'triangle' | 'diamond' | 'hexagon' | 'square'
       | 'star' | 'cross' | 'pentagon' | 'octagon' | 'ring';
}

export const PLAYER_PALETTE: ReadonlyArray<PlayerColor> = [
  { id: 0, hex: '#FF5470', name: 'Crimson',   shape: 'circle' },
  { id: 1, hex: '#4DA8FF', name: 'Azure',     shape: 'triangle' },
  { id: 2, hex: '#39D98A', name: 'Mint',      shape: 'diamond' },
  { id: 3, hex: '#FFD60A', name: 'Amber',     shape: 'hexagon' },
  { id: 4, hex: '#C77DFF', name: 'Violet',    shape: 'square' },
  { id: 5, hex: '#FF8A3D', name: 'Tangerine', shape: 'star' },
  { id: 6, hex: '#00E5D1', name: 'Teal',      shape: 'cross' },
  { id: 7, hex: '#FF4D9E', name: 'Magenta',   shape: 'pentagon' },
  { id: 8, hex: '#FFCC00', name: 'Sunflower', shape: 'octagon' },
  { id: 9, hex: '#7DD3FC', name: 'Sky',       shape: 'ring' },
] as const;

export interface RuleMeta {
  id: string;
  label: string;
  pattern: string;
  color: string;
  description: string;
  cost: number;
}

export const RULES_REGISTRY: ReadonlyArray<RuleMeta> = [
  { id: 'classic', label: 'Classic', pattern: 'RL',    color: '#4DA8FF', description: 'Highway after ~10k ticks', cost: 2 },
  { id: 'reverse', label: 'Reverse', pattern: 'LR',    color: '#FF8A3D', description: 'Inverts neighbour state',  cost: 2 },
  { id: 'spiral',  label: 'Spiral',  pattern: 'LRR',   color: '#C77DFF', description: 'Tight expanding spirals',  cost: 2 },
  { id: 'flower',  label: 'Flower',  pattern: 'RLR',   color: '#39D98A', description: 'Symmetric petal pattern',  cost: 3 },
  { id: 'weave',   label: 'Weave',   pattern: 'LRLR',  color: '#FF4D9E', description: 'Woven texture',            cost: 3 },
  { id: 'tornado', label: 'Tornado', pattern: 'LRRLR', color: '#FFD60A', description: 'Chaotic storms',           cost: 4 },
  { id: 'uturn',   label: 'U-turn',  pattern: 'RR',    color: '#7DD3FC', description: 'Patrols small areas',      cost: 1 },
] as const;

export const GAME_LIMITS = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 10,
  MATCH_DURATION_TICKS: 3000,
  DEFAULT_TPS: 10,
  DEFAULT_FIELD_W: 100,
  DEFAULT_FIELD_H: 100,
  ANTS_PER_PLAYER: 5,
  DEFAULT_HP: 3,
  COLLISION_COOLDOWN_TICKS: 5,
} as const;
