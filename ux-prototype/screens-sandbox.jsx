// screens-sandbox.jsx — Sandbox laboratory (web-only) per contract §4.11.
// Layout: live simulation in center, config sidebar left, stats panel right, transport bar at bottom.

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function SbPill({ children, color = (T.accent), filled = false }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 4,
      fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 600,
      letterSpacing: 0.4, textTransform: 'uppercase',
      background: filled ? color : `${color}1A`,
      color: filled ? (T.bg) : color,
      border: filled ? 'none' : `1px solid ${color}40`,
    }}>{children}</span>
  );
}

function SbGroupHeader({ children }) {
  return (
    <div style={{
      padding: '12px 14px 6px',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 10, color: (T.textMuted),
      letterSpacing: 2, textTransform: 'uppercase',
    }}>{children}</div>
  );
}

function SbRow({ label, children, last = false }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto',
      gap: 12, alignItems: 'center',
      padding: '8px 14px',
      borderBottom: last ? 'none' : '1px solid rgba(255,255,255,.04)',
      fontSize: 12, color: T.textSecondary,
    }}>
      <span>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{children}</div>
    </div>
  );
}

function SbToggle({ on, onChange }) {
  return (
    <button onClick={() => onChange?.(!on)} style={{
      width: 30, height: 18, borderRadius: 999, position: 'relative',
      background: on ? (T.accent) : (T.border),
      border: 'none', cursor: 'pointer', padding: 0,
      transition: 'background .15s',
    }}>
      <div style={{
        position: 'absolute', top: 2, left: on ? 14 : 2,
        width: 14, height: 14, borderRadius: '50%',
        background: on ? (T.bg) : (T.textPrimary),
        transition: 'left .15s',
      }}/>
    </button>
  );
}

function SbNumber({ value, onChange, min = 0, max = 999, step = 1, width = 64, suffix }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={(e) => onChange?.(parseFloat(e.target.value))}
        style={{
          width, padding: '4px 8px', borderRadius: 4,
          background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.10)',
          color: (T.textPrimary), fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
          textAlign: 'right', outline: 'none',
        }}/>
      {suffix ? <span style={{ fontSize: 10, color: T.textDim, minWidth: 24 }}>{suffix}</span> : null}
    </div>
  );
}

function SbSlider({ value, min = 0, max = 1, step = 0.01, onChange, suffix }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 140 }}>
      <div style={{ position: 'relative', flex: 1, height: 3, background: (T.border), borderRadius: 999 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: (T.accent), borderRadius: 999 }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange?.(parseFloat(e.target.value))}
          style={{ position: 'absolute', inset: 0, width: '100%', height: 14, opacity: 0, cursor: 'pointer' }}/>
      </div>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
        color: (T.accent), minWidth: 34, textAlign: 'right' }}>
        {typeof value === 'number' ? value.toFixed(value < 1 ? 2 : 0) : value}{suffix || ''}
      </span>
    </div>
  );
}

