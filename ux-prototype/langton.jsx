// langton.jsx — Langton's Ant simulation engine + live canvas renderer.
// Multi-player variant: each ant carries an owner (player index) and a turn-rule.
// Cells store both owner (claimed by) and state (day/night, advances with each step).
// On step: read cell state -> rule[state] gives turn -> flip cell state -> claim owner -> move forward.

const LA_DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W

// Build a fresh simulation state. Pass in width/height/ants/rule per ant.
function makeLangtonState({ w, h, ants }) {
  return {
    w, h,
    owner: new Uint8Array(w * h),    // 0=neutral, 1..N = player index+1
    state: new Uint8Array(w * h),    // cell state, advances mod rule.length
    ants: ants.map((a) => ({ ...a })),
    tick: 0,
  };
}

// One tick. Mutates state in place. Returns events: { captures, collisions, damage, deaths,
// births, hybrids, wilds }. Birth/hybrid/wild only fire when sim.birthConfig is set
// (sandbox feature). Match HUD doesn't enable it.
function stepLangton(sim) {
  const { w, h, owner, state, ants } = sim;
  const events = { captures: [], collisions: [], damage: [], deaths: [], births: [], hybrids: [], wilds: [] };
  // Pre-resolve next positions for collision detection.
  for (const a of ants) {
    if (a.dead) continue;
    if (a.swapCooldown > 0) a.swapCooldown--;
    const i = a.y * w + a.x;
    const s = state[i];
    const r = a.rule;
    const ch = r[s % r.length];
    if (ch === 'R') a.dir = (a.dir + 1) & 3;
    else if (ch === 'L') a.dir = (a.dir + 3) & 3;
    // 'U' = uturn, 'N' = none (rare extensions, harmless if missing)
    state[i] = (s + 1) % r.length;
    const prevOwner = owner[i];
    owner[i] = a.owner + 1;
    if (prevOwner !== a.owner + 1) events.captures.push({ x: a.x, y: a.y, owner: a.owner });
    const [dx, dy] = LA_DIRS[a.dir];
    a.x = (a.x + dx + w) % w;
    a.y = (a.y + dy + h) % h;
  }
  // Resolve collisions: any cell with 2+ ants of different owners -> each loses 1 HP per enemy.
  const cellMap = new Map();
  for (const a of ants) {
    if (a.dead) continue;
    const k = a.y * w + a.x;
    if (!cellMap.has(k)) cellMap.set(k, []);
    cellMap.get(k).push(a);
  }
  // Collision cooldown per contract §sandbox: an ant can't take damage more than once
  // every N ticks. Default 5, tunable via sim.collisionCooldownTicks.
  const cd = sim.collisionCooldownTicks ?? 5;
  for (const [k, group] of cellMap) {
    if (group.length < 2) continue;
    const owners = new Set(group.map((a) => a.owner));
    if (owners.size < 2) continue;        // all same team
    events.collisions.push({ x: group[0].x, y: group[0].y });
    for (const a of group) {
      // Skip if ant is still in immunity window from a recent clash.
      if (a.lastDamageTick != null && sim.tick - a.lastDamageTick < cd) continue;
      const enemies = group.reduce((n, b) => n + (b.owner !== a.owner ? 1 : 0), 0);
      // Damage cap: regardless of how many enemies pile into the cell, max 1 HP loss
      // per clash event. Prevents instakill when 4 different owners overlap.
      const dmg = Math.min(1, enemies);
      a.hp = (a.hp ?? 3) - dmg;
      a.lastDamageTick = sim.tick;
      events.damage.push({ id: a.id, owner: a.owner, hp: a.hp, enemies });
      if (a.hp <= 0 && !a.dead) {
        a.dead = true;
        events.deaths.push({ id: a.id, owner: a.owner, x: a.x, y: a.y });
      }
    }
  }

  // ─── Births / hybrids / wilds (sandbox feature) ──────────────────────────
  // Only runs when sim.birthConfig is provided (sandbox sets it from config).
  const bc = sim.birthConfig;
  if (bc && bc.enabled) {
    sim.lastBirthTickByOwner = sim.lastBirthTickByOwner || {};
    sim.rng = sim.rng || mulberry32(sim.tick + 7919);
    const liveByOwner = new Map();
    for (const a of ants) {
      if (a.dead) continue;
      if (a.owner === 255) continue;  // wilds don't reproduce
      const list = liveByOwner.get(a.owner) || [];
      list.push(a); liveByOwner.set(a.owner, list);
    }
    // Try one birth per eligible owner per tick.
    for (const [ownerId, ownAnts] of liveByOwner) {
      const last = sim.lastBirthTickByOwner[ownerId] ?? -9999;
      if (sim.tick - last < (bc.cooldownTicks || 50)) continue;
      if (ownAnts.length >= (bc.maxAntsPerPlayer || 12)) continue;
      // Find a candidate: ant whose 8 surrounding cells contain N+ same-owner cells.
      // Cheap heuristic — sample 3 ants randomly.
      const sample = ownAnts.length <= 3 ? ownAnts : pickN(ownAnts, 3, sim.rng);
      let chosen = null;
      for (const a of sample) {
        let cnt = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = ((a.x + dx) % w + w) % w;
          const ny = ((a.y + dy) % h + h) % h;
          if (owner[ny * w + nx] === ownerId + 1) cnt++;
        }
        if (cnt >= (bc.minNeighbors || 3)) { chosen = a; break; }
      }
      if (!chosen) continue;
      // Pick empty adjacent cell.
      const free = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = ((chosen.x + dx) % w + w) % w;
        const ny = ((chosen.y + dy) % h + h) % h;
        if (!ants.some((b) => !b.dead && b.x === nx && b.y === ny)) free.push({ x: nx, y: ny });
      }
      if (!free.length) continue;
      const spot = free[Math.floor(sim.rng() * free.length)];
      // Decide hybrid / wild outcome.
      const roll = sim.rng();
      let newOwner = ownerId, newRule = chosen.rule, hybrid = false, wild = false;
      if (roll < (bc.wildChance || 0)) {
        newOwner = 255;
        newRule = scrambleRule(chosen.rule, sim.rng);
        wild = true;
      } else if (roll < (bc.wildChance || 0) + (bc.hybridChance || 0)) {
        // Mix with rule of a different live owner if any
        const otherAnts = [...liveByOwner.entries()].filter(([o]) => o !== ownerId).flatMap(([, l]) => l);
        if (otherAnts.length) {
          const other = otherAnts[Math.floor(sim.rng() * otherAnts.length)];
          newRule = mixRules(chosen.rule, other.rule, sim.rng);
          hybrid = true;
        }
      }
      const newAnt = {
        id: `${chosen.id}_b${sim.tick}`,
        owner: newOwner, rule: newRule,
        x: spot.x, y: spot.y, dir: Math.floor(sim.rng() * 4),
        hp: 3, bornAt: sim.tick,
        isHybrid: hybrid, isWild: wild,
      };
      ants.push(newAnt);
      sim.lastBirthTickByOwner[ownerId] = sim.tick;
      events.births.push({ id: newAnt.id, owner: newOwner, x: spot.x, y: spot.y });
      if (hybrid) events.hybrids.push({ id: newAnt.id, parents: [chosen.id] });
      if (wild)   events.wilds.push({ id: newAnt.id, x: spot.x, y: spot.y });
    }
  }

  sim.tick++;
  return events;
}

