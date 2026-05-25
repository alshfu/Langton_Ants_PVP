// src/screens/sandbox/AntsTab.tsx
//
// Список муравьёв активного игрока. По клику — подсветка + развёрнутый редактор:
// X, Y, dir, rule override. Можно удалить, можно сменить активного игрока.

import { useTheme } from '@theme/ThemeProvider';
import { useAppState } from '@state/AppStateProvider';
import { RULES_REGISTRY } from '@core/shared/constants';
import type { SandboxAntConfig } from '@core/contract/state';
import { Slider } from '@ui/Slider';
import { Section, Field, Select, IconButton, PlayerSwatch } from './_shared';

const DIR_NAMES: Record<0 | 1 | 2 | 3, string> = { 0: 'N ↑', 1: 'E →', 2: 'S ↓', 3: 'W ←' };

export function AntsTab() {
  const { tokens: T } = useTheme();
  const { state, sandbox: sx } = useAppState();
  const { players, width, height } = state.sandbox;
  const activeId = state.sandboxRuntime.activePlayerId;
  const selectedId = state.sandboxRuntime.selectedAntId;

  const activePlayer = players.find((p) => p.id === activeId) ?? null;
  const selectedAnt = activePlayer?.ants.find((a) => a.id === selectedId) ?? null;

  return (
    <div>
      {/* Player switcher */}
      <Section title="Active player">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))',
          gap: 4,
        }}>
          {players.map((p) => (
            <button
              key={p.id}
              onClick={() => sx.setActivePlayer(p.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 8px',
                background: activeId === p.id ? T.accentMuted : T.bgOverlay,
                border: `1px solid ${activeId === p.id ? T.accent : T.border}`,
                borderRadius: T.radiusSm,
                cursor: 'pointer',
                fontSize: 11, color: T.textPrimary,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              <PlayerSwatch color={p.color} size={10} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Ant list */}
      {activePlayer ? (
        <Section
          title={`Ants · ${activePlayer.ants.length}`}
          right={
            activePlayer.spawnPattern === 'manual' ? (
              <span style={{ fontSize: 10, color: T.textMuted, fontFamily: 'JetBrains Mono, monospace' }}>
                Click canvas to add
              </span>
            ) : (
              <span style={{ fontSize: 10, color: T.textDim, fontFamily: 'JetBrains Mono, monospace' }}>
                pattern: {activePlayer.spawnPattern}
              </span>
            )
          }
        >
          {activePlayer.ants.length === 0 && (
            <div style={{
              padding: 16, fontSize: 11, color: T.textMuted,
              textAlign: 'center', fontFamily: 'JetBrains Mono, monospace',
              border: `1px dashed ${T.border}`, borderRadius: T.radiusSm,
            }}>
              No ants yet. Switch to <strong>Edit mode</strong> and click on the canvas.
            </div>
          )}

          <div style={{
            maxHeight: 240,
            overflow: 'auto',
            border: activePlayer.ants.length > 0 ? `1px solid ${T.border}` : 'none',
            borderRadius: T.radiusSm,
          }}>
            {activePlayer.ants.map((a) => {
              const isSelected = selectedId === a.id;
              return (
                <div
                  key={a.id}
                  onClick={() => sx.setSelectedAnt(isSelected ? null : a.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px',
                    background: isSelected ? T.accentMuted : 'transparent',
                    borderBottom: `1px solid ${T.border}`,
                    cursor: 'pointer',
                    fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  <PlayerSwatch color={activePlayer.color} size={8} />
                  <span style={{ flex: 1 }}>
                    ({a.x},{a.y}) {DIR_NAMES[a.dir]}
                  </span>
                  {a.ruleOverride && (
                    <span style={{ fontSize: 9, color: T.warning }}>
                      {a.ruleOverride}
                    </span>
                  )}
                  <IconButton
                    onClick={() => sx.removeAnt(a.id)}
                    title="Remove"
                    variant="danger"
                  >×</IconButton>
                </div>
              );
            })}
          </div>
        </Section>
      ) : (
        <div style={{ padding: 16, color: T.textMuted, fontSize: 11 }}>
          No active player.
        </div>
      )}

      {/* Selected ant editor */}
      {selectedAnt && activePlayer && (
        <Section title={`Edit ant ${selectedAnt.id}`}>
          <AntEditor ant={selectedAnt} maxW={width - 1} maxH={height - 1} />
        </Section>
      )}
    </div>
  );
}

function AntEditor({ ant, maxW, maxH }: { ant: SandboxAntConfig; maxW: number; maxH: number }) {
  const { tokens: T } = useTheme();
  const { sandbox: sx } = useAppState();
  const patch = (p: Partial<SandboxAntConfig>) => sx.patchAnt(ant.id, p);

  return (
    <div style={{
      padding: 12,
      background: T.bgOverlay,
      borderRadius: T.radiusSm,
      border: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <Field label="X position" hint={`${ant.x}`}>
        <Slider value={ant.x} min={0} max={maxW} onChange={(v) => patch({ x: Math.round(v) })} />
      </Field>
      <Field label="Y position" hint={`${ant.y}`}>
        <Slider value={ant.y} min={0} max={maxH} onChange={(v) => patch({ y: Math.round(v) })} />
      </Field>
      <Field label="Direction">
        <div style={{ display: 'flex', gap: 4 }}>
          {[0, 1, 2, 3].map((d) => (
            <button
              key={d}
              onClick={() => patch({ dir: d as 0 | 1 | 2 | 3 })}
              style={{
                flex: 1, padding: '6px 8px',
                background: ant.dir === d ? T.accent : T.bgOverlay,
                color: ant.dir === d ? T.bg : T.textPrimary,
                border: `1px solid ${T.border}`,
                borderRadius: T.radiusSm,
                fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 600, cursor: 'pointer',
              }}
            >{DIR_NAMES[d as 0 | 1 | 2 | 3]}</button>
          ))}
        </div>
      </Field>
      <Field label="Rule override" hint="overrides player's rule for this ant">
        <Select
          value={ant.ruleOverride ?? '__none__'}
          onChange={(v) => patch({ ruleOverride: v === '__none__' ? null : v })}
          options={[
            { value: '__none__', label: '— Use player rule —' },
            ...RULES_REGISTRY.map((r) => ({
              value: r.id, label: `${r.label} · ${r.pattern}`,
            })),
          ]}
        />
      </Field>
    </div>
  );
}