function SbSelect({ value, options, onChange, width = 110 }) {
  return (
    <select value={value} onChange={(e) => onChange?.(e.target.value)} style={{
      appearance: 'none', cursor: 'pointer',
      background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.10)',
      color: (T.textPrimary), padding: '4px 22px 4px 8px', borderRadius: 4,
      fontFamily: 'Inter, sans-serif', fontSize: 11, width,
      backgroundImage: 'linear-gradient(45deg, transparent 50%, #8E8E93 50%), linear-gradient(135deg, #8E8E93 50%, transparent 50%)',
      backgroundPosition: `calc(100% - 12px) 50%, calc(100% - 8px) 50%`,
      backgroundSize: '4px 4px, 4px 4px', backgroundRepeat: 'no-repeat',
    }}>
      {options.map((o) => <option key={o.value} value={o.value} style={{ background: T.bgElevated }}>{o.label}</option>)}
    </select>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Config sidebar (left)
// ─────────────────────────────────────────────────────────────────────────────

function ConfigPanel({ config, set }) {
  return (
    <div style={{
      width: 290, background: '#0F0C22', borderRight: '1px solid rgba(255,255,255,.06)',
      overflow: 'auto', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: (T.textMuted), letterSpacing: 2, textTransform: 'uppercase' }}>config</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginTop: 4, color: (T.textPrimary) }}>{tx('sandbox.title', 'Laboratory')}</div>
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <SbPill color={T.accent}>{config.width}×{config.height}</SbPill>
          <SbPill color={T.info}>{config.players.length}p</SbPill>
          <SbPill color={T.success}>tps {config.baseTps * config.speedMultiplier}</SbPill>
        </div>
      </div>

      <SbGroupHeader>world</SbGroupHeader>
      <SbRow label="Width">      <SbNumber value={config.width} min={20} max={200} onChange={(v) => set('width', v)} suffix="cells" /></SbRow>
      <SbRow label="Height">     <SbNumber value={config.height} min={20} max={200} onChange={(v) => set('height', v)} suffix="cells" /></SbRow>
      <SbRow label="Topology">
        <SbSelect value={config.topology} onChange={(v) => set('topology', v)}
          options={[
            { value: 'torus',  label: 'torus' },
            { value: 'wall',   label: 'wall' },
            { value: 'bounce', label: 'bounce' },
            { value: 'void',   label: 'void' },
          ]} width={92}/>
      </SbRow>
      <SbRow label="Seed" last><SbNumber value={config.seed} min={0} max={999999} onChange={(v) => set('seed', v)} /></SbRow>

      <SbGroupHeader>birth</SbGroupHeader>
      <SbRow label="Enabled"><SbToggle on={config.birthEnabled} onChange={(v) => set('birthEnabled', v)} /></SbRow>
      <SbRow label="Min neighbours"><SbNumber value={config.birthMinNeighbors} min={2} max={8} onChange={(v) => set('birthMinNeighbors', v)} /></SbRow>
      <SbRow label="Cooldown"><SbNumber value={config.birthCooldownTicks} min={1} max={500} onChange={(v) => set('birthCooldownTicks', v)} suffix="t" /></SbRow>
      <SbRow label="Max ants / player"><SbNumber value={config.maxAntsPerPlayer} min={1} max={50} onChange={(v) => set('maxAntsPerPlayer', v)} /></SbRow>
      <SbRow label="Hybrid chance"><SbSlider value={config.hybridChance} min={0} max={1} onChange={(v) => set('hybridChance', v)} /></SbRow>
      <SbRow label="Wild chance" last><SbSlider value={config.wildBirthChance} min={0} max={0.2} step={0.005} onChange={(v) => set('wildBirthChance', v)} /></SbRow>

      <SbGroupHeader>combat</SbGroupHeader>
      <SbRow label="HP enabled"><SbToggle on={config.hpEnabled} onChange={(v) => set('hpEnabled', v)} /></SbRow>
      <SbRow label="Clash cooldown"><SbNumber value={config.collisionCooldownTicks} min={0} max={50} onChange={(v) => set('collisionCooldownTicks', v)} suffix="t" /></SbRow>
      <SbRow label="Cells survive death" last><SbToggle on={config.cellsSurviveDeath} onChange={(v) => set('cellsSurviveDeath', v)} /></SbRow>

      <SbGroupHeader>heatmap</SbGroupHeader>
      <SbRow label="Mode">
        <SbSelect value={config.heatmapMode} onChange={(v) => set('heatmapMode', v)}
          options={[
            { value: 'none',       label: 'none' },
            { value: 'activity',   label: 'activity' },
            { value: 'collisions', label: 'collisions' },
            { value: 'deaths',     label: 'deaths' },
            { value: 'territory',  label: 'territory' },
          ]} width={106}/>
      </SbRow>
      <SbRow label="Intensity"><SbSlider value={config.heatmapIntensity} min={0} max={3} step={0.1} onChange={(v) => set('heatmapIntensity', v)} suffix="x" /></SbRow>
      <SbRow label="Opacity"><SbSlider value={config.heatmapOpacity} onChange={(v) => set('heatmapOpacity', v)} /></SbRow>
      <SbRow label="Decay" last><SbToggle on={config.heatmapDecay} onChange={(v) => set('heatmapDecay', v)} /></SbRow>

      <SbGroupHeader>visual</SbGroupHeader>
      <SbRow label="Grid"><SbToggle on={config.showGrid} onChange={(v) => set('showGrid', v)} /></SbRow>
      <SbRow label="Glow"><SbToggle on={config.showGlow} onChange={(v) => set('showGlow', v)} /></SbRow>
      <SbRow label="Trails"><SbToggle on={config.showTrails} onChange={(v) => set('showTrails', v)} /></SbRow>
      <SbRow label="HP dots"><SbToggle on={config.showHpDots} onChange={(v) => set('showHpDots', v)} /></SbRow>
      <SbRow label="Ant scale" last><SbSlider value={config.antScale} min={0.3} max={1.5} step={0.05} onChange={(v) => set('antScale', v)} suffix="x" /></SbRow>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Center — preview + transport
// ─────────────────────────────────────────────────────────────────────────────

function SandboxField({ config, sim, paused }) {
  // Build ants from config.players × player.antCount, distributed by spawnPattern.
  const ants = React.useMemo(() => {
    const list = [];
    let s = config.seed || 1;
    const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    config.players.forEach((p, pi) => {
      const rule = (window.LA_RULES && window.LA_RULES[p.ruleId]) || window.LA_RULES?.classic;
      for (let i = 0; i < p.antCount; i++) {
        let x = 0, y = 0;
        if (p.spawnPattern === 'corner') {
          const corner = pi % 4;
          x = corner % 2 === 0 ? 2 + i : config.width - 3 - i;
          y = corner < 2     ? 2 + i : config.height - 3 - i;
        } else if (p.spawnPattern === 'center') {
          x = Math.floor(config.width / 2) + (i - p.antCount / 2);
          y = Math.floor(config.height / 2);
        } else if (p.spawnPattern === 'cluster') {
          const cx = (pi + 1) * config.width / (config.players.length + 1);
          x = Math.floor(cx + (rand() - 0.5) * 6);
          y = Math.floor(config.height / 2 + (rand() - 0.5) * 6);
        } else if (p.spawnPattern === 'random') {
          x = Math.floor(rand() * config.width);
          y = Math.floor(rand() * config.height);
        } else {
          // radial — distribute on a circle around center
          const angle = ((pi * p.antCount + i) / (config.players.length * p.antCount)) * Math.PI * 2;
          const radius = Math.min(config.width, config.height) * 0.35;
          x = Math.floor(config.width / 2 + Math.cos(angle) * radius);
          y = Math.floor(config.height / 2 + Math.sin(angle) * radius);
        }
        x = Math.max(0, Math.min(config.width - 1, x));
        y = Math.max(0, Math.min(config.height - 1, y));
        list.push({
          id: `p${pi}_a${i}`, owner: pi, rule: rule || 'RL',
          x, y, dir: pi % 4, hp: p.startHp ?? 3,
        });
      }
    });
    return list;
  }, [JSON.stringify(config.players), config.width, config.height, config.seed]);

  const palette = config.players.map((p) => p.color);
  const cellSize = Math.max(4, Math.min(16, Math.floor(700 / config.width)));
  const effectiveTps = config.baseTps * config.speedMultiplier;

  // Live stats — accumulated from the running simulation.
  const [liveStats, setLiveStats] = React.useState({
    tick: 0, totalAnts: ants.length, deaths: 0, collisions: 0,
    births: 0, hybrids: 0, wilds: 0,
  });
  const accRef = React.useRef({ tick: 0, deaths: 0, collisions: 0, births: 0, hybrids: 0, wilds: 0 });

  // Reset when ants reset
  React.useEffect(() => {
    accRef.current = { tick: 0, deaths: 0, collisions: 0, births: 0, hybrids: 0, wilds: 0 };
    setLiveStats({ tick: 0, totalAnts: ants.length, deaths: 0, collisions: 0, births: 0, hybrids: 0, wilds: 0 });
  }, [ants]);

  const onEvents = React.useCallback((ev) => {
    accRef.current.deaths     += ev.deaths.length;
    accRef.current.collisions += ev.collisions.length;
    accRef.current.births     += ev.births?.length || 0;
    accRef.current.hybrids    += ev.hybrids?.length || 0;
    accRef.current.wilds      += ev.wilds?.length || 0;
  }, []);

  const onTick = React.useCallback((s) => {
    accRef.current.tick = s.tick;
    // Throttle React updates — every 10 ticks is plenty.
    if (s.tick % 10 === 0) {
      const alive = s.ants.filter((a) => !a.dead).length;
      setLiveStats({
        tick: s.tick, totalAnts: alive,
        deaths: accRef.current.deaths, collisions: accRef.current.collisions,
        births: accRef.current.births, hybrids: accRef.current.hybrids, wilds: accRef.current.wilds,
      });
    }
  }, []);

  return (
    <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: (T.textMuted), letterSpacing: 2, textTransform: 'uppercase' }}>{tx('sandbox.section.world', 'simulation')}</span>
          <SbPill color={paused ? T.warning : T.success} filled>{paused ? 'paused' : 'live'}</SbPill>
          <SbPill color={T.info}>tick {liveStats.tick.toLocaleString()}</SbPill>
          <SbPill color={T.accent}>{effectiveTps} tps</SbPill>
          <SbPill color="#C77DFF">{liveStats.totalAnts} ants</SbPill>
        </div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: T.textDim }}>
          ◇ events: {liveStats.collisions}c · {liveStats.deaths}d
          {' · cooldown ' + (config.collisionCooldownTicks ?? 5) + 't'}
        </div>
      </div>

      <div style={{
        flex: 1, position: 'relative', borderRadius: 12,
        border: '1px solid rgba(255,255,255,.08)',
        background: config.bgColor || '#0A081A',
        overflow: 'hidden', minHeight: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {window.LangtonField ? (
          <LangtonField
            w={config.width}
            h={config.height}
            cellSize={cellSize}
            ants={ants}
            palette={palette}
            tps={effectiveTps}
            paused={paused}
            glow={config.showGlow}
            showTrail={config.showTrails}
            antScale={config.antScale}
            bg={config.bgColor || '#0A081A'}
            collisionCooldownTicks={config.collisionCooldownTicks ?? 5}
            birthConfig={config.birthEnabled ? {
              enabled: true,
              minNeighbors:     config.birthMinNeighbors,
              cooldownTicks:    config.birthCooldownTicks,
              maxAntsPerPlayer: config.maxAntsPerPlayer,
              hybridChance:     config.hybridChance,
              wildChance:       config.wildBirthChance,
            } : null}
            onEvents={onEvents}
            onTick={onTick}
          />
        ) : (
          <div style={{ color: (T.textMuted), fontSize: 12 }}>LangtonField not loaded</div>
        )}
        <div style={{
          position: 'absolute', bottom: 12, right: 12,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
          color: T.textDim, background: 'rgba(14,11,31,.6)',
          padding: '4px 8px', borderRadius: 4, backdropFilter: 'blur(4px)',
        }}>{config.width}×{config.height} · {config.topology} · seed {config.seed}</div>
      </div>
    </div>
  );
}

