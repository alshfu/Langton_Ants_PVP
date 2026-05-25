// src/screens/sandbox/PlayersTab.tsx
//
// Список игроков 2-10 с возможностью добавить/удалить/редактировать.
// Карточка игрока разворачивается по клику и показывает все его параметры.

import { useState } from 'react';
import { useTheme } from '@theme/ThemeProvider';
import { useAppState } from '@state/AppStateProvider';
import { RULES_REGISTRY, PLAYER_PALETTE } from '@core/shared/constants';
import type { SandboxPlayerConfig, SpawnPattern } from '@core/contract/state';
import { Button } from '@ui/Button';
import { Slider } from '@ui/Slider';
import { Section, Field, Select, IconButton, PlayerSwatch } from './_shared';

const SPAWN_OPTIONS: Array<{ value: SpawnPattern; label: string }> = [
  { value: 'radial',  label: 'Radial — round center' },
  { value: 'corner',  label: 'Corner — assigned corner' },
  { value: 'cluster', label: 'Cluster — own zone' },
  { value: 'center',  label: 'Center — near middle' },
  { value: 'random',  label: 'Random — seeded random' },
  { value: 'manual',  label: 'Manual — place yourself' },
];

export function PlayersTab() {
  const { tokens: T } = useTheme();
  const { state, sandbox: sx } = useAppState();
  const { players } = state.sandbox;
  const activeId = state.sandboxRuntime.activePlayerId;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const canAdd = players.length < 10;
  const canRemove = players.length > 2;

  return (
    <div>
      <Section
        title={`Players · ${players.length} / 10`}
        right={
          <IconButton
            onClick={() => sx.addPlayer()}
            title="Add player"
            variant="primary"
            disabled={!canAdd}
          >+</IconButton>
        }
      >
        {players.map((p) => {
          const isExpanded = expandedId === p.id;
          const isActive = activeId === p.id;
          return (
            <div
              key={p.id}
              style={{
                border: `1px solid ${isActive ? T.accent : T.border}`,
                borderRadius: T.radiusSm,
                background: isActive ? T.accentMuted : T.bgOverlay,
                overflow: 'hidden',
              }}
            >
              {/* Заголовок — всегда видим */}
              <div
                onClick={() => sx.setActivePlayer(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px',
                  cursor: 'pointer',
                }}
              >
                <PlayerSwatch color={p.color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 10, color: T.textMuted, fontFamily: 'JetBrains Mono, monospace' }}>
                    {p.ruleId} · {p.spawnPattern} · ×{p.ants.length}
                  </div>
                </div>
                <IconButton
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  title={isExpanded ? 'Collapse' : 'Expand'}
                >{isExpanded ? '−' : '✎'}</IconButton>
                <IconButton
                  onClick={() => sx.removePlayer(p.id)}
                  title="Remove player"
                  variant="danger"
                  disabled={!canRemove}
                >×</IconButton>
              </div>

              {/* Развёрнутая карточка */}
              {isExpanded && <PlayerEditor player={p} />}
            </div>
          );
        })}
      </Section>

      {!canAdd && (
        <div style={{
          padding: 8, fontSize: 10, color: T.textMuted,
          fontFamily: 'JetBrains Mono, monospace', textAlign: 'center',
        }}>
          Max 10 players reached
        </div>
      )}
      {!canRemove && (
        <div style={{
          padding: 8, fontSize: 10, color: T.textMuted,
          fontFamily: 'JetBrains Mono, monospace', textAlign: 'center',
        }}>
          Min 2 players required
        </div>
      )}
    </div>
  );
}

function PlayerEditor({ player }: { player: SandboxPlayerConfig }) {
  const { tokens: T } = useTheme();
  const { sandbox: sx } = useAppState();
  const patch = (p: Partial<SandboxPlayerConfig>) => sx.patchPlayer(player.id, p);

  const isManual = player.spawnPattern === 'manual';

  return (
    <div style={{
      padding: '12px 10px',
      borderTop: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Name */}
      <Field label="Name">
        <input
          type="text"
          value={player.name}
          maxLength={20}
          onChange={(e) => patch({ name: e.target.value })}
          style={{
            background: T.bg, color: T.textPrimary,
            border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
            padding: '4px 8px', fontSize: 12,
          }}
        />
      </Field>

      {/* Color palette */}
      <Field label="Color">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {PLAYER_PALETTE.map((c) => (
            <button
              key={c.id}
              onClick={() => patch({ color: c.hex })}
              title={c.name}
              style={{
                width: 20, height: 20, borderRadius: 4,
                background: c.hex,
                border: player.color === c.hex
                  ? `2px solid ${T.textPrimary}`
                  : `1px solid ${T.border}`,
                cursor: 'pointer', padding: 0,
              }}
            />
          ))}
        </div>
      </Field>

      {/* Rule */}
      <Field label="Rule">
        <Select
          value={player.ruleId}
          onChange={(v) => patch({ ruleId: v })}
          options={RULES_REGISTRY.map((r) => ({
            value: r.id, label: `${r.label} · ${r.pattern}`,
          }))}
        />
      </Field>

      {/* Start HP */}
      <Field label="Start HP" hint={`${player.startHp}`}>
        <Slider
          value={player.startHp} min={1} max={10}
          onChange={(v) => patch({ startHp: Math.round(v) })}
        />
      </Field>

      {/* Spawn pattern */}
      <Field label="Spawn pattern">
        <Select<SpawnPattern>
          value={player.spawnPattern}
          onChange={(v) => patch({ spawnPattern: v })}
          options={SPAWN_OPTIONS}
        />
      </Field>

      {/* Ant count */}
      <Field
        label={isManual ? "Ant count (manual: place by clicking)" : "Ant count"}
        hint={isManual ? `${player.ants.length}` : `${player.antCount}`}
      >
        <Slider
          value={player.antCount} min={1} max={10}
          onChange={(v) => patch({ antCount: Math.round(v) })}
        />
      </Field>

      {/* Re-spawn button */}
      <Button
        variant="ghost" size="sm"
        onClick={() => sx.respawnAntsForPlayer(player.id)}
        style={{ opacity: isManual ? 0.5 : 1 }}
      >
        {isManual ? 'Switch from manual to re-spawn' : '↻ Re-spawn ants now'}
      </Button>
    </div>
  );
}
