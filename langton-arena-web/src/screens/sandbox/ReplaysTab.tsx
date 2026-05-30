// src/screens/sandbox/ReplaysTab.tsx
//
// Replays tab — управление записями сессий.
// Содержит:
//   1. CURRENT MATCH — статус текущей записи + кнопка Save
//   2. SAVED REPLAYS — список с Play / Delete (Export/Share — Day 59)

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@theme/ThemeProvider';
import { useAppState } from '@state/AppStateProvider';
import { Section, Field } from './_shared';
import {
  listReplays, saveReplay, loadReplay, deleteReplay,
  generateReplayId, REPLAYS_LIMIT,
} from '@lib/replayStorage';
import {
  listPublicReplays, fetchPublicReplay,
  type PublicReplayListItem,
} from '@lib/publicReplays';
import type { ReplayMetadata, Replay, DeployAction } from '@core/contract/replay';
import type { SandboxConfig } from '@core/contract/state';

export interface CurrentSession {
  /** Recording deploys в текущей сессии. */
  deploys: DeployAction[];
  /** Конфиг на момент старта сессии. */
  startConfig: SandboxConfig | null;
  /** Текущий тик. */
  currentTick: number;
}

export interface ReplaysTabProps {
  getCurrentSession: () => CurrentSession;
  onPlay: (replay: Replay) => void;
  onSaveSuccess?: (id: string) => void;
}