function TransportBar({ paused, config, sim, A, set }) {
  return (
    <div style={{
      height: 64, borderTop: '1px solid rgba(255,255,255,.06)',
      background: '#0F0C22', padding: '0 20px',
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <button onClick={paused ? A.onSandboxPlay : A.onSandboxPause}
        style={{
          width: 44, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
          background: (T.accent), color: (T.bg), fontWeight: 700, fontSize: 14,
        }}>{paused ? '▶' : '||'}</button>
      <button onClick={A.onSandboxStep} disabled={!paused}
        style={{
          width: 40, height: 36, borderRadius: 8, cursor: paused ? 'pointer' : 'not-allowed',
          background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.10)',
          color: paused ? (T.textPrimary) : T.textDim, fontSize: 14,
        }} title="Step 1 tick">›|</button>
      <button onClick={A.onSandboxReset}
        style={{
          width: 40, height: 36, borderRadius: 8, cursor: 'pointer',
          background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.10)',
          color: (T.textPrimary), fontSize: 13,
        }} title="Reset">⟲</button>

      <div style={{ width: 1, height: 28, background: (T.border), margin: '0 4px' }} />

      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: (T.textMuted) }}>speed</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {[0.25, 0.5, 1, 2, 4, 8, 16].map((m) => (
          <button key={m} onClick={() => set('speedMultiplier', m)} style={{
            cursor: 'pointer', border: 'none', borderRadius: 6,
            background: config.speedMultiplier === m ? (T.accent) : 'rgba(255,255,255,.04)',
            color: config.speedMultiplier === m ? (T.bg) : T.textSecondary,
            padding: '6px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600,
          }}>×{m}</button>
        ))}
      </div>

      <div style={{ width: 1, height: 28, background: (T.border), margin: '0 4px' }} />

      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: (T.textMuted) }}>tps</span>
      <SbNumber value={config.baseTps} min={1} max={60} onChange={(v) => set('baseTps', v)} width={56} />

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <button onClick={A.onSandboxExportConfig} style={btnSm()}>↓ Export</button>
        <button onClick={A.onSandboxImportConfig} style={btnSm()}>↑ Import</button>
        <button onClick={() => A.onSandboxSaveSlot?.('untitled')} style={btnSm((T.accent), true)}>Save slot</button>
      </div>
    </div>
  );
}

