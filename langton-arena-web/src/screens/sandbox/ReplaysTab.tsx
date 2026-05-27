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