export function ReplaysTab({ getCurrentSession, onPlay, onSaveSuccess }: ReplaysTabProps) {
  const { tokens: T } = useTheme();
  const { state } = useAppState();
  const [savedList, setSavedList] = useState<ReplayMetadata[]>([]);
  const [saveName, setSaveName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refreshList = useCallback(() => {
    // Сортируем по createdAt descending (новые сверху)
    setSavedList(listReplays().sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const session = getCurrentSession();
  const recording = state.sandboxRuntime.mode === 'run';
  const canSave = recording && session.deploys.length > 0 && session.startConfig !== null;

  const handleSave = () => {
    setError(null);
    if (!canSave) return;
    if (!session.startConfig) {
      setError('No start config — cannot save');
      return;
    }
    const id = generateReplayId();
    const name = saveName.trim() || `Session at t${session.currentTick}`;
    const replay: Replay = {
      version: 1,
      metadata: {
        id,
        name,
        createdAt: Date.now(),
        durationTicks: session.currentTick,
        deployCount: session.deploys.length,
      },
      config: session.startConfig,
      deployTimeline: [...session.deploys],
    };
    const result = saveReplay(replay);
    if (!result.saved) {
      setError('Failed to save (localStorage full?)');
      return;
    }
    setSaveName('');
    refreshList();
    onSaveSuccess?.(id);
  };

  const handlePlay = (id: string) => {
    const replay = loadReplay(id);
    if (!replay) {
      setError('Could not load replay (corrupted?)');
      return;
    }
    onPlay(replay);
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete replay "${name}"?`)) return;
    deleteReplay(id);
    refreshList();
  };

  return (
    <div>
      <Section title="Current session">
        <div style={{
          padding: 10,
          background: recording ? '#FFD60A15' : T.bgOverlay,
          border: `1px ${recording ? 'solid' : 'dashed'} ${recording ? '#FFD60A' : T.border}`,
          borderRadius: T.radiusSm,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          marginBottom: 8,
        }}>
          {recording ? (
            <>
              <div style={{ color: '#FFD60A', fontWeight: 700, marginBottom: 4 }}>
                🔴 REC · tick {session.currentTick}
              </div>
              <div style={{ color: T.textMuted, fontSize: 10 }}>
                {session.deploys.length} deploy{session.deploys.length === 1 ? '' : 's'} recorded
              </div>
            </>
          ) : (
            <div style={{ color: T.textMuted, fontSize: 10 }}>
              Recording starts when you press Run
            </div>
          )}
        </div>

        {recording && (
          <>
            <Field label="Name (optional)">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder={`Session at t${session.currentTick}`}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  background: T.bgOverlay,
                  color: T.textPrimary,
                  border: `1px solid ${T.border}`,
                  borderRadius: T.radiusSm,
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono, monospace',
                  outline: 'none',
                }}
              />
            </Field>
            <button
              onClick={handleSave}
              disabled={!canSave}
              style={{
                marginTop: 6, width: '100%',
                padding: '8px 12px',
                background: canSave ? T.accent : T.bgOverlay,
                color: canSave ? T.bg : T.textMuted,
                border: 'none', borderRadius: T.radiusSm,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11, fontWeight: 700,
                cursor: canSave ? 'pointer' : 'not-allowed',
              }}
            >
              💾 Save replay
            </button>
            {!canSave && session.deploys.length === 0 && (
              <div style={{ marginTop: 4, fontSize: 9, color: T.textMuted, fontFamily: 'JetBrains Mono, monospace' }}>
                Need at least 1 deploy to save
              </div>
            )}
          </>
        )}

        {error && (
          <div style={{
            marginTop: 6, padding: 6,
            background: T.danger + '15',
            color: T.danger, fontSize: 10,
            border: `1px solid ${T.danger}`,
            borderRadius: T.radiusSm,
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {error}
          </div>
        )}
      </Section>

      {/* Stage 9.5: Public replays — fetched from server REST API */}
      <PublicReplaysSection onPlay={onPlay} />

      <Section title={`Saved replays (${savedList.length}/${REPLAYS_LIMIT})`}>
        {savedList.length === 0 ? (
          <div style={{
            padding: 12, textAlign: 'center',
            color: T.textMuted, fontSize: 10,
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            No saved replays yet. Make some deploys in Run mode then Save.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {savedList.map((m) => (
              <ReplayCard
                key={m.id}
                meta={m}
                onPlay={() => handlePlay(m.id)}
                onDelete={() => handleDelete(m.id, m.name)}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Stage 7 Day 59 — Export/Import/Share */}
      <Section title="Export / Share">
        <ReplayExportSection getReplay={loadReplay} list={savedList} onMessage={setError} />
      </Section>
    </div>
  );
}

// ─── Day 59: Share / Export для replay ───────────────────────────────────────

function ReplayExportSection({
  getReplay, list, onMessage,
}: {
  getReplay: (id: string) => Replay | null;
  list: ReplayMetadata[];
  onMessage: (msg: string) => void;
}) {
  const { tokens: T } = useTheme();
  const [selectedId, setSelectedId] = useState<string>('');

  const handleDownload = async () => {
    if (!selectedId) {
      onMessage('Select a replay first');
      return;
    }
    const replay = getReplay(selectedId);
    if (!replay) {
      onMessage('Could not load replay');
      return;
    }
    const { downloadJson } = await import('@lib/urlShare');
    const safeName = replay.metadata.name.replace(/[^a-z0-9-]/gi, '_').slice(0, 40);
    downloadJson(`replay-${safeName}.json`, replay);
  };

  const handleShareUrl = async () => {
    if (!selectedId) {
      onMessage('Select a replay first');
      return;
    }
    const replay = getReplay(selectedId);
    if (!replay) {
      onMessage('Could not load replay');
      return;
    }
    const { encodeReplayForUrl, buildShareUrl } = await import('@lib/urlShare');
    const encoded = encodeReplayForUrl(replay);
    const url = buildShareUrl(encoded, 'replay');
    if (url.length > 30000) {
      onMessage(`URL too long (${url.length} chars). Use Download instead.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      onMessage(`Copied URL (${url.length} chars)`);
    } catch {
      window.prompt('Copy this URL:', url);
    }
  };

  if (list.length === 0) {
    return (
      <div style={{
        fontSize: 10, color: T.textMuted,
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        Save a replay first to export or share.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        style={{
          padding: '6px 8px',
          background: T.bgOverlay, color: T.textPrimary,
          border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
        }}
      >
        <option value="">— Select replay —</option>
        {list.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      <button
        onClick={handleDownload}
        disabled={!selectedId}
        style={{
          padding: '6px 10px',
          background: selectedId ? T.accent : T.bgOverlay,
          color: selectedId ? T.bg : T.textMuted,
          border: 'none', borderRadius: T.radiusSm,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700,
          cursor: selectedId ? 'pointer' : 'not-allowed',
        }}
      >💾 Download .json</button>
      <button
        onClick={handleShareUrl}
        disabled={!selectedId}
        style={{
          padding: '6px 10px',
          background: selectedId ? T.info : T.bgOverlay,
          color: selectedId ? T.bg : T.textMuted,
          border: 'none', borderRadius: T.radiusSm,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700,
          cursor: selectedId ? 'pointer' : 'not-allowed',
        }}
      >🔗 Copy share URL</button>
    </div>
  );
}

function ReplayCard({
  meta, onPlay, onDelete,
}: {
  meta: ReplayMetadata;
  onPlay: () => void;
  onDelete: () => void;
}) {
  const { tokens: T } = useTheme();
  const ago = formatAgo(meta.createdAt);
  return (
    <div style={{
      padding: 8,
      background: T.bgOverlay,
      border: `1px solid ${T.border}`,
      borderRadius: T.radiusSm,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: T.textPrimary,
        fontFamily: 'JetBrains Mono, monospace',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {meta.name}
      </div>
      <div style={{
        marginTop: 2, fontSize: 9, color: T.textMuted,
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        {meta.deployCount} deploy{meta.deployCount === 1 ? '' : 's'} ·
        t{meta.durationTicks} · {ago}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <button onClick={onPlay} style={btnStyle(T.accent, T.bg, true)}>▶ Play</button>
        <button onClick={onDelete} style={btnStyle('transparent', T.danger, false)}>🗑</button>
      </div>
    </div>
  );
}

function btnStyle(bg: string, fg: string, primary: boolean): React.CSSProperties {
  return {
    flex: primary ? 1 : 0,
    padding: '5px 8px',
    background: bg,
    color: fg,
    border: primary ? 'none' : `1px solid ${fg}40`,
    borderRadius: 3,
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 10, fontWeight: 700,
    cursor: 'pointer',
  };
}

function formatAgo(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

// ─── Stage 9.5: Public replays from server REST API ──────────────────────────

const PAGE_SIZE = 20;
const WIN_KIND_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '',              label: 'All conditions' },
  { value: 'territory',     label: 'Territory' },
  { value: 'hold_majority', label: 'Hold majority' },
  { value: 'elimination',   label: 'Elimination' },
  { value: 'last_alive',    label: 'Last alive' },
];

function PublicReplaysSection({ onPlay }: { onPlay: (r: Replay) => void }) {
  const { tokens: T } = useTheme();
  const [items, setItems] = useState<PublicReplayListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [kind, setKind] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playLoading, setPlayLoading] = useState<string | null>(null);

  const load = useCallback((nextOffset: number, nextKind: string) => {
    setLoading(true);
    setError(null);
    listPublicReplays({ limit: PAGE_SIZE, offset: nextOffset, winConditionKind: nextKind || undefined })
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
        setOffset(nextOffset);
      })
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(0, ''); }, [load]);

  const handlePlay = (it: PublicReplayListItem) => {
    setPlayLoading(it.matchId);
    setError(null);
    fetchPublicReplay(it.matchId)
      .then((detail) => {
        if (!detail.replay || typeof detail.replay !== 'object') {
          throw new Error('Replay payload missing on server');
        }
        const replay = detail.replay as Replay;
        // Server replay не имеет metadata.id — генерируем fresh.
        const id = `public-${it.matchId}`;
        const stored: Replay = {
          ...replay,
          metadata: {
            ...replay.metadata,
            id,
            name: replay.metadata?.name
              ?? `Public · ${it.winnerNickname ?? 'Draw'} (${it.reason})`,
          },
        };
        onPlay(stored);
      })
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setPlayLoading(null));
  };

  const hasPrev = offset > 0;
  const hasNext = offset + items.length < total;

  return (
    <Section title={`Public replays (${total} total)`}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <select
          value={kind}
          onChange={(e) => { setKind(e.target.value); load(0, e.target.value); }}
          data-testid="public-replays-kind"
          style={{
            flex: 1,
            padding: '6px 8px',
            background: T.bgOverlay, color: T.textPrimary,
            border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
          }}
        >
          {WIN_KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={() => load(offset, kind)}
          disabled={loading}
          data-testid="public-replays-refresh"
          style={{
            padding: '6px 10px',
            background: T.bgOverlay, color: T.textPrimary,
            border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? '…' : '↻'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: 6, marginBottom: 6,
          background: T.danger + '15',
          color: T.danger, fontSize: 10,
          border: `1px solid ${T.danger}`,
          borderRadius: T.radiusSm,
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          {error}
        </div>
      )}

      {items.length === 0 && !loading && !error ? (
        <div style={{
          padding: 12, textAlign: 'center',
          color: T.textMuted, fontSize: 10,
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          No public replays match this filter yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="public-replays-list">
          {items.map((it) => (
            <PublicReplayCard
              key={it.matchId}
              item={it}
              loading={playLoading === it.matchId}
              onPlay={() => handlePlay(it)}
            />
          ))}
        </div>
      )}

      {(hasPrev || hasNext) && (
        <div style={{
          display: 'flex', gap: 6, marginTop: 8,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
        }}>
          <button
            onClick={() => load(Math.max(0, offset - PAGE_SIZE), kind)}
            disabled={!hasPrev || loading}
            style={paginationBtn(T, hasPrev && !loading)}
          >← Prev</button>
          <div style={{ flex: 1, textAlign: 'center', color: T.textMuted, alignSelf: 'center' }}>
            {offset + 1}–{Math.min(offset + items.length, total)} of {total}
          </div>
          <button
            onClick={() => load(offset + PAGE_SIZE, kind)}
            disabled={!hasNext || loading}
            style={paginationBtn(T, hasNext && !loading)}
          >Next →</button>
        </div>
      )}
    </Section>
  );
}

function PublicReplayCard({
  item, loading, onPlay,
}: {
  item: PublicReplayListItem;
  loading: boolean;
  onPlay: () => void;
}) {
  const { tokens: T } = useTheme();
  const ago = formatAgo(item.startedAt);
  const totalDeploys = item.participants.reduce((s, p) => s + (p.territoryPct > 0 ? 1 : 0), 0);
  return (
    <div style={{
      padding: 8,
      background: T.bgOverlay,
      border: `1px solid ${T.border}`,
      borderRadius: T.radiusSm,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11, fontWeight: 700, color: T.textPrimary,
      }}>
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.winnerNickname ?? '— Draw —'}
        </span>
        <span style={{ color: T.textMuted, fontWeight: 400, fontSize: 9 }}>{ago}</span>
      </div>
      <div style={{
        marginTop: 4, fontSize: 9, color: T.textMuted,
        fontFamily: 'JetBrains Mono, monospace',
        display: 'flex', flexWrap: 'wrap', gap: 8,
      }}>
        <span>{item.reason}</span>
        {item.winConditionKind && <span>· {item.winConditionKind}</span>}
        {item.durationTicks != null && <span>· {item.durationTicks}t</span>}
        {totalDeploys > 0 && <span>· {item.participants.length}p</span>}
      </div>
      <button
        onClick={onPlay}
        disabled={loading}
        data-testid="public-replay-play"
        style={{
          marginTop: 6, width: '100%',
          padding: '4px 8px',
          background: loading ? T.bgOverlay : T.accent,
          color: loading ? T.textMuted : T.bg,
          border: 'none', borderRadius: T.radiusSm,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700,
          cursor: loading ? 'wait' : 'pointer',
        }}
      >
        {loading ? '…' : '▶ Play'}
      </button>
    </div>
  );
}

function paginationBtn(T: { bgOverlay: string; textMuted: string; accent: string; bg: string; border: string; radiusSm: number | string },
  enabled: boolean): React.CSSProperties {
  return {
    padding: '4px 10px',
    background: enabled ? T.bgOverlay : T.bgOverlay,
    color: enabled ? T.accent : T.textMuted,
    border: `1px solid ${T.border}`,
    borderRadius: T.radiusSm,
    fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
    cursor: enabled ? 'pointer' : 'not-allowed',
  };
}
