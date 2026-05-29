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

/**
 * Stage 8 Day 16 — high-contrast 10-player palette.
 *
 * Каждый hex это pure HSL rotation: H = idx × 36°, S = 90%, L = 60%.
 * 36° spacing гарантирует что любые два соседних цвета perceptually
 * distinct — раньше в палитре было 5+ дубликатов (Crimson≈Magenta,
 * Amber≈Sunflower, Azure≈Sky, Mint≈Teal). Теперь — равномерное круговое
 * распределение по color wheel.
 *
 * L=60% подобран чтобы цвета "поппали" на тёмном bg (#0E0B1F) без
 * выгорания. S=90% — high saturation для clear identity.
 *
 * Shape остаётся как secondary signal на случай color-blind игроков:
 * даже если два цвета сливаются в каком-то типе CVD — shape выручит.
 */
export const PLAYER_PALETTE: ReadonlyArray<PlayerColor> = [
  { id: 0, hex: '#F53D3D', name: 'Crimson',   shape: 'circle' },   //   0°
  { id: 1, hex: '#F5AB3D', name: 'Tangerine', shape: 'triangle' }, //  36°
  { id: 2, hex: '#D0F53D', name: 'Lemon',     shape: 'hexagon' },  //  72°
  { id: 3, hex: '#62F53D', name: 'Lime',      shape: 'diamond' },  // 108°
  { id: 4, hex: '#3DF587', name: 'Mint',      shape: 'star' },     // 144°
  { id: 5, hex: '#3DF5F5', name: 'Cyan',      shape: 'cross' },    // 180°
  { id: 6, hex: '#3D87F5', name: 'Azure',     shape: 'square' },   // 216°
  { id: 7, hex: '#623DF5', name: 'Indigo',    shape: 'pentagon' }, // 252°
  { id: 8, hex: '#D03DF5', name: 'Violet',    shape: 'octagon' },  // 288°
  { id: 9, hex: '#F53DAB', name: 'Magenta',   shape: 'ring' },     // 324°
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
