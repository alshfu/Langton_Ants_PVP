// state.jsx — single source of truth, contract-aligned (v1.0).
//
// Shape mirrors langton-arena-interface-contract.md:
//   AppState = {
//     version, buildHash, serverRegion, serverTime, clientTime, pingMs,
//     connection, user, status, locale, currentScreen, previousScreen,
//     menu, matchmaking, lobby, match, result, reward, tutorial,
//     profile, sandbox, settings,
//     toasts, modal,
//   }
//
// All field names, casing and nesting follow the contract.
// Default values mirror Storybook "full" states.
// Legacy top-level fields (matchHistory, matchDetail, meta, leaderboard) kept
// as aliases pointing into the new nested shape so existing screens still render.

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — palettes, rules, ranks, themes
// ─────────────────────────────────────────────────────────────────────────────

// 10-color palette per contract §2.1
const PLAYER_PALETTE = [
  { id: 0, name: 'Crimson',   hex: '#FF5470', shape: 'circle'   },
  { id: 1, name: 'Azure',     hex: '#4DA8FF', shape: 'triangle' },
  { id: 2, name: 'Mint',      hex: '#39D98A', shape: 'diamond'  },
  { id: 3, name: 'Amber',     hex: '#FFD60A', shape: 'hexagon'  },
  { id: 4, name: 'Violet',    hex: '#C77DFF', shape: 'square'   },
  { id: 5, name: 'Tangerine', hex: '#FF8A3D', shape: 'star'     },
  { id: 6, name: 'Teal',      hex: '#00E5D1', shape: 'cross'    },
  { id: 7, name: 'Magenta',   hex: '#FF4D9E', shape: 'pentagon' },
  { id: 8, name: 'Sunflower', hex: '#FFCC00', shape: 'octagon'  },
  { id: 9, name: 'Sky',       hex: '#7DD3FC', shape: 'ring'     },
];

// Rule registry per contract §2.2
const RULES_REGISTRY = [
  { id: 'classic', label: 'Classic', pattern: 'RL',       color: '#4DA8FF', description: 'Highway after ~10k ticks',     unlocked: true,  cost: 2 },
  { id: 'reverse', label: 'Reverse', pattern: 'LR',       color: '#FF8A3D', description: 'Inverts neighbour state',       unlocked: true,  cost: 2 },
  { id: 'spiral',  label: 'Spiral',  pattern: 'LRR',      color: '#C77DFF', description: 'Tight expanding spirals',       unlocked: true,  cost: 2 },
  { id: 'flower',  label: 'Flower',  pattern: 'RLR',      color: '#39D98A', description: 'Symmetric petal pattern',       unlocked: true,  cost: 3 },
  { id: 'mirror',  label: 'Mirror',  pattern: 'adaptive', color: '#00E5D1', description: 'Right on own, left on enemy',   unlocked: true,  cost: 4 },
  { id: 'jumper',  label: 'Jumper',  pattern: 'special',  color: '#FFCC00', description: 'Teleports 5 cells every 10t',   unlocked: false, cost: 4, unlockHint: 'Capture 15% territory' },
  { id: 'uturn',   label: 'U-turn',  pattern: 'RR',       color: '#FF4D9E', description: 'Patrols small areas',           unlocked: true,  cost: 1 },
  { id: 'random',  label: 'Random',  pattern: 'dynamic',  color: '#7DD3FC', description: 'Picks L/R randomly',            unlocked: true,  cost: 1 },
];

const RULES_BY_ID = Object.fromEntries(RULES_REGISTRY.map((r) => [r.id, r]));

// Rank tiers per contract §4.1
const RANK_TIERS = [
  { id: 'bronze',      division: 'IV',  label: 'Bronze IV',      color: '#A57148', minSr: 0,    maxSr: 100  },
  { id: 'bronze',      division: 'III', label: 'Bronze III',     color: '#A57148', minSr: 100,  maxSr: 200  },
  { id: 'bronze',      division: 'II',  label: 'Bronze II',      color: '#A57148', minSr: 200,  maxSr: 300  },
  { id: 'bronze',      division: 'I',   label: 'Bronze I',       color: '#A57148', minSr: 300,  maxSr: 400  },
  { id: 'silver',      division: 'IV',  label: 'Silver IV',      color: '#B0B0B8', minSr: 400,  maxSr: 500  },
  { id: 'silver',      division: 'III', label: 'Silver III',     color: '#B0B0B8', minSr: 500,  maxSr: 600  },
  { id: 'silver',      division: 'II',  label: 'Silver II',      color: '#B0B0B8', minSr: 600,  maxSr: 700  },
  { id: 'silver',      division: 'I',   label: 'Silver I',       color: '#B0B0B8', minSr: 700,  maxSr: 800  },
  { id: 'gold',        division: 'IV',  label: 'Gold IV',        color: '#FFD60A', minSr: 800,  maxSr: 950  },
  { id: 'gold',        division: 'III', label: 'Gold III',       color: '#FFD60A', minSr: 950,  maxSr: 1100 },
  { id: 'gold',        division: 'II',  label: 'Gold II',        color: '#FFD60A', minSr: 1100, maxSr: 1250 },
  { id: 'gold',        division: 'I',   label: 'Gold I',         color: '#FFD60A', minSr: 1250, maxSr: 1400 },
  { id: 'platinum',    division: 'IV',  label: 'Platinum IV',    color: '#00E5D1', minSr: 1400, maxSr: 1550 },
  { id: 'platinum',    division: 'III', label: 'Platinum III',   color: '#00E5D1', minSr: 1550, maxSr: 1700 },
  { id: 'platinum',    division: 'II',  label: 'Platinum II',    color: '#00E5D1', minSr: 1700, maxSr: 1850 },
  { id: 'platinum',    division: 'I',   label: 'Platinum I',     color: '#00E5D1', minSr: 1850, maxSr: 2000 },
  { id: 'diamond',     division: 'IV',  label: 'Diamond IV',     color: '#4DA8FF', minSr: 2000, maxSr: 2200 },
  { id: 'diamond',     division: 'III', label: 'Diamond III',    color: '#4DA8FF', minSr: 2200, maxSr: 2400 },
  { id: 'diamond',     division: 'II',  label: 'Diamond II',     color: '#4DA8FF', minSr: 2400, maxSr: 2600 },
  { id: 'diamond',     division: 'I',   label: 'Diamond I',      color: '#4DA8FF', minSr: 2600, maxSr: 2800 },
  { id: 'master',      division: null,  label: 'Master',         color: '#C77DFF', minSr: 2800, maxSr: 3400 },
  { id: 'grandmaster', division: null,  label: 'Grandmaster',    color: '#FF5470', minSr: 3400, maxSr: 4000 },
];

function rankFromSr(sr) {
  for (const t of RANK_TIERS) if (sr >= t.minSr && sr < t.maxSr) return { ...t, iconUrl: `rank/${t.id}.svg` };
  return { ...RANK_TIERS[RANK_TIERS.length - 1], iconUrl: `rank/grandmaster.svg` };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS for synthetic data
// ─────────────────────────────────────────────────────────────────────────────

function makeHeatMap(seed = 1, hotspots = [[0.5, 0.5, 0.9]]) {
  const w = 32, h = 32;
  const data = new Float32Array(w * h);
  let s = seed;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = rand() * 0.15;
    for (const [hx, hy, hv] of hotspots) {
      const dx = (x / w) - hx, dy = (y / h) - hy;
      const d = Math.sqrt(dx * dx + dy * dy);
      v += hv * Math.exp(-d * d * 18);
    }
    data[y * w + x] = Math.min(1, v);
  }
  return { width: w, height: h, data: Array.from(data), totalSamples: 487, generatedAt: Date.now() };
}

function makeSeries(n, start, drift, noise = 0.2, seed = 7) {
  let s = seed; const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const arr = []; let v = start;
  for (let i = 0; i < n; i++) { v += drift + (rand() - 0.5) * noise * Math.abs(start) * 0.05; arr.push(v); }
  return arr;
}