function btnSm(color = null, filled = false) {
  return {
    appearance: 'none', cursor: 'pointer',
    background: filled ? color : 'rgba(255,255,255,.04)',
    border: filled ? 'none' : '1px solid rgba(255,255,255,.10)',
    color: filled ? (T.bg) : (T.textPrimary),
    padding: '7px 12px', borderRadius: 6,
    fontWeight: 600, fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase',
    fontFamily: 'Inter, sans-serif',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Right — stats + presets
// ─────────────────────────────────────────────────────────────────────────────

function SandboxStatsPanel({ sim, config, presets, savedSlots, A, set }) {
  return (
    <div style={{
      width: 320, background: '#0F0C22',
      borderLeft: '1px solid rgba(255,255,255,.06)',
      overflow: 'auto', display: 'flex', flexDirection: 'column',
    }}>
      {/* Players */}
      <div style={{ padding: '14px 0 8px' }}>
        <div style={{ padding: '0 14px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: (T.textMuted), letterSpacing: 2, textTransform: 'uppercase' }}>players</div>
          <button onClick={A.onSandboxAddPlayer} style={{
            ...btnSm(), padding: '3px 8px', fontSize: 10,
          }}>+ Add</button>
        </div>
        {config.players.map((p, i) => (
          <div key={i} style={{
            margin: '0 12px 8px', padding: 10, borderRadius: 8,
            background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: p.color, boxShadow: `0 0 8px ${p.color}80` }}/>
              <span style={{ fontSize: 12, fontWeight: 600, color: (T.textPrimary) }}>player {i + 1}</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: (T.accent) }}>
                {sim.stats[i] ? (sim.stats[i].cellsPercent * 100).toFixed(1) : '0.0'}%
              </span>
              <button onClick={() => A.onSandboxRemovePlayer?.(i)} style={{
                background: 'transparent', border: 'none', color: T.textDim,
                cursor: 'pointer', fontSize: 14, padding: 0, marginLeft: 4,
              }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
              <div>
                <div style={{ color: T.textDim, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase' }}>rule</div>
                <SbSelect value={p.ruleId} onChange={(v) => A.onSandboxPlayerChange?.(i, { ruleId: v })}
                  options={RULES_REGISTRY.map((r) => ({ value: r.id, label: r.label.toLowerCase() }))} width="100%"/>
              </div>
              <div>
                <div style={{ color: T.textDim, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase' }}>ants</div>
                <SbNumber value={p.antCount} min={1} max={20}
                  onChange={(v) => A.onSandboxPlayerChange?.(i, { antCount: v })} width={56} />
              </div>
              <div>
                <div style={{ color: T.textDim, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase' }}>spawn</div>
                <SbSelect value={p.spawnPattern} onChange={(v) => A.onSandboxPlayerChange?.(i, { spawnPattern: v })}
                  options={[
                    { value: 'radial', label: 'radial' }, { value: 'corner', label: 'corner' },
                    { value: 'random', label: 'random' }, { value: 'cluster', label: 'cluster' },
                    { value: 'center', label: 'center' },
                  ]} width="100%"/>
              </div>
              <div>
                <div style={{ color: T.textDim, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase' }}>hp</div>
                <SbNumber value={p.startHp} min={1} max={10}
                  onChange={(v) => A.onSandboxPlayerChange?.(i, { startHp: v })} width={56} />
              </div>
            </div>
            <div style={{
              marginTop: 8, height: 3, background: (T.border), borderRadius: 999, overflow: 'hidden',
            }}>
              <div style={{
                width: `${(sim.stats[i]?.cellsPercent || 0) * 100}%`,
                height: '100%', background: p.color,
                boxShadow: `0 0 8px ${p.color}80`,
              }}/>
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: (T.border), margin: '8px 0' }}/>

      {/* Presets */}
      <div style={{ padding: '0 0 12px' }}>
        <div style={{ padding: '6px 14px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: (T.textMuted), letterSpacing: 2, textTransform: 'uppercase' }}>presets</div>
        {presets.map((p) => (
          <button key={p.id} onClick={() => A.onSandboxLoadPreset?.(p.id)} style={{
            display: 'block', width: 'calc(100% - 24px)', margin: '0 12px 6px',
            textAlign: 'left', cursor: 'pointer',
            background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
            padding: '8px 12px', borderRadius: 6, color: (T.textPrimary),
            fontFamily: 'Inter, sans-serif',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</div>
            <div style={{ fontSize: 10, color: (T.textMuted), marginTop: 2, lineHeight: 1.4 }}>{p.description}</div>
          </button>
        ))}
      </div>

      <div style={{ height: 1, background: (T.border), margin: '0 0 8px' }}/>

      {/* Saved slots */}
      <div style={{ padding: '4px 14px 16px' }}>
        <div style={{ padding: '6px 0 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: (T.textMuted), letterSpacing: 2, textTransform: 'uppercase' }}>saved</div>
        {savedSlots.length === 0 ? (
          <div style={{ fontSize: 11, color: T.textDim, fontStyle: 'italic', padding: '8px 0' }}>No saved slots yet.</div>
        ) : (
          savedSlots.map((s) => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.04)',
            }}>
              <span style={{ fontSize: 12, color: (T.textPrimary) }}>{s.name}</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: T.textDim }}>
                {new Date(s.savedAt).toLocaleDateString()}
              </span>
              <button onClick={() => A.onSandboxLoadSlot?.(s.id)}
                style={{ background: 'transparent', border: 'none', color: (T.accent), cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>LOAD</button>
              <button onClick={() => A.onSandboxDeleteSlot?.(s.id)}
                style={{ background: 'transparent', border: 'none', color: T.textDim, cursor: 'pointer', fontSize: 13 }}>×</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top bar
// ─────────────────────────────────────────────────────────────────────────────

function SandboxTopBar({ A }) {
  return (
    <div style={{
      height: 56, padding: '0 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: '1px solid rgba(255,255,255,.06)', background: (T.bg),
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <button onClick={A.onReturnToMenu} style={{
          appearance: 'none', cursor: 'pointer', background: 'transparent',
          border: '1px solid rgba(255,255,255,.10)', color: (T.textPrimary),
          width: 32, height: 32, borderRadius: 8, fontSize: 14,
        }}>←</button>
        <Logo size={18} />
        <span style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
          color: (T.textMuted), letterSpacing: 2, textTransform: 'uppercase',
        }}>· sandbox · web only</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: T.textDim }}>local · no upload</span>
        <PingIndicator pingMs={2} jitter={1} compact />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function SandboxDesktop({ width = 1280, height = 800, data, actions }) {
  const S = data || defaultState();
  const A = actions || defaultActions();
  const t = (window.useT && window.useT()) || ((k) => k);
  const tx = (key, fallback) => { const out = t(key); return out === key ? fallback : out; };
  const sandbox = S.sandbox || defaultSandbox();
  const [, force] = React.useReducer((x) => x + 1, 0);

  const set = (key, value) => {
    sandbox.config[key] = value;
    A.onSandboxConfigChange?.({ [key]: value });
    force();
  };

  return (
    <Screen width={width} height={height}>
      <GlobalStyle />
      <SandboxTopBar A={A} />

      <div style={{ display: 'flex', height: height - 56 - 64 }}>
        <ConfigPanel config={sandbox.config} set={set} />
        <SandboxField config={sandbox.config} sim={sandbox.simulation} paused={sandbox.ui.paused} />
        <SandboxStatsPanel
          sim={sandbox.simulation}
          config={sandbox.config}
          presets={sandbox.presets}
          savedSlots={sandbox.savedSlots}
          A={A}
          set={set}
        />
      </div>

      <TransportBar paused={sandbox.ui.paused} config={sandbox.config} sim={sandbox.simulation} A={A} set={set} />

      <SystemOverlays data={S} actions={A} />
    </Screen>
  );
}

Object.assign(window, { SandboxDesktop });