// Helpers for birth system.
function mulberry32(a) { return function() { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function pickN(arr, n, rng) {
  const out = [], used = new Set();
  while (out.length < n && used.size < arr.length) {
    const i = Math.floor(rng() * arr.length);
    if (used.has(i)) continue;
    used.add(i); out.push(arr[i]);
  }
  return out;
}
function mixRules(a, b, rng) {
  // Interleave characters from two rules with random source.
  const len = Math.max(a.length, b.length);
  let out = '';
  for (let i = 0; i < len; i++) {
    const src = rng() < 0.5 ? a : b;
    out += src[i % src.length];
  }
  return out || a;
}
function scrambleRule(r, rng) {
  // Flip random characters between L and R, keep length.
  let out = '';
  for (const ch of r) {
    if (ch === 'L') out += rng() < 0.5 ? 'R' : 'L';
    else if (ch === 'R') out += rng() < 0.5 ? 'L' : 'R';
    else out += ch;
  }
  return out;
}

// React hook: maintains a Langton sim + renders to a canvas ref at a steady tps.
// Returns { canvasRef, sim, restart }.
function useLangtonField({
  w, h, cellSize, ants, palette, tps = 12, paused = false,
  showTrail = false, antScale = 1, glow = true, bg = '#0E0B1F',
  collisionCooldownTicks = 5,            // immunity window after a clash
  birthConfig = null,                    // { enabled, minNeighbors, cooldownTicks, maxAntsPerPlayer, hybridChance, wildChance }
  onEvents = null,                       // (events) => void, called once per tick
  onTick = null,                         // (sim) => void, called once per tick after step
}) {
  const canvasRef = React.useRef(null);
  const simRef = React.useRef(null);
  const trailRef = React.useRef(null); // per-cell decay (Float32 0..1) for capture flashes
  const [, force] = React.useReducer((n) => n + 1, 0);

  // (Re)build sim whenever shape changes.
  React.useEffect(() => {
    simRef.current = makeLangtonState({ w, h, ants });
    simRef.current.collisionCooldownTicks = collisionCooldownTicks;
    simRef.current.birthConfig = birthConfig;
    trailRef.current = new Float32Array(w * h);
    force();
  }, [w, h, JSON.stringify(ants)]);

  // Live-update cooldown + birth config without rebuilding the whole sim.
  React.useEffect(() => {
    if (simRef.current) simRef.current.collisionCooldownTicks = collisionCooldownTicks;
  }, [collisionCooldownTicks]);
  React.useEffect(() => {
    if (simRef.current) simRef.current.birthConfig = birthConfig;
  }, [JSON.stringify(birthConfig)]);

  const restart = React.useCallback(() => {
    simRef.current = makeLangtonState({ w, h, ants });
    simRef.current.collisionCooldownTicks = collisionCooldownTicks;
    simRef.current.birthConfig = birthConfig;
    trailRef.current = new Float32Array(w * h);
  }, [w, h, ants, collisionCooldownTicks, JSON.stringify(birthConfig)]);

  // Main loop.
  React.useEffect(() => {
    let raf, last = performance.now(), acc = 0;
    const period = 1000 / tps;
    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      const dt = t - last; last = t;
      if (!paused && simRef.current) {
        acc += dt;
        while (acc >= period) {
          const ev = stepLangton(simRef.current);
          const tr = trailRef.current;
          for (const c of ev.captures) tr[c.y * w + c.x] = 1;
          if (onEvents) onEvents(ev);
          if (onTick)   onTick(simRef.current);
          acc -= period;
        }
        // Decay trails each frame.
        const tr = trailRef.current;
        const decay = Math.pow(0.94, dt / 16);
        for (let i = 0; i < tr.length; i++) if (tr[i] > 0.001) tr[i] *= decay; else tr[i] = 0;
      }
      drawLangton(canvasRef.current, simRef.current, trailRef.current, { cellSize, palette, bg, antScale, glow, showTrail });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tps, paused, cellSize, JSON.stringify(palette), bg, antScale, glow, showTrail]);

  return { canvasRef, simRef, restart };
}

function drawLangton(canvas, sim, trails, opts) {
  if (!canvas || !sim) return;
  const { cellSize, palette, bg, antScale, glow } = opts;
  const ctx = canvas.getContext('2d');
  const { w, h, owner, state, ants } = sim;
  const pixelW = w * cellSize, pixelH = h * cellSize;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== pixelW * dpr || canvas.height !== pixelH * dpr) {
    canvas.width = pixelW * dpr; canvas.height = pixelH * dpr;
    canvas.style.width = pixelW + 'px'; canvas.style.height = pixelH + 'px';
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, pixelW, pixelH);

  // Cells.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = owner[i];
      if (!o) continue;
      const p = palette[o - 1] || '#ffffff';
      const s = state[i];
      // Day = full color, night = 50%.
      ctx.globalAlpha = s % 2 === 0 ? 0.92 : 0.5;
      ctx.fillStyle = p;
      ctx.fillRect(x * cellSize + 0.5, y * cellSize + 0.5, cellSize - 1, cellSize - 1);
    }
  }
  ctx.globalAlpha = 1;

  // Capture flashes on top of cells.
  if (trails) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (trails[i] > 0.02) {
          ctx.globalAlpha = trails[i] * 0.6;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // Ants.
  for (const a of ants) {
    if (a.dead) continue;
    const cx = a.x * cellSize + cellSize / 2;
    const cy = a.y * cellSize + cellSize / 2;
    const r = (cellSize / 2) * antScale;
    const p = palette[a.owner] || '#ffffff';
    if (glow) {
      ctx.shadowColor = p; ctx.shadowBlur = cellSize * 1.2;
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // Direction dot.
    const [dx, dy] = LA_DIRS[a.dir];
    ctx.fillStyle = p;
    ctx.beginPath();
    ctx.arc(cx + dx * r * 0.45, cy + dy * r * 0.45, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
}

// LangtonField — renders the canvas at intrinsic pixel size. Wrap in a sized container.
function LangtonField(props) {
  const { canvasRef } = useLangtonField(props);
  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        imageRendering: 'pixelated',
        borderRadius: props.radius ?? 0,
        ...(props.style || {}),
      }}
    />
  );
}