// ─────────────────────────────────────────────────────────────────────────────
// USER (§4.1)
// ─────────────────────────────────────────────────────────────────────────────
function defaultUser() {
  const sr = 2247;
  const rank = rankFromSr(sr);
  return {
    id: 'usr_a8b3c91f',
    username: 'BraveSpiral42',
    usernameChangedAt: null,
    email: 'brave@example.com',

    colorId: 0, shapeId: 0,
    avatarFrameId: 'gold_s2', trailEffectId: 'sparkle',

    level: 28, xp: 4280, xpForNextLevel: 6000, totalXp: 142_400,

    sr, rank, peakSr: 2410, peakRank: rankFromSr(2410),
    matchesPlayed: 487, wins: 234, winRate: 0.481,

    currentStreak: 5, bestStreak: 11,

    unlockedItems: ['avatar_gold_s2', 'trail_sparkle', 'cell_neon', 'emote_gg'],
    equippedItems: { avatarFrame: 'gold_s2', trail: 'sparkle', cellSkin: 'default' },

    achievements: [
      { id: 'first-blood', unlocked: true,  progress: 1,   target: 1,    unlockedAt: 1710240000000, hidden: false },
      { id: 'painter',     unlocked: true,  progress: 1,   target: 1,    unlockedAt: 1710500000000, hidden: false },
      { id: 'dominator',   unlocked: false, progress: 67,  target: 75,   unlockedAt: null,          hidden: false },
      { id: 'streak-10',   unlocked: false, progress: 5,   target: 10,   unlockedAt: null,          hidden: false },
      { id: 'veteran',     unlocked: false, progress: 487, target: 1000, unlockedAt: null,          hidden: false },
    ],

    createdAt: 1700000000000, lastLoginAt: Date.now() - 3600_000,
    isPremium: true, premiumUntil: Date.now() + 30 * 86400_000, isGuest: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE STATUS (§4.2)
// ─────────────────────────────────────────────────────────────────────────────
function defaultServiceStatus() {
  return {
    online: 3412, activeMatches: 218,
    inQueueByMode: { arena: 1234, arena_ranked: 412, arena_team: 88 },
    seasonId: 'season_02', seasonName: 'Spiral Season',
    seasonEndsAt: Date.now() + 18 * 86400_000, daysRemaining: 18,
    serverHealth: 'healthy', announcement: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTION (§3.1)
// ─────────────────────────────────────────────────────────────────────────────
function defaultConnection() {
  return {
    status: 'connected', attemptsRemaining: 0, lastError: null,
    serverUrl: 'wss://eu.langton-arena.com', protocol: 'wss',
    latencyMs: 32, jitterMs: 4,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCALE (§3.3)
// ─────────────────────────────────────────────────────────────────────────────
function defaultLocale() {
  return { current: 'en', available: ['en', 'ru', 'uk', 'de', 'es', 'fr', 'zh', 'ja', 'ko', 'pt'], fallback: 'en' };
}

// ─────────────────────────────────────────────────────────────────────────────
// MENU (§4.3)
// ─────────────────────────────────────────────────────────────────────────────
function defaultMenu() {
  return {
    backgroundRule: 'spiral', backgroundTps: 18,
    showNews: true,
    newsItems: [
      { id: 'n1', type: 'patch',     title: 'Patch v0.6 · stats & meta',  body: 'Profile graphs, match details, meta dashboard.', imageUrl: '', ctaLabel: 'View',    ctaUrl: 'changelog.html', publishedAt: Date.now() - 86400_000 },
      { id: 'n2', type: 'season',    title: 'Spiral Season ends in 18d', body: 'Climb to Diamond for an exclusive ant skin.',    imageUrl: '', ctaLabel: 'Details', ctaUrl: null,             publishedAt: Date.now() - 5 * 86400_000 },
      { id: 'n3', type: 'community', title: 'Tournament: Spiral Cup',    body: 'Sign-ups open. 5,000 SR prize pool.',            imageUrl: '', ctaLabel: 'Sign up', ctaUrl: null,             publishedAt: Date.now() - 10 * 86400_000 },
    ],
    dailyReward: { day: 4, rewardType: 'xp', rewardValue: 250, available: true, expiresAt: Date.now() + 9 * 3600_000 },
    primaryCtaText: 'Play',
    primaryCtaAction: 'play',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCHMAKING (§4.4)
// ─────────────────────────────────────────────────────────────────────────────
function defaultMatchmaking() {
  const slot = (i, level, sr, colorId, isYou = false) => ({
    index: i, state: 'filled',
    player: {
      playerId: `p${i}`, username: ['BraveSpiral42', 'RuneMaster', 'PixelKnight', 'CrystalFox', 'NeonOrbit'][i] || `Bot${i}`,
      level, sr, rank: rankFromSr(sr), colorId, shapeId: colorId, isYou, isPremium: false,
    },
  });
  return {
    inQueue: true, queueStartedAt: Date.now() - 24_000,
    elapsedMs: 24_000, estimatedWaitMs: 36_000,
    mode: 'arena_ranked', modeLabel: 'Arena · Ranked · 5 min',
    targetPlayers: 8, foundPlayers: 5,
    slots: [
      slot(0, 28, 2247, 0, true),
      slot(1, 12, 1380, 1),
      slot(2, 5,  980,  2),
      slot(3, 15, 1601, 3),
      slot(4, 9,  1290, 4),
      { index: 5, state: 'filling', player: null },
      { index: 6, state: 'empty',   player: null },
      { index: 7, state: 'empty',   player: null },
    ],
    region: 'eu-west', regionLabel: 'Europe · West',
    alternativeRegions: [
      { region: 'us-east', label: 'US · East', pingMs: 112 },
      { region: 'asia',    label: 'Asia',      pingMs: 218 },
    ],
    status: 'searching', errorMessage: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LOBBY (§4.5)
// ─────────────────────────────────────────────────────────────────────────────
function defaultLobby() {
  const player = (i, name, level, sr, colorId, ready = false, isYou = false) => ({
    playerId: `p${i}`, username: name, level, sr, rank: rankFromSr(sr),
    colorId, shapeId: colorId, ready, isYou, isPremium: false, pingMs: 30 + i * 8, isHost: i === 0,
  });
  const squadAnt = (i, ruleId) => {
    const r = RULES_BY_ID[ruleId];
    return { index: i, ruleId, ruleLabel: r.label, ruleColor: r.color, rulePattern: r.pattern, startHp: 3, cost: r.cost };
  };
  return {
    matchId: 'M-AX72-LV5',
    countdownTicks: 420, countdownLabel: '0:42',
    modeLabel: 'Arena · 8 players · ranked',
    mode: 'arena_ranked',
    fieldWidth: 100, fieldHeight: 100, matchDurationTicks: 3000,

    players: [
      player(0, 'BraveSpiral42', 28, 2247, 0, true,  true),
      player(1, 'RuneMaster',    12, 1380, 1, true),
      player(2, 'PixelKnight',    5,  980, 2, false),
      player(3, 'CrystalFox',    15, 1601, 3, true),
      player(4, 'NeonOrbit',      9, 1290, 4, false),
      player(5, 'GlitchByte',    11, 1410, 5, false),
      player(6, 'VoidPilgrim',   18, 1820, 6, false),
      player(7, 'EmberDrift',     7, 1080, 7, false),
    ],

    squad: [
      squadAnt(0, 'classic'),
      squadAnt(1, 'spiral'),
      squadAnt(2, 'classic'),
      squadAnt(3, 'reverse'),
      squadAnt(4, 'spiral'),
    ],
    squadBudget: 12, squadBudgetSpent: 10, squadValid: true,
    availableRules: RULES_REGISTRY,

    previewEnabled: true, previewFieldWidth: 20, previewFieldHeight: 20, previewTps: 18, previewSeed: 42,
    showPreview: true,

    chatEnabled: true,
    chatMessages: [
      { id: 'c1', playerId: 'p1', username: 'RuneMaster', colorId: 1, text: 'gl hf',          type: 'normal',    sentAt: Date.now() - 30_000 },
      { id: 'c2', playerId: 'p3', username: 'CrystalFox', colorId: 3, text: 'spiral squad?',  type: 'normal',    sentAt: Date.now() - 22_000 },
      { id: 'c0', playerId: 'sys', username: 'system',    colorId: 0, text: 'Match starts in 0:42', type: 'system', sentAt: Date.now() - 14_000 },
      { id: 'c3', playerId: 'p0', username: 'BraveSpiral42', colorId: 0, text: 'going classic + spiral mix',     type: 'normal', sentAt: Date.now() - 9_000 },
    ],

    yourReady: true, allReady: false, canStart: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCH (§4.6)
// ─────────────────────────────────────────────────────────────────────────────
function defaultMatch() {
  const W = 60, H = 40;
  const ownerGrid = new Uint8Array(W * H);
  const stateGrid = new Uint8Array(W * H);
  // Sprinkle some ownership for demo
  for (let i = 0; i < ownerGrid.length; i++) {
    const r = (i * 9301 + 49297) % 233280 / 233280;
    if (r > 0.6) ownerGrid[i] = Math.floor(r * 8) % 4;
    stateGrid[i] = r > 0.55 ? 1 : 0;
  }

  const mkPlayer = (i, name, level, sr, colorId, cellsPct, isYou = false) => {
    const cells = Math.round(cellsPct * W * H);
    return {
      playerId: `p${i}`, username: name, level, sr, rank: rankFromSr(sr),
      colorId, shapeId: colorId, hex: PLAYER_PALETTE[colorId].hex,
      isYou, isPremium: false, isHost: i === 0, pingMs: 30 + i * 9,
      cellsCount: cells, cellsPercent: cellsPct, cellsPercentChange: 0.014, trend: 'up',
      antsAlive: 5 - Math.floor(i * 0.3), antsMax: 5, antsBorn: 0, antsLost: i,
      antsInReserve: 0, reserveSlots: 3, avgHp: 2.4 - i * 0.2,
      kills: 3 - i, deaths: i, damageDealt: 14, damageTaken: 8,
      bestCombo: 28 - i * 4, comboMultiplier: i === 0 ? 1.5 : 1,
      isLeader: i === 0, leaderSince: i === 0 ? 1340 : null, totalLeaderTicks: i === 0 ? 920 : 0,
      status: 'active', disconnectedSinceTick: null, charges: 2, maxCharges: 3,
    };
  };

  const players = [
    mkPlayer(0, 'BraveSpiral42', 28, 2247, 0, 0.453, true),
    mkPlayer(1, 'RuneMaster',    12, 1380, 1, 0.321),
    mkPlayer(2, 'PixelKnight',    5, 980,  2, 0.158),
    mkPlayer(3, 'CrystalFox',    15, 1601, 3, 0.068),
  ];

  const mkAnt = (i, playerIndex, ruleId, hp, x, y, dir) => {
    const r = RULES_BY_ID[ruleId];
    return {
      id: `ant_p${playerIndex}_${i}`, playerId: `p${playerIndex}`, ownerIndex: playerIndex,
      position: { x, y }, direction: dir,
      ruleId, rulePattern: r.pattern,
      hp, maxHp: 3, hpRatio: hp / 3,
      isWild: false, isHybrid: false, isEvolved: false, generation: 0, parentIds: null,
      alive: hp > 0, bornAtTick: 0, diedAtTick: hp <= 0 ? 1100 : null,
      lastDamageTick: hp < 3 ? 1200 : -9999, lastBirthTick: -9999, immunityUntilTick: -9999, ticksAlive: 1247,
      previousPosition: { x, y }, previousDirection: dir,
      displayColor: PLAYER_PALETTE[playerIndex].hex, displayShape: PLAYER_PALETTE[playerIndex].shape,
      hasGoldGlow: false, trailEffectId: 'default',
    };
  };

  const ants = [
    mkAnt(0, 0, 'classic', 3, 28, 18, 1),
    mkAnt(1, 0, 'spiral',  3, 22, 22, 0),
    mkAnt(2, 0, 'classic', 2, 32, 16, 2),
    mkAnt(3, 0, 'reverse', 1, 18, 26, 3),
    mkAnt(4, 0, 'spiral',  3, 36, 22, 1),
    mkAnt(0, 1, 'classic', 3, 12, 12, 0),
    mkAnt(1, 1, 'spiral',  2, 14, 28, 2),
    mkAnt(0, 2, 'flower',  3, 48, 30, 1),
    mkAnt(0, 3, 'reverse', 2, 52, 8,  3),
  ];

  const yourAnts = ants
    .filter((a) => a.playerId === 'p0')
    .map((a, i) => ({
      antId: a.id, index: i,
      ruleLabel: RULES_BY_ID[a.ruleId].label, ruleColor: RULES_BY_ID[a.ruleId].color, rulePattern: a.rulePattern,
      hp: a.hp, maxHp: 3, hpRatio: a.hpRatio, isCritical: a.hp <= 1, isDead: !a.alive,
      position: a.position, ticksAlive: a.ticksAlive, cellsClaimed: 230 + i * 20,
    }));

  const events = [
    { id: 'e1', tick: 1240, type: 'capture',  primaryPlayerId: 'p0', secondaryPlayerId: null, position: { x: 30, y: 20 }, payload: { cells: 14 }, displayText: 'BraveSpiral42 captured 14 cells', icon: '✦', iconColor: '#FFD60A', playSound: true,  showOverlay: false },
    { id: 'e2', tick: 1232, type: 'clash',    primaryPlayerId: 'p1', secondaryPlayerId: 'p0', position: { x: 24, y: 22 }, payload: { damage: 1 }, displayText: 'Clash · RuneMaster vs you',       icon: '⚡', iconColor: '#FF453A', playSound: true,  showOverlay: true  },
    { id: 'e3', tick: 1220, type: 'lead_change', primaryPlayerId: 'p0', secondaryPlayerId: 'p1', position: null,          payload: {},            displayText: 'BraveSpiral42 took the lead',   icon: '🏆', iconColor: '#FFD60A', playSound: true,  showOverlay: true  },
    { id: 'e4', tick: 1180, type: 'damage',   primaryPlayerId: 'p0', secondaryPlayerId: null, position: { x: 18, y: 26 }, payload: { damage: 1 }, displayText: 'Your ant A4 took −1 HP',       icon: '⚠',  iconColor: '#FF8A3D', playSound: false, showOverlay: false },
    { id: 'e5', tick: 1140, type: 'capture',  primaryPlayerId: 'p2', secondaryPlayerId: null, position: { x: 48, y: 30 }, payload: { cells: 7 }, displayText: 'PixelKnight captured 7 cells',  icon: '✦',  iconColor: '#39D98A', playSound: false, showOverlay: false },
    { id: 'e6', tick: 1080, type: 'death',    primaryPlayerId: 'p3', secondaryPlayerId: null, position: { x: 52, y: 12 }, payload: { antId: 'ant_p3_4' }, displayText: 'CrystalFox lost an ant', icon: '☠', iconColor: '#5A5870', playSound: true, showOverlay: false },
  ];

  const leaderboard = players
    .slice().sort((a, b) => b.cellsPercent - a.cellsPercent)
    .map((p, i) => ({ rank: i + 1, player: p, isYou: p.isYou, isLeader: i === 0, positionChangeFromLastTick: 0, highlighted: false }));

  return {
    matchId: 'M-AX72-LV5', mode: 'arena_ranked', startedAt: Date.now() - 263_000,
    serverTick: 1247, clientTick: 1247, isReplay: false,
    tps: 10, elapsedTicks: 1247, remainingTicks: 1753, totalDurationTicks: 3000,
    timerLabel: '2:55', isOvertime: false,

    field: {
      width: W, height: H, topology: 'torus',
      ownerGrid: Array.from(ownerGrid), stateGrid: Array.from(stateGrid),
      lastDeltaTick: 1247, totalCells: W * H, capturedCells: 1860, neutralCells: 540,
    },
    ants,
    players,
    leaderboard,

    you: {
      player: players[0],
      yourAnts,
      selectedAntId: null,
      cameraTarget: null,
      notifications: [
        { type: 'low_hp', message: 'Ant A4 critical · 1 HP', ticksRemaining: 40, severity: 'warning' },
      ],
    },

    recentEvents: events,
    currentCombo: { count: 3, label: 'WAVE', level: 2, multiplier: 1.5, expiresAtTick: 1290, pulseAnimationKey: 7 },

    phase: 'running', finishedReason: null, winnerId: null, pauseReason: null,
    cameraSuggestion: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT (§4.7)
// ─────────────────────────────────────────────────────────────────────────────
function defaultResult() {
  const players = defaultMatch().players;
  return {
    matchId: 'M-AX72-LV5', finishedAt: Date.now(), durationLabel: '5:00', durationTicks: 3000,
    mode: 'arena_ranked',

    outcome: 'victory', yourPlace: 1, totalPlayers: 4,

    xpGained: 124, xpFromWin: 50, xpFromKills: 24, xpFromTerritory: 36, xpFromAchievements: 14,

    srBefore: 2235, srAfter: 2247, srDelta: 12,
    rankBefore: rankFromSr(2235), rankAfter: rankFromSr(2247),
    rankChanged: false, rankPromoted: false, rankDemoted: false,

    achievementsUnlocked: [
      { id: 'comeback-king', name: 'Comeback', description: 'Win after being last', iconUrl: '', rarity: 'rare', xpReward: 50 },
    ],

    rows: players.map((p, i) => ({
      rank: i + 1, player: p,
      cellsPercent: p.cellsPercent, cellsCount: p.cellsCount,
      kills: p.kills, deaths: p.deaths,
      srDelta: [12, 5, -2, -8][i] || 0, xpGained: [124, 78, 42, 24][i] || 0,
      peakDescription: i === 0 ? 'led 2:14→5:00' : i === 1 ? 'led 0:00→2:14' : 'never led',
      isYou: p.isYou, isMvp: i === 0,
      achievements: i === 0 ? ['comeback-king'] : [],
    })),

    yourStats: [
      { id: 'terr',     label: 'Territory',      value: '45.3%', rawValue: 0.453, delta: 'leader',                trend: 'up',     accent: true,  icon: '◇' },
      { id: 'cells',    label: 'Cells captured', value: '1,812', rawValue: 1812,  delta: '+57 in last 30s',       trend: 'up',     accent: false, icon: '✦' },
      { id: 'clashes',  label: 'Clashes won',    value: '3',     rawValue: 3,     delta: 'vs 1·0·0',              trend: 'stable', accent: false, icon: '⚡' },
      { id: 'comeback', label: 'Comebacks',      value: '1',     rawValue: 1,     delta: 'came back from 4th',    trend: 'up',     accent: true,  icon: '↑' },
    ],

    charts: [
      { id: 'terr_over_time', type: 'area', title: 'Territory over time', xLabel: 'tick', yLabel: '%',
        series: players.map((p) => ({
          name: p.username, color: p.hex,
          points: makeSeries(60, 0.05, p.isYou ? 0.008 : 0.004, 0.3, p.colorId).map((y, x) => ({ x, y: Math.max(0, y) })),
        })),
      },
    ],

    rematchEnabled: true,
    rematchReady: { p0: true, p1: true, p2: true, p3: false },
    rematchCountdownTicks: 80,

    reward: {
      type: 'lootbox', rarity: 'epic',
      preview: {
        name: 'Violet Pulse',
        description: 'aura pulses on each tick · particles trail behind movement',
        iconUrl: '', primaryColor: '#C77DFF', secondaryColor: '#4DA8FF',
      },
      opened: false,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// REWARD (§4.8)
// ─────────────────────────────────────────────────────────────────────────────
function defaultReward() {
  return {
    reward: {
      type: 'lootbox', rarity: 'epic',
      preview: { name: 'Violet Pulse', description: 'aura pulses on each tick · particles trail behind movement', iconUrl: '', primaryColor: '#C77DFF', secondaryColor: '#4DA8FF' },
      opened: false,
    },
    opening: false, opened: false,
    openedContents: [
      { id: 'cosm_violet_pulse', category: 'ant_skin', name: 'Violet Pulse', description: 'aura pulses on each tick',
        rarity: 'epic', iconUrl: '', previewAnimationUrl: '', primaryColor: '#C77DFF', secondaryColor: '#4DA8FF' },
    ],
    alreadyOwned: false, duplicateCompensation: 0,
    serialNumber: '#0247 / 5000', shareEnabled: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TUTORIAL (§4.9)
// ─────────────────────────────────────────────────────────────────────────────
function defaultTutorial() {
  return {
    currentStep: 2, totalSteps: 6,
    eyebrowText: 'step 02 — collision',
    title: "Don't crash into enemies.",
    body: 'Each ant has 3 HP. When two ants meet on the same cell — both lose 1 HP. Reach 0 and the ant is gone. Protect your colony, but don\'t be afraid to clash strategically.',
    hint: { title: 'Watch the next encounter', subtitle: 'they meet in ~6 ticks', iconType: 'time' },
    sceneActive: true,
    sceneConfig: {
      fieldWidth: 24, fieldHeight: 16,
      yourAnts: [{ index: 0, ruleId: 'classic', ruleLabel: 'Classic', ruleColor: '#FF5470', rulePattern: 'RL', startHp: 3, cost: 2 }],
      botAnts: [{ index: 0, ruleId: 'classic', ruleLabel: 'Classic', ruleColor: '#4DA8FF', rulePattern: 'RL', startHp: 3, cost: 2 }],
      rulesetOverride: { hpEnabled: true, birthEnabled: false, tps: 12 },
      targetCondition: { type: 'survive_ticks', value: 200 },
    },
    sceneCompleted: false,
    canSkip: true, canReplay: true, canNext: true, nextAutomatic: false, conditionMet: false,
    completionReward: null, showCompletionScreen: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE (§4.10)
// ─────────────────────────────────────────────────────────────────────────────
function defaultProfile() {
  return {
    viewedPlayerId: 'usr_a8b3c91f', isOwnProfile: true,
    player: { ...defaultUser(), isOnline: true, currentActivity: 'menu', lastSeenAt: Date.now() },
    activeTab: 'overview',
    overview: {
      recentForm: ['W','W','L','W','W','L','L','W','D','W'],
      topRules: [
        { ruleId: 'spiral',  ruleLabel: 'Spiral',  matches: 692,  winRate: 0.524, avgTerritory: 0.092, survivalRate: 0.73 },
        { ruleId: 'classic', ruleLabel: 'Classic', matches: 1843, winRate: 0.512, avgTerritory: 0.084, survivalRate: 0.67 },
        { ruleId: 'flower',  ruleLabel: 'Flower',  matches: 412,  winRate: 0.501, avgTerritory: 0.077, survivalRate: 0.62 },
        { ruleId: 'reverse', ruleLabel: 'Reverse', matches: 891,  winRate: 0.478, avgTerritory: 0.071, survivalRate: 0.58 },
      ],
      playStyle: 'aggressor', playStyleConfidence: 0.78,
      bestRank: rankFromSr(2410), totalPlayTimeMs: 142 * 3600_000,
    },
    matchHistory: { items: defaultMatchHistoryItems(), hasMore: true, loading: false, error: null },
    stats: defaultProfileStats(),
    achievements: defaultUser().achievements.map((a) => ({ ...a })).concat([
      { id: 'streak-10',  unlocked: false, progress: 5,   target: 10,   unlockedAt: null, hidden: false },
      { id: 'spiral-mst', unlocked: false, progress: 692, target: 1000, unlockedAt: null, hidden: false },
      { id: 'comeback',   unlocked: false, progress: 1,   target: 5,    unlockedAt: null, hidden: false },
      { id: 'untouchable',unlocked: true,  progress: 1,   target: 1,    unlockedAt: 1712000000000, hidden: false },
    ]),
    heatmaps: [
      { id: 'deaths',    title: 'Where you die',     description: 'Hotspots of fallen ants',  ...makeHeatMap(3,  [[0.2, 0.3, 0.7], [0.7, 0.6, 0.5]]) },
      { id: 'kills',     title: 'Where you kill',    description: 'Successful clash zones',   ...makeHeatMap(7,  [[0.5, 0.5, 0.8]]) },
      { id: 'activity',  title: 'Your activity',     description: 'Time-weighted presence',   ...makeHeatMap(11, [[0.3, 0.4, 0.9]]) },
      { id: 'leadership',title: 'Leadership zones',  description: 'Cells held while leading', ...makeHeatMap(23, [[0.5, 0.5, 0.7], [0.25, 0.75, 0.4]]) },
    ],
    social: { isFriend: false, friendRequestSent: false, canMessage: true, canBlock: true, blocked: false },
  };
}

function defaultMatchHistoryItems() {
  return [
    { matchId: 'M-A47BC', playedAt: Date.now() - 23 * 60_000,       durationLabel: '4:53', mode: 'arena_ranked', playerCount: 8,  outcome: 'victory', place: 1, totalPlayers: 8,  cellsPercent: 0.473, kills: 4, deaths: 0, srDelta: 18,  comboMax: 28, hasReplay: true,  isHighlight: true  },
    { matchId: 'M-B12FF', playedAt: Date.now() - 3600_000,          durationLabel: '5:00', mode: 'arena',        playerCount: 4,  outcome: 'defeat',  place: 3, totalPlayers: 4,  cellsPercent: 0.187, kills: 1, deaths: 3, srDelta: -12, comboMax: 8,  hasReplay: true,  isHighlight: false },
    { matchId: 'M-C9921', playedAt: Date.now() - 7200_000,          durationLabel: '3:42', mode: 'arena_ranked', playerCount: 4,  outcome: 'victory', place: 1, totalPlayers: 4,  cellsPercent: 0.512, kills: 3, deaths: 1, srDelta: 14,  comboMax: 19, hasReplay: true,  isHighlight: false },
    { matchId: 'M-D5512', playedAt: Date.now() - 26 * 3600_000,     durationLabel: '4:14', mode: 'arena_ranked', playerCount: 8,  outcome: 'victory', place: 1, totalPlayers: 8,  cellsPercent: 0.398, kills: 5, deaths: 2, srDelta: 22,  comboMax: 41, hasReplay: true,  isHighlight: true  },
    { matchId: 'M-E0042', playedAt: Date.now() - 30 * 3600_000,     durationLabel: '5:00', mode: 'arena_ranked', playerCount: 8,  outcome: 'defeat',  place: 6, totalPlayers: 8,  cellsPercent: 0.142, kills: 2, deaths: 4, srDelta: -15, comboMax: 11, hasReplay: true,  isHighlight: false },
    { matchId: 'M-F7711', playedAt: Date.now() - 2 * 86400_000,     durationLabel: '2:55', mode: 'arena',        playerCount: 2,  outcome: 'victory', place: 1, totalPlayers: 2,  cellsPercent: 0.621, kills: 6, deaths: 0, srDelta: 9,   comboMax: 33, hasReplay: true,  isHighlight: false },
    { matchId: 'M-G0098', playedAt: Date.now() - 3 * 86400_000,     durationLabel: '5:00', mode: 'arena_ranked', playerCount: 10, outcome: 'placed',  place: 4, totalPlayers: 10, cellsPercent: 0.181, kills: 2, deaths: 3, srDelta: 2,   comboMax: 17, hasReplay: true,  isHighlight: false },
    { matchId: 'M-H1422', playedAt: Date.now() - 3 * 86400_000 - 1000, durationLabel: '5:00', mode: 'arena',        playerCount: 4,  outcome: 'defeat',  place: 4, totalPlayers: 4,  cellsPercent: 0.122, kills: 0, deaths: 4, srDelta: -9,  comboMax: 5,  hasReplay: true,  isHighlight: false },
  ];
}

function defaultProfileStats() {
  return {
    byTimeOfDay: [
      { hour: 6,  winRate: 0.52, matches: 67 },
      { hour: 12, winRate: 0.49, matches: 145 },
      { hour: 18, winRate: 0.54, matches: 234 },
      { hour: 0,  winRate: 0.41, matches: 41 },
    ],
    byDayOfWeek: [0,1,2,3,4,5,6].map((d) => ({ day: d, winRate: 0.45 + Math.random() * 0.1, matches: 40 + d * 8 })),
    byPlatform: [
      { platform: 'web',     matches: 312, winRate: 0.49 },
      { platform: 'desktop', matches: 142, winRate: 0.47 },
      { platform: 'mobile',  matches: 33,  winRate: 0.42 },
    ],
    srOverTime: makeSeries(30, 1900, 10, 0.3, 11).map((sr, i) => ({ timestamp: Date.now() - (29 - i) * 86400_000, sr })),
    winRateOverTime: makeSeries(12, 0.45, 0.005, 0.05, 17).map((winRate, i) => ({ week: `W${i + 1}`, winRate })),
    benchmark: { yourWinRate: 0.481, averageWinRate: 0.480, top10WinRate: 0.640, rank: 'average' },
    averageAccuracy: 0.74, averageApm: 64,
    totalCellsClaimed: 824_103, totalAntsBorn: 1024, totalAntsKilled: 287, longestStreak: 11,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SANDBOX (§4.11)
// ─────────────────────────────────────────────────────────────────────────────
function defaultSandbox() {
  return {
    config: {
      width: 80, height: 60, topology: 'torus', bgColor: '#0A081A',
      players: [
        { color: '#FF5470', antCount: 4, ruleId: 'classic', startHp: 3, spawnPattern: 'radial' },
        { color: '#4DA8FF', antCount: 4, ruleId: 'spiral',  startHp: 3, spawnPattern: 'radial' },
        { color: '#39D98A', antCount: 4, ruleId: 'reverse', startHp: 3, spawnPattern: 'radial' },
        { color: '#FFD60A', antCount: 4, ruleId: 'flower',  startHp: 3, spawnPattern: 'radial' },
      ],
      birthEnabled: true, birthMinNeighbors: 3, birthCooldownTicks: 50, maxAntsPerPlayer: 12,
      hybridChance: 0.08, wildBirthChance: 0.02,
      hpEnabled: true, collisionCooldownTicks: 5, cellsSurviveDeath: true,
      heatmapMode: 'none', heatmapIntensity: 1.0, heatmapOpacity: 0.7, heatmapDecay: true,
      baseTps: 18, speedMultiplier: 1, matchDurationTicks: null,
      showGrid: false, showGlow: true, showTrails: false, showHpDots: true, antScale: 0.85,
      seed: 42,
    },
    simulation: {
      tick: 1247, effectiveTps: 18,
      totalAnts: 16, wildCount: 0,
      stats: [
        { playerIndex: 0, color: '#FF5470', ruleId: 'classic', cellsCount: 1812, cellsPercent: 0.453, antsAlive: 4, avgHp: 2.8, isEliminated: false },
        { playerIndex: 1, color: '#4DA8FF', ruleId: 'spiral',  cellsCount: 1284, cellsPercent: 0.321, antsAlive: 4, avgHp: 2.5, isEliminated: false },
        { playerIndex: 2, color: '#39D98A', ruleId: 'reverse', cellsCount: 632,  cellsPercent: 0.158, antsAlive: 3, avgHp: 2.0, isEliminated: false },
        { playerIndex: 3, color: '#FFD60A', ruleId: 'flower',  cellsCount: 272,  cellsPercent: 0.068, antsAlive: 2, avgHp: 1.5, isEliminated: false },
      ],
      eventCounts: { births: 8, hybrids: 1, wilds: 0, deaths: 3 },
      events: [],
    },
    presets: [
      { id: 'duel',      name: 'Duel',         description: '2 players · 60×40 · classic vs spiral',     configPatch: {}, recommendedDuration: 3000 },
      { id: 'royale',    name: 'Royale',       description: '8 players · 120×80 · all rules',           configPatch: {}, recommendedDuration: 6000 },
      { id: 'sandbox',   name: 'Sandbox',      description: 'No HP · birth on · max ants',              configPatch: {}, recommendedDuration: null },
      { id: 'chaos',     name: 'Chaos',        description: 'High hybrid · wild birth · void topology', configPatch: {}, recommendedDuration: null },
      { id: 'puzzle',    name: 'Puzzle',       description: 'Tight 30×30 · 1 ant each · slow',          configPatch: {}, recommendedDuration: 1200 },
    ],
    currentPresetId: 'duel', configDirty: false,
    savedSlots: [
      { id: 'slot1', name: 'My spiral test',  config: null, savedAt: Date.now() - 86400_000 },
      { id: 'slot2', name: 'Mirror war',      config: null, savedAt: Date.now() - 3 * 86400_000 },
    ],
    ui: { paused: false, showSettings: true, showStats: true, activeSection: 'world', fullScreen: false },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS (§4.12)
// ─────────────────────────────────────────────────────────────────────────────
function defaultSettings() {
  return {
    graphics: {
      quality: 'high', glowEnabled: true, trailsEnabled: true,
      particleEffects: true, backgroundSimulation: true, fpsLimit: null,
    },
    audio: { masterVolume: 0.8, musicVolume: 0.5, sfxVolume: 0.9, uiVolume: 0.7, muteWhenInBackground: true },
    controls: {
      cameraInvertX: false, cameraInvertY: false, cameraSensitivity: 1.0, autoCameraEnabled: true,
      hotkeys: {
        centerOnAnt1: 'Digit1', centerOnAnt2: 'Digit2', centerOnAnt3: 'Digit3',
        centerOnAnt4: 'Digit4', centerOnAnt5: 'Digit5',
        cameraReset: 'KeyR', pauseToggle: 'Space', openMap: 'KeyM',
      },
    },
    gameplay: { showDamageNumbers: true, showHpDots: true, autoPanToEvents: true, quickChatEnabled: true },
    accessibility: { colorblindMode: 'off', highContrast: false, largeText: false, reducedMotion: false, screenReader: false, fontSize: 'normal' },
    notifications: { showFriendOnline: true, showAchievements: true, showRankPromotions: true },
    privacy: { profileVisibility: 'public', showOnlineStatus: true, allowFriendRequests: true, allowChatRequests: true },
    account: { locale: 'en', timezone: 'Europe/Berlin', use24hClock: true, region: 'eu-west' },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY DEFAULTS — match the old shape so existing screens keep rendering
// ─────────────────────────────────────────────────────────────────────────────
function legacyMatchDetail() {
  return {
    id: 'M-A47BC', date: '23 may 2026, 14:32', mode: 'arena · ranked', duration: '4:53',
    players: 8, fieldSize: '100 × 100',
    territorySeries: [
      { playerId: 0, points: makeSeries(60, 0.05, 0.007, 0.4, 1).map((_, i) => Math.min(0.55, 0.04 + (i / 60) * 0.45)) },
      { playerId: 1, points: makeSeries(60, 0.08, 0.005, 0.4, 2).map((_, i) => Math.min(0.40, 0.04 + (i / 60) * 0.28)) },
      { playerId: 2, points: makeSeries(60, 0.06, 0.002, 0.3, 3).map((_, i) => Math.min(0.25, 0.04 + (i / 60) * 0.10)) },
      { playerId: 3, points: makeSeries(60, 0.07, 0.001, 0.3, 4).map((_, i) => Math.min(0.18, 0.04 + (i / 60) * 0.04)) },
    ],
    winProbability: makeSeries(60, 0.5, 0.005, 0.3, 17).map((_, i) => Math.max(0.05, Math.min(0.95, 0.45 + (i / 60) * 0.35 + Math.sin(i * 0.4) * 0.06))),
    rows: [
      { playerId: 0, place: 1, pct: 47.3, cells: 1893, kills: 4, lost: 0, sr: '+18', combo: 28, accuracy: 0.87, squad: ['spiral','spiral','classic','classic','reverse'], isYou: true },
      { playerId: 1, place: 2, pct: 28.1, cells: 1124, kills: 3, lost: 2, sr: '+8',  combo: 17, accuracy: 0.81, squad: ['classic','classic','spiral','reverse','reverse'] },
      { playerId: 2, place: 3, pct: 11.5, cells: 460,  kills: 2, lost: 3, sr: '-2',  combo: 12, accuracy: 0.71, squad: ['flower','flower','classic','spiral','reverse'] },
      { playerId: 3, place: 4, pct:  7.2, cells: 288,  kills: 0, lost: 4, sr: '-12', combo: 6,  accuracy: 0.62, squad: ['reverse','reverse','reverse','classic','classic'] },
      { playerId: 4, place: 5, pct:  4.0, cells: 160,  kills: 0, lost: 5, sr: '-12', combo: 3,  accuracy: 0.58, squad: ['classic','classic','classic','classic','classic'] },
      { playerId: 5, place: 6, pct:  1.4, cells: 56,   kills: 1, lost: 5, sr: '-14', combo: 1,  accuracy: 0.51, squad: ['spiral','flower','spiral','flower','spiral'] },
      { playerId: 6, place: 7, pct:  0.4, cells: 16,   kills: 0, lost: 5, sr: '-16', combo: 0,  accuracy: 0.48, squad: ['classic','spiral','reverse','flower','classic'] },
      { playerId: 7, place: 8, pct:  0.1, cells: 4,    kills: 0, lost: 5, sr: '-18', combo: 0,  accuracy: 0.42, squad: ['reverse','spiral','classic','flower','reverse'] },
    ],
    events: [
      { t: '0:12', type: 'capture', who: 0, text: 'first capture · cell (50,50)' },
      { t: '0:48', type: 'clash',   who: 1, text: 'first clash · vs PixelKnight' },
      { t: '1:21', type: 'death',   who: 5, text: 'GlitchByte loses A1' },
      { t: '1:54', type: 'lead',    who: 0, text: 'you take the lead' },
      { t: '2:32', type: 'death',   who: 3, text: 'CrystalFox loses A2' },
      { t: '3:18', type: 'death',   who: 2, text: 'PixelKnight loses A1' },
      { t: '4:01', type: 'capture', who: 0, text: 'combo ×28 (max in match)' },
      { t: '4:53', type: 'win',     who: 0, text: 'victory · territory 47.3%' },
    ],
    yourMetrics: { accuracy: 0.87, apm: 64, territorialEfficiency: 0.71, survivability: 0.92, aggression: 1.18 },
    heatmaps: {
      yourTrails: makeHeatMap(31, [[0.3, 0.5, 0.95], [0.45, 0.35, 0.6]]),
      deaths:     makeHeatMap(13, [[0.5, 0.4, 0.7], [0.2, 0.7, 0.4]]),
      clashes:    makeHeatMap(17, [[0.55, 0.5, 0.8]]),
    },
  };
}

function legacyMeta() {
  return {
    period: '7d',
    totals: { matches: 1_247_832, activePlayers: 84_329, avgDuration: '4:47', avgPlayers: 6.2 },
    ruleWinrate: [
      { rule: 'mirror',  winRate: 0.547, usage: 0.12, samples: 18_432,  status: 'overperform'  },
      { rule: 'spiral',  winRate: 0.531, usage: 0.24, samples: 49_180,  status: 'balanced'     },
      { rule: 'classic', winRate: 0.508, usage: 0.68, samples: 142_001, status: 'balanced'     },
      { rule: 'flower',  winRate: 0.502, usage: 0.18, samples: 27_412,  status: 'balanced'     },
      { rule: 'reverse', winRate: 0.461, usage: 0.47, samples: 88_321,  status: 'underperform' },
      { rule: 'jumper',  winRate: 0.394, usage: 0.08, samples: 12_402,  status: 'underperform' },
    ],
    topComps: [
      { label: '5×spiral',                         winRate: 0.562, played: 4_521  },
      { label: '3×classic · 2×spiral',             winRate: 0.548, played: 12_887 },
      { label: '4×mirror · 1×jumper',              winRate: 0.541, played: 1_245  },
      { label: '2×spiral · 2×classic · 1×mirror',  winRate: 0.527, played: 8_311  },
      { label: '5×classic',                        winRate: 0.508, played: 14_092 },
      { label: '5×reverse',                        winRate: 0.391, played: 1_817  },
    ],
    trends: [
      { rule: 'spiral',  series: makeSeries(30, 0.51,  0.0005, 0.05, 1) },
      { rule: 'classic', series: makeSeries(30, 0.50,  0.0002, 0.04, 2) },
      { rule: 'reverse', series: makeSeries(30, 0.47, -0.0003, 0.04, 3) },
      { rule: 'mirror',  series: makeSeries(30, 0.54,  0.0006, 0.06, 4) },
    ],
    crosstab: [
      ['',        'classic','reverse','spiral','mirror','jumper'],
      ['classic',  12345,    8932,     4512,    1234,    567],
      ['reverse',  8932,     6234,     3891,    982,     421],
      ['spiral',   4512,     3891,     2134,    542,     287],
      ['mirror',   1234,     982,      542,     123,     67],
      ['jumper',   567,      421,      287,     67,      18],
    ],
    heatmaps: {
      starts:  makeHeatMap(42, [[0.5,0.5,0.4],[0.2,0.5,0.7],[0.8,0.5,0.7],[0.5,0.2,0.7],[0.5,0.8,0.7]]),
      deaths:  makeHeatMap(53, [[0.5, 0.5, 0.9]]),
      clashes: makeHeatMap(67, [[0.5, 0.5, 0.95],[0.3, 0.4, 0.5],[0.7, 0.6, 0.5]]),
    },
  };
}

function legacyLeaderboard() {
  return {
    scope: 'global', yourRank: 1247,
    rows: [
      { rank: 1,  playerId: 4, name: 'NeonOrbit',     sr: 2841, winRate: 0.711, matches: 1842, country: 'JP' },
      { rank: 2,  playerId: 2, name: 'PixelKnight',   sr: 2789, winRate: 0.694, matches: 2210, country: 'US' },
      { rank: 3,  playerId: 6, name: 'VoidPilgrim',   sr: 2722, winRate: 0.682, matches: 1599, country: 'DE' },
      { rank: 4,  playerId: 1, name: 'RuneMaster',    sr: 2680, winRate: 0.671, matches: 1820, country: 'GB' },
      { rank: 5,  playerId: 5, name: 'GlitchByte',    sr: 2641, winRate: 0.663, matches: 2401, country: 'KR' },
      { rank: 6,  playerId: 3, name: 'CrystalFox',    sr: 2602, winRate: 0.658, matches: 1442, country: 'BR' },
      { rank: 7,  playerId: 7, name: 'EmberDrift',    sr: 2588, winRate: 0.652, matches: 1671, country: 'FR' },
      { rank: 8,  playerId: 0, name: 'SilverWraith',  sr: 2570, winRate: 0.649, matches: 1228, country: 'CA' },
      { rank: 9,  playerId: 4, name: 'PrismVanguard', sr: 2554, winRate: 0.642, matches: 1944, country: 'AU' },
      { rank: 10, playerId: 2, name: 'NullPointer',   sr: 2541, winRate: 0.638, matches: 1102, country: 'NL' },
      { rank: 11, playerId: 1, name: 'OmegaCascade',  sr: 2528, winRate: 0.635, matches: 1789, country: 'PL' },
      { rank: 12, playerId: 5, name: 'AurumStrike',   sr: 2517, winRate: 0.631, matches: 1556, country: 'JP' },
      { rank: 13, playerId: 6, name: 'EchoLattice',   sr: 2503, winRate: 0.628, matches: 1198, country: 'SE' },
      { rank: 14, playerId: 7, name: 'IndigoFlare',   sr: 2491, winRate: 0.624, matches: 2042, country: 'US' },
      { rank: 15, playerId: 3, name: 'TitanCipher',   sr: 2477, winRate: 0.620, matches: 1377, country: 'RU' },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY SHIM — flat compact shapes used by existing screens (menu/match/result/stats)
// ─────────────────────────────────────────────────────────────────────────────
function legacyShims(state) {
  return {
    matchmaking: {
      mode: state.matchmaking.modeLabel.toLowerCase(),
      found: state.matchmaking.foundPlayers,
      target: state.matchmaking.targetPlayers,
      estimatedWait: `0:${String(Math.floor(state.matchmaking.estimatedWaitMs / 1000)).padStart(2, '0')}`,
      slots: state.matchmaking.slots.map((s) => ({
        filled: s.state === 'filled',
        playerId: s.player ? Number(s.player.playerId.replace('p', '')) : null,
        level: s.player?.level, sr: s.player?.sr, isYou: s.player?.isYou,
      })),
    },
    lobby: {
      countdown: state.lobby.countdownLabel,
      mode: state.lobby.modeLabel.toLowerCase(),
      squad: state.lobby.squad.map((s) => s.ruleId),
      rulesAvailable: state.lobby.availableRules.filter((r) => r.unlocked).map((r) => r.id),
      players: state.lobby.players.map((p, i) => ({
        playerId: i, status: p.ready ? 'ready' : 'picking', isYou: p.isYou,
      })),
    },
    match: {
      timer: state.match.timerLabel, tick: state.match.elapsedTicks, tps: state.match.tps,
      fieldW: state.match.field.width, fieldH: state.match.field.height,
      playerCount: state.match.players.length, startHp: 3,
      durationSec: Math.floor(state.match.totalDurationTicks / state.match.tps),
      swapCooldownSec: 12, live: false, yourPlayerId: 0,
      yourAnts: state.match.you.yourAnts.map((a) => ({
        name: `A${a.index + 1}`, rule: state.match.ants.find((x) => x.id === a.antId)?.ruleId || 'classic',
        hp: a.hp,
      })),
      combo: state.match.currentCombo ? { count: state.match.currentCombo.count, label: state.match.currentCombo.label } : null,
      events: state.match.recentEvents.map((e) => ({
        type: e.type, text: e.displayText,
        who: e.primaryPlayerId ? Number(e.primaryPlayerId.replace('p', '')) : 0,
        t: `0:${String(Math.floor((state.match.elapsedTicks - e.tick) / state.match.tps)).padStart(2, '0')}`,
      })),
    },
    result: {
      place: state.result.yourPlace, of: state.result.totalPlayers, outcome: state.result.outcome,
      duration: state.result.durationLabel, xpGained: state.result.xpGained, srGained: state.result.srDelta,
      totals: { tick: state.result.durationTicks, captures: 5000, clashes: 14 },
      rows: state.result.rows.map((r) => ({
        playerId: Number(r.player.playerId.replace('p', '')),
        pct: r.cellsPercent * 100, sr: (r.srDelta >= 0 ? '+' : '') + r.srDelta,
        cells: r.cellsCount, kills: r.kills, lost: r.deaths, peak: r.peakDescription, isYou: r.isYou,
      })),
      achievement: state.result.achievementsUnlocked[0]
        ? { name: state.result.achievementsUnlocked[0].name, xp: state.result.achievementsUnlocked[0].xpReward, rarity: state.result.achievementsUnlocked[0].rarity }
        : null,
      rematchReady: Object.values(state.result.rematchReady),
      yourStats: state.result.yourStats,
    },
    reward: state.reward.openedContents[0]
      ? {
          rarity: state.reward.openedContents[0].rarity, serial: state.reward.serialNumber,
          name: state.reward.openedContents[0].name, category: `${state.reward.openedContents[0].category} · season 02`,
          description: state.reward.openedContents[0].description,
          primary: state.reward.openedContents[0].primaryColor, secondary: state.reward.openedContents[0].secondaryColor,
        }
      : { rarity: 'epic', serial: '#0247 / 5000', name: 'Violet Pulse', category: 'ant skin · season 02', description: 'aura pulses on each tick', primary: '#C77DFF', secondary: '#4DA8FF' },
    tutorial: {
      step: state.tutorial.currentStep, of: state.tutorial.totalSteps,
      eyebrow: state.tutorial.eyebrowText, title: state.tutorial.title, body: state.tutorial.body,
      hint: state.tutorial.hint ? { title: state.tutorial.hint.title, sub: state.tutorial.hint.subtitle } : null,
    },
    user: {
      name: state.user.username, colorId: state.user.colorId,
      level: state.user.level, sr: state.user.sr, xp: state.user.xp, online: state.user.lastLoginAt > Date.now() - 3600_000,
    },
    status: {
      online: state.status.online, activeMatches: state.status.activeMatches,
      seasonLabel: `${state.status.seasonName.toLowerCase()} · ${state.status.daysRemaining} days remain`,
      version: state.version,
    },
    profile: {
      rank: { tier: state.user.rank.label, srMin: state.user.rank.minSr, srMax: state.user.rank.maxSr, pct: (state.user.sr - state.user.rank.minSr) / (state.user.rank.maxSr - state.user.rank.minSr) },
      joined: '15 mar 2026', daysActive: 234, hoursPlayed: 142,
      playstyle: { type: 'Aggressor', desc: 'High damage · low survivability · many kills' },
      totals: {
        matches: 487, wins: 234, winRate: 0.481, top3Rate: 0.78, avgPlace: 2.4,
        streak: { current: 5, kind: 'wins' }, bestStreak: 11,
        totalCellsCaptured: 824_103, antsLost: 1284,
      },
      eloSeries: makeSeries(30, 1300, 8, 0.3, 11),
      rulePerf: [
        { rule: 'spiral',  played: 692,  winRate: 0.524, avgTerr: 0.092, survival: 0.73 },
        { rule: 'classic', played: 1843, winRate: 0.512, avgTerr: 0.084, survival: 0.67 },
        { rule: 'flower',  played: 412,  winRate: 0.501, avgTerr: 0.077, survival: 0.62 },
        { rule: 'reverse', played: 891,  winRate: 0.478, avgTerr: 0.071, survival: 0.58 },
      ],
      topComps: [
        { label: '3×classic · 2×spiral', played: 145, winRate: 0.560 },
        { label: '5×spiral',             played: 23,  winRate: 0.390 },
        { label: '5×classic',            played: 87,  winRate: 0.493 },
        { label: '2×spiral · 2×reverse · 1×classic', played: 67, winRate: 0.470 },
      ],
      timeOfDay: [
        { label: 'morning · 6–12',    matches: 67,  winRate: 0.52 },
        { label: 'afternoon · 12–18', matches: 145, winRate: 0.49 },
        { label: 'evening · 18–24',   matches: 234, winRate: 0.54 },
        { label: 'night · 0–6',       matches: 41,  winRate: 0.41 },
      ],
      vsAverage: [
        { label: 'Win rate',      you: 0.481, avg: 0.480, topPct: 0.640 },
        { label: 'Avg territory', you: 0.183, avg: 0.142, topPct: 0.241 },
        { label: 'K/D ratio',     you: 1.32,  avg: 1.00,  topPct: 2.41  },
        { label: 'Accuracy',      you: 0.74,  avg: 0.68,  topPct: 0.89  },
        { label: 'Survivability', you: 0.66,  avg: 0.61,  topPct: 0.82  },
      ],
      heatmaps: {
        deaths:    makeHeatMap(3,  [[0.2, 0.3, 0.7], [0.7, 0.6, 0.5]]),
        dominance: makeHeatMap(11, [[0.3, 0.4, 0.9]]),
        clashes:   makeHeatMap(23, [[0.5, 0.5, 0.7], [0.25, 0.75, 0.4]]),
      },
      achievements: state.user.achievements.map((a) => ({
        id: a.id, name: a.id, desc: '',
        done: a.unlocked, progress: a.progress, target: a.target,
        unlocked: a.unlockedAt ? new Date(a.unlockedAt).toLocaleDateString() : null,
      })),
    },
    matchHistory: { matches: state.profile.matchHistory.items.map((m) => ({
      id: m.matchId, when: 'recent', outcome: m.outcome, players: m.playerCount,
      duration: m.durationLabel, srDelta: (m.srDelta >= 0 ? '+' : '') + m.srDelta,
      territory: m.cellsPercent, kd: `${m.kills}/${m.deaths}`, combo: m.comboMax,
    })) },
    matchDetail: legacyMatchDetail(),
    meta: legacyMeta(),
    leaderboard: legacyLeaderboard(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT — defaultState() returns full AppState (contract) + legacy aliases
// ─────────────────────────────────────────────────────────────────────────────
function defaultState() {
  const base = {
    // Meta
    version: 'v1.0',
    buildHash: 'a47bc89',
    serverRegion: 'eu-west',
    serverTime: Date.now(),
    clientTime: Date.now(),
    pingMs: 32,

    // Sub-states
    connection: defaultConnection(),
    user: defaultUser(),
    status: defaultServiceStatus(),
    locale: defaultLocale(),

    currentScreen: 'menu',
    previousScreen: null,

    menu: defaultMenu(),
    matchmaking: defaultMatchmaking(),
    lobby: defaultLobby(),
    match: defaultMatch(),
    result: defaultResult(),
    reward: defaultReward(),
    tutorial: defaultTutorial(),
    profile: defaultProfile(),
    sandbox: defaultSandbox(),
    settings: defaultSettings(),

    toasts: [],
    modal: null,
  };
  // Contract shape wins at root. Legacy is exposed two ways:
  //   1. data.legacy.{match, lobby, ...} — explicit, contract-clean access
  //   2. legacy *extra* keys (those that don't conflict) get merged into the
  //      contract sub-objects so existing screens reading e.g. data.match.timer,
  //      data.user.name still work without rewrites.
  // Conflicts (same key on both shapes) ALWAYS resolve to the contract value.
  const legacy = legacyShims(base);
  for (const key of Object.keys(legacy)) {
    const lv = legacy[key];
    const cv = base[key];
    if (lv && typeof lv === 'object' && !Array.isArray(lv) && cv && typeof cv === 'object' && !Array.isArray(cv)) {
      for (const innerKey of Object.keys(lv)) {
        if (!(innerKey in cv)) cv[innerKey] = lv[innerKey];
      }
    } else if (!(key in base)) {
      base[key] = lv;
    }
  }
  base.legacy = legacy;
  return base;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS — contract-aligned (§5). Every callback is a no-op by default.
// ─────────────────────────────────────────────────────────────────────────────
function defaultActions() {
  const noop = () => Promise.resolve({ success: true });
  return {
    // Navigation
    onScreenChange: noop, onPlay: noop, onResumeMatch: noop, onOpenProfile: noop,
    onOpenSettings: noop, onOpenSandbox: noop, onOpenTutorial: noop, onOpenChangelog: noop,
    onOpenCredits: noop, onLogout: noop, onQuit: noop,

    // Matchmaking
    onStartMatchmaking: noop, onCancelMatchmaking: noop, onChangeRegion: noop,
    onAcceptMatch: noop, onDeclineMatch: noop,

    // Lobby
    onLobbyReady: noop, onLobbyUnready: noop, onLobbyLeave: noop,
    onSquadChange: noop, onSquadShuffle: noop, onSquadLoadPreset: noop, onSquadSavePreset: noop,
    onLobbyPreviewToggle: noop, onLobbyChatSend: noop, onLobbyQuickChat: noop, onLobbyKickPlayer: noop,

    // Match
    onMatchPause: noop, onMatchResume: noop, onMatchForfeit: noop,
    onSelectAnt: noop, onDeselectAnt: noop,
    onCameraPan: noop, onCameraZoom: noop, onCameraReset: noop, onCameraCenterOn: noop, onCameraToggleAutoFollow: noop,
    onSendQuickChat: noop,
    onChangeAntRule: noop, onRecallAnt: noop, onDeployFromReserve: noop, onDeployStrategy: noop,
    onSwapReserveRule: noop, onDiscardReserve: noop, onCreateCustomRule: noop,

    // Result
    onRematch: noop, onCancelRematch: noop, onNewMatch: noop, onReturnToMenu: noop,
    onOpenReward: noop, onShareResult: noop, onWatchReplay: noop, onDownloadReplay: noop, onReportPlayer: noop,

    // Reward
    onOpenLootbox: noop, onClaimReward: noop, onEquipReward: noop, onSkipRewardAnimation: noop,

    // Tutorial
    onTutorialNext: noop, onTutorialPrev: noop, onTutorialReplay: noop, onTutorialSkip: noop, onTutorialComplete: noop,

    // Profile
    onProfileTabChange: noop, onLoadMoreHistory: noop, onFilterHistory: noop,
    onAddFriend: noop, onRemoveFriend: noop, onBlockPlayer: noop, onUnblockPlayer: noop,
    onChangeUsername: noop, onChangeColor: noop, onEquipCosmetic: noop,

    // Sandbox
    onSandboxConfigChange: noop, onSandboxPlay: noop, onSandboxPause: noop, onSandboxStep: noop,
    onSandboxReset: noop, onSandboxLoadPreset: noop, onSandboxSaveSlot: noop, onSandboxLoadSlot: noop,
    onSandboxDeleteSlot: noop, onSandboxExportConfig: noop, onSandboxImportConfig: noop,
    onSandboxAddPlayer: noop, onSandboxRemovePlayer: noop, onSandboxPlayerChange: noop,
    onSandboxResetHeatmaps: noop, onSandboxExportHeatmap: noop,

    // Settings
    onSettingsChange: noop, onSettingsReset: noop, onSettingsApply: noop,
    onChangeLocale: noop, onChangeHotkey: noop,

    // Modal & toast
    onModalClose: noop, onModalAction: noop, onToastDismiss: noop, onToastAction: noop,

    // System
    onReconnect: noop, onCancelReconnect: noop, onSendBugReport: noop, onContactSupport: noop,

    // ─────────────────────────────────────────────────────────────────────────
    // DEPRECATED — legacy aliases kept only so existing screens keep calling
    // something. Will be removed once screens-menu/match/result/stats are
    // migrated to the contract-named actions above. New code MUST NOT use these.
    // ─────────────────────────────────────────────────────────────────────────
    onTrain: noop, onPrivate: noop, onProfile: noop, onSettings: noop, onBack: noop,
    onCancelSearch: noop, onReady: noop, onUnready: noop, onPause: noop, onMenu: noop,
    onMatchEnd: noop, onSwapRule: noop, onToggleMute: noop,
    onOpenMatch: noop, onOpenMeta: noop, onOpenLeaderboard: noop, onPlayReplay: noop, onProfileTab: noop,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Storybook scene presets — load a specific empty/loading/error/full state per screen.
// ─────────────────────────────────────────────────────────────────────────────
function sceneState(screen, variant = 'full') {
  const s = defaultState();
  if (variant === 'empty') {
    if (screen === 'matchmaking') {
      s.matchmaking.inQueue = false; s.matchmaking.foundPlayers = 0;
      s.matchmaking.slots = s.matchmaking.slots.map((x) => ({ ...x, state: 'empty', player: null }));
      s.matchmaking.status = 'idle';
    }
    if (screen === 'lobby') { s.lobby.chatMessages = []; }
    if (screen === 'profile') { s.profile.matchHistory.items = []; }
    if (screen === 'result')  { s.result.rows = []; }
    if (screen === 'menu')    { s.menu.newsItems = []; s.menu.dailyReward = null; }
    if (screen === 'sandbox') { s.sandbox.savedSlots = []; }
  }
  if (variant === 'loading') {
    s.profile.matchHistory.loading = true;
    s.connection.status = 'connecting';
    s.matchmaking.status = 'searching';
  }
  if (variant === 'error') {
    s.connection.status = 'error'; s.connection.lastError = 'WebSocket connection refused';
    s.matchmaking.status = 'error'; s.matchmaking.errorMessage = 'No players in queue for this region';
    s.profile.matchHistory.error = 'Failed to load match history · timeout';
    s.toasts.push({ id: 't1', type: 'error', message: 'Connection lost · retrying', durationMs: 0, createdAt: Date.now() });
  }
  return s;
}

// Patch helper.
function patchState(state, patch) {
  return { ...state, ...patch };
}

// Rule color quick-lookup (legacy).
const RULE_META = {
  classic: { color: '#4DA8FF', desc: 'Highway after ~10k ticks',  code: 'RL'   },
  spiral:  { color: '#C77DFF', desc: 'Tight expanding spirals',   code: 'LRR'  },
  reverse: { color: '#FF8A3D', desc: 'Inverts neighbour state',   code: 'LR'   },
  flower:  { color: '#39D98A', desc: 'Symmetric petals',          code: 'RLR'  },
  mirror:  { color: '#00E5D1', desc: 'Right own, left enemy',     code: 'AD'   },
  jumper:  { color: '#FFCC00', desc: 'Teleports every 10t',       code: 'JP'   },
  uturn:   { color: '#FF4D9E', desc: 'Patrols small areas',       code: 'RR'   },
  random:  { color: '#7DD3FC', desc: 'L or R randomly',           code: '??'   },
};

const RARITY_COLORS = {
  common:    { primary: '#8E8E93', secondary: '#5A5870' },
  rare:      { primary: '#4DA8FF', secondary: '#39D98A' },
  epic:      { primary: '#C77DFF', secondary: '#4DA8FF' },
  legendary: { primary: '#FFD60A', secondary: '#FF8A3D' },
};

function defaultStats() {
  return {
    profile: defaultProfile(),
    matchHistory: { matches: defaultMatchHistoryItems().map((m) => ({
      id: m.matchId, when: 'recent', outcome: m.outcome, players: m.playerCount,
      duration: m.durationLabel, srDelta: (m.srDelta >= 0 ? '+' : '') + m.srDelta,
      territory: m.cellsPercent, kd: `${m.kills}/${m.deaths}`, combo: m.comboMax,
    })) },
    matchDetail: legacyMatchDetail(),
    meta: legacyMeta(),
    leaderboard: legacyLeaderboard(),
  };
}

Object.assign(window, {
  defaultState, defaultActions, defaultStats, patchState, sceneState,
  RULE_META, RARITY_COLORS, RULES_REGISTRY, RULES_BY_ID, PLAYER_PALETTE,
  RANK_TIERS, rankFromSr,
  makeHeatMap, makeSeries,
});
