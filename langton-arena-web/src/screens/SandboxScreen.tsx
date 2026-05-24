// src/screens/SandboxScreen.tsx
//
// Полностью рабочая песочница: live-симуляция Лэнгтона, ползунки управляют параметрами,
// можно паузить, сбрасывать, менять seed.
//
// Layout: слева — большая canvas-область с полем; справа — панель настроек.
// Снизу — transport bar (play/pause/step/reset, speed).

import { useState, useMemo, useCallback, useRef } from 'react';
import { useTheme } from '@theme/ThemeProvider';
import { useT } from '@i18n/I18nProvider';
import { useAppState } from '@state/AppStateProvider';
import { LangtonField } from '@components/LangtonField';
import { LA_RULES } from '@core/langton/rules';
import { RULES_REGISTRY } from '@core/shared/constants';
import { Button } from '@ui/Button';
import { Eyebrow } from '@ui/Eyebrow';
import { Mono } from '@ui/Mono';
import { Chip } from '@ui/Chip';
import { Slider } from '@ui/Slider';
import { Toggle } from '@ui/Toggle';

import type { Ant, BirthConfig, SimState, StepEvents } from '@core/langton/engine';

export function SandboxScreen() {
  const { tokens: T } = useTheme();
  const t = useT();
  const { state, patchSandbox, resetSandbox, setScreen } = useAppState();
  const cfg = state.sandbox;

  const [paused, setPaused] = useState(false);
  const [liveStats, setLiveStats] = useState({ tick: 0, alive: 0, deaths: 0, collisions: 0, births: 0 });
  const counters = useRef({ deaths: 0, collisions: 0, births: 0 });

  // Регенерируем начальные муравьи когда меняются параметры посева
  const ants = useMemo<Ant[]>(() => {
    const list: Ant[] = [];
    let s = cfg.seed || 1;
    const rand = (): number => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

    cfg.players.forEach((p, pi) => {
      const rulePattern = LA_RULES[p.ruleId] ?? LA_RULES.classic!;
      for (let i = 0; i < p.antCount; i++) {
        let x = 0, y = 0;
        if (p.spawnPattern === 'corner') {
          const corner = pi % 4;
          x = corner % 2 === 0 ? 2 + i : cfg.width - 3 - i;
          y = corner < 2     ? 2 + i : cfg.height - 3 - i;
        } else if (p.spawnPattern === 'center') {
          x = Math.floor(cfg.width / 2) + (i - p.antCount / 2);
          y = Math.floor(cfg.height / 2);
        } else if (p.spawnPattern === 'cluster') {
          const cx = (pi + 1) * cfg.width / (cfg.players.length + 1);
          x = Math.floor(cx + (rand() - 0.5) * 6);
          y = Math.floor(cfg.height / 2 + (rand() - 0.5) * 6);
        } else if (p.spawnPattern === 'random') {
          x = Math.floor(rand() * cfg.width);
          y = Math.floor(rand() * cfg.height);
        } else {
          const angle = ((pi * p.antCount + i) / (cfg.players.length * p.antCount)) * Math.PI * 2;
          const radius = Math.min(cfg.width, cfg.height) * 0.35;
          x = Math.floor(cfg.width / 2 + Math.cos(angle) * radius);
          y = Math.floor(cfg.height / 2 + Math.sin(angle) * radius);
        }
        x = Math.max(0, Math.min(cfg.width - 1, x));
        y = Math.max(0, Math.min(cfg.height - 1, y));
        list.push({
          id: `p${pi}_a${i}`,
          owner: pi,
          x, y,
          dir: (pi % 4) as 0 | 1 | 2 | 3,
          rule: rulePattern,
          hp: p.startHp,
          maxHp: p.startHp,
          lastDamageTick: -9999,
          bornAt: 0,
        });
      }
    });
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(cfg.players), cfg.width, cfg.height, cfg.seed]);

  const palette = useMemo(() => cfg.players.map((p) => p.color), [cfg.players]);

  const birthConfig: BirthConfig | null = useMemo(() => {
    if (!cfg.birthEnabled) return null;
    return {
      enabled: true,
      minNeighbors:     cfg.birthMinNeighbors,
      cooldownTicks:    cfg.birthCooldownTicks,
      maxAntsPerPlayer: cfg.maxAntsPerPlayer,
      hybridChance:     cfg.hybridChance,
      wildChance:       cfg.wildBirthChance,
    };
  }, [cfg.birthEnabled, cfg.birthMinNeighbors, cfg.birthCooldownTicks, cfg.maxAntsPerPlayer, cfg.hybridChance, cfg.wildBirthChance]);

  const effectiveTps = cfg.baseTps * cfg.speedMultiplier;

  // Размер ячейки автоматически по доступной ширине canvas-области
  const cellSize = Math.max(4, Math.min(16, Math.floor(900 / cfg.width)));

  const onEvents = useCallback((ev: StepEvents) => {
    counters.current.deaths     += ev.deaths.length;
    counters.current.collisions += ev.collisions.length;
    counters.current.births     += ev.births.length;
  }, []);

  const onTick = useCallback((s: SimState) => {
    if (s.tick % 10 === 0) {
      const alive = s.ants.filter((a) => !a.dead).length;
      setLiveStats({
        tick: s.tick, alive,
        deaths: counters.current.deaths,
        collisions: counters.current.collisions,
        births: counters.current.births,
      });
    }
  }, []);

  const onReset = () => {
    counters.current = { deaths: 0, collisions: 0, births: 0 };
    setLiveStats({ tick: 0, alive: ants.length, deaths: 0, collisions: 0, births: 0 });
    // Меняем seed чтобы пересоздать sim
    patchSandbox({ seed: cfg.seed + 1 });
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: '100vw', height: '100vh',
      background: T.bg, color: T.textPrimary,
    }}>
      {/* ─── Top bar ──────────────────────────────────────────────────────── */}
      <div style={{
        height: 56, padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${T.border}`, background: T.bgElevated,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Button variant="ghost" size="sm" onClick={() => setScreen('menu')}>
            ← {t('common.back', 'Back')}
          </Button>
          <Eyebrow>· {t('sandbox.title', 'Sandbox')}</Eyebrow>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Chip color={paused ? T.warning : T.success} filled size="sm">
            {paused ? 'paused' : 'live'}
          </Chip>
          <Chip color={T.info} size="sm">{t('sandbox.label.tick', 'tick')} {liveStats.tick.toLocaleString()}</Chip>
          <Chip color={T.accent} size="sm">{effectiveTps} {t('sandbox.label.tps', 'TPS')}</Chip>
          <Chip color="#C77DFF" size="sm">{liveStats.alive} {t('sandbox.label.ants', 'ants')}</Chip>
        </div>
      </div>

      {/* ─── Main: canvas slева, panel справа ─────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{
          flex: 1, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          padding: 20, minWidth: 0,
        }}>
          <LangtonField
            w={cfg.width}
            h={cfg.height}
            cellSize={cellSize}
            ants={ants}
            palette={palette}
            tps={effectiveTps}
            paused={paused}
            glow={cfg.showGlow}
            showTrail={cfg.showTrails}
            showHpDots={cfg.showHpDots}
            antScale={cfg.antScale}
            bg={cfg.bgColor}
            seed={cfg.seed}
            collisionCooldownTicks={cfg.collisionCooldownTicks}
            birthConfig={birthConfig}
            onEvents={onEvents}
            onTick={onTick}
          />
        </div>

        {/* ─── Settings panel ──────────────────────────────────────────────── */}
        <div style={{
          width: 320, padding: 20,
          borderLeft: `1px solid ${T.border}`,
          background: T.bgElevated,
          overflow: 'auto',
          display: 'flex', flexDirection: 'column', gap: 24,
        }}>
          {/* Field */}
          <Section title={t('sandbox.section.field', 'Field')}>
            <Slider label="Width"  value={cfg.width}  min={20} max={150} onChange={(v) => patchSandbox({ width: Math.round(v) })} suffix={` cells`} />
            <Slider label="Height" value={cfg.height} min={20} max={120} onChange={(v) => patchSandbox({ height: Math.round(v) })} suffix={` cells`} />
            <Slider label="Seed"   value={cfg.seed}   min={1}  max={9999} onChange={(v) => patchSandbox({ seed: Math.round(v) })} />
          </Section>

          {/* Players */}
          <Section title={t('sandbox.section.players', 'Players')}>
            {cfg.players.map((p, idx) => (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 0', borderBottom: `1px solid ${T.border}`,
              }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, background: p.color }} />
                <select
                  value={p.ruleId}
                  onChange={(e) => {
                    const newPlayers = [...cfg.players];
                    newPlayers[idx] = { ...p, ruleId: e.target.value };
                    patchSandbox({ players: newPlayers });
                  }}
                  style={{
                    flex: 1, background: T.bgOverlay, color: T.textPrimary,
                    border: `1px solid ${T.border}`, borderRadius: 6,
                    padding: '4px 8px', fontSize: 11,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {RULES_REGISTRY.map((r) => (
                    <option key={r.id} value={r.id}>{r.label} · {r.pattern}</option>
                  ))}
                </select>
                <Mono size={10} color={T.textMuted}>×{p.antCount}</Mono>
              </div>
            ))}
          </Section>

          {/* Birth */}
          <Section title={t('sandbox.section.birth', 'Birth')}>
            <Toggle on={cfg.birthEnabled} onChange={(v) => patchSandbox({ birthEnabled: v })} label="Enabled" />
            <Slider label="Min neighbours" value={cfg.birthMinNeighbors} min={1} max={8} onChange={(v) => patchSandbox({ birthMinNeighbors: Math.round(v) })} />
            <Slider label="Cooldown"       value={cfg.birthCooldownTicks} min={10} max={300} onChange={(v) => patchSandbox({ birthCooldownTicks: Math.round(v) })} suffix="t" />
            <Slider label="Max ants/player" value={cfg.maxAntsPerPlayer} min={1} max={25} onChange={(v) => patchSandbox({ maxAntsPerPlayer: Math.round(v) })} />
            <Slider label="Hybrid chance"  value={cfg.hybridChance} min={0} max={1} step={0.01} onChange={(v) => patchSandbox({ hybridChance: v })} />
            <Slider label="Wild chance"    value={cfg.wildBirthChance} min={0} max={0.5} step={0.01} onChange={(v) => patchSandbox({ wildBirthChance: v })} />
          </Section>

          {/* Combat */}
          <Section title={t('sandbox.section.combat', 'Combat')}>
            <Slider label="Clash cooldown" value={cfg.collisionCooldownTicks} min={0} max={50} onChange={(v) => patchSandbox({ collisionCooldownTicks: Math.round(v) })} suffix="t" />
          </Section>

          {/* Visual */}
          <Section title={t('sandbox.section.visual', 'Visual')}>
            <Toggle on={cfg.showGlow}    onChange={(v) => patchSandbox({ showGlow: v })}    label="Glow" />
            <Toggle on={cfg.showTrails}  onChange={(v) => patchSandbox({ showTrails: v })}  label="Trails" />
            <Toggle on={cfg.showHpDots}  onChange={(v) => patchSandbox({ showHpDots: v })}  label="HP dots" />
            <Slider label="Ant scale" value={cfg.antScale} min={0.3} max={1.5} step={0.05} onChange={(v) => patchSandbox({ antScale: v })} />
          </Section>

          {/* Events counter */}
          <Section title="Live stats">
            <Mono size={11} color={T.textMuted}>deaths · {liveStats.deaths}</Mono>
            <Mono size={11} color={T.textMuted}>collisions · {liveStats.collisions}</Mono>
            <Mono size={11} color={T.textMuted}>births · {liveStats.births}</Mono>
          </Section>
        </div>
      </div>

      {/* ─── Transport bar ───────────────────────────────────────────────── */}
      <div style={{
        height: 64, padding: '0 24px',
        display: 'flex', alignItems: 'center', gap: 14,
        borderTop: `1px solid ${T.border}`, background: T.bgElevated,
        flexShrink: 0,
      }}>
        <Button onClick={() => setPaused((p) => !p)} size="md">
          {paused ? '▶ ' + t('sandbox.button.play', 'Play') : '⏸ ' + t('sandbox.button.pause', 'Pause')}
        </Button>
        <Button variant="ghost" size="md" onClick={onReset}>
          ↺ {t('sandbox.button.reset', 'Reset')}
        </Button>
        <div style={{ width: 1, height: 28, background: T.border, margin: '0 8px' }} />
        <Eyebrow>speed</Eyebrow>
        <div style={{ display: 'flex', gap: 4 }}>
          {[0.25, 0.5, 1, 2, 4, 8, 16].map((m) => (
            <button
              key={m}
              onClick={() => patchSandbox({ speedMultiplier: m })}
              style={{
                padding: '6px 10px', minWidth: 38,
                borderRadius: 6,
                background: cfg.speedMultiplier === m ? T.accent : T.bgOverlay,
                color: cfg.speedMultiplier === m ? T.bg : T.textPrimary,
                border: `1px solid ${T.border}`,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11, fontWeight: 600,
                cursor: 'pointer',
              }}
            >{m}×</button>
          ))}
        </div>
        <div style={{ width: 1, height: 28, background: T.border, margin: '0 8px' }} />
        <Slider label="Base TPS" value={cfg.baseTps} min={1} max={60} onChange={(v) => patchSandbox({ baseTps: Math.round(v) })} />
        <div style={{ marginLeft: 'auto' }}>
          <Button variant="ghost" size="sm" onClick={() => { resetSandbox(); onReset(); }}>
            Reset all settings
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Eyebrow>{title}</Eyebrow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}