// Helpers: a few preset ant configurations.
const LA_RULES = {
  classic: 'RL',
  spiral: 'LRR',
  reverse: 'LR',
  flower: 'RLR',
  weave:  'LRLR',
};

// Spawn ants spread evenly across the field.
// NOTE: when consuming `ants` in React deps, wrap creation in useMemo — otherwise
// a fresh array each render will reset the sim. See uses of spawnAnts in screens-*.
function spawnAnts({ w, h, players = 4, perPlayer = 5, rule = 'RL', seed = 1, startHp = 3 }) {
  const ants = [];
  let s = seed;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  let nextId = 0;
  for (let p = 0; p < players; p++) {
    const angle = (p / players) * Math.PI * 2;
    const cx = w / 2 + Math.cos(angle) * Math.min(w, h) * 0.32;
    const cy = h / 2 + Math.sin(angle) * Math.min(w, h) * 0.32;
    for (let k = 0; k < perPlayer; k++) {
      const ox = (rand() - 0.5) * 8;
      const oy = (rand() - 0.5) * 8;
      ants.push({
        id: nextId++,
        x: Math.max(0, Math.min(w - 1, Math.round(cx + ox))),
        y: Math.max(0, Math.min(h - 1, Math.round(cy + oy))),
        dir: Math.floor(rand() * 4),
        owner: p,
        rule: typeof rule === 'function' ? rule(p, k) : rule,
        hp: startHp,
        swapCooldown: 0,
      });
    }
  }
  return ants;
}

// Aggregate live sim → React-friendly stats. Called every poll-frame from the HUD.
function aggregateStats(sim, players) {
  if (!sim) return null;
  const { owner, ants, w, h } = sim;
  const counts = new Array(players).fill(0);
  for (let i = 0; i < owner.length; i++) {
    const o = owner[i]; if (o > 0 && o <= players) counts[o - 1]++;
  }
  const total = w * h;
  const alive = new Array(players).fill(0);
  const antsByOwner = new Array(players).fill(null).map(() => []);
  for (const a of ants) {
    antsByOwner[a.owner]?.push({
      id: a.id, hp: Math.max(0, a.hp), dead: !!a.dead,
      rule: a.rule, swapCooldown: a.swapCooldown,
    });
    if (!a.dead) alive[a.owner]++;
  }
  const teamsAlive = alive.filter((n) => n > 0).length;
  return {
    territoryPct: counts.map((c) => c / total),
    counts,
    alive,
    antsByOwner,
    teamsAlive,
    tick: sim.tick,
  };
}

Object.assign(window, { LangtonField, useLangtonField, makeLangtonState, stepLangton, spawnAnts, aggregateStats, LA_RULES, LA_DIRS, drawLangton });
