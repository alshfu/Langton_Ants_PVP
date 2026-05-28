// src/screens/MatchScreen.tsx
//
// Stage 8 Day 7: PvP match screen — connecting + lobby phases.
// Day 8 добавит countdown + playing. Day 11 — finished banner.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from '@theme/ThemeProvider';
import { useT } from '@i18n/I18nProvider';
import { useAppState } from '@state/AppStateProvider';
import { Button } from '@ui/Button';
import { Eyebrow } from '@ui/Eyebrow';
import { Chip } from '@ui/Chip';
import { WSClient } from '@lib/wsClient';
import { getOrCreateNickname } from '@lib/nicknames';
import type { ServerMessage, PlayerInfo } from '@langton/core';

type MatchPhase = 'connecting' | 'lobby' | 'countdown' | 'playing' | 'finished' | 'error';

/** Stage 8: WS URL — env override иначе localhost:8080 default. */
function getWsUrl(): string {
  const env = (import.meta as { env?: { VITE_WS_URL?: string } }).env;
  if (env?.VITE_WS_URL) return env.VITE_WS_URL;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${host}:8080`;
    }
  }
  return 'ws://localhost:8080';
}

function readRoomCode(): string | null {
  try {
    const p = new URLSearchParams(window.location.search);
    return p.get('room');
  } catch { return null; }
}

function getBrowserLocale(): string {
  try {
    const loc = (navigator.language || 'en').toLowerCase().split('-')[0]!;
    const supported = ['en', 'ru', 'uk', 'de', 'es', 'fr', 'zh', 'ja', 'ko', 'pt'];
    return supported.includes(loc) ? loc : 'en';
  } catch { return 'en'; }
}

export function MatchScreen() {
  const { tokens: T } = useTheme();
  const t = useT();
  const { setScreen } = useAppState();

  const roomCode = readRoomCode();
  const [phase, setPhase] = useState<MatchPhase>(roomCode ? 'connecting' : 'error');
  const [errorText, setErrorText] = useState<string | null>(
    roomCode ? null : t('match.noRoomCode', 'No room code in URL (?room=)'),
  );
  const [clientId, setClientId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const nicknameRef = useRef(getOrCreateNickname());
  const wsRef = useRef<WSClient | null>(null);

  const me = players.find((p) => p.clientId === clientId);
  const opponent = players.find((p) => p.clientId !== clientId);

  // ─── WS connection ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!roomCode) return;
    let cancelled = false;

    const ws = new WSClient({
      url: getWsUrl(),
      onMessage: (msg: ServerMessage) => {
        if (cancelled) return;
        switch (msg.type) {
          case 'room_joined':
            setClientId(msg.clientId);
            setPlayers(msg.players);
            setPhase('lobby');
            break;
          case 'room_updated':
            setPlayers(msg.players);
            break;
          case 'match_starting':
            setPhase('countdown');
            break;
          case 'match_started':
            setPhase('playing');
            break;
          case 'match_ended':
            setPhase('finished');
            break;
          case 'error':
            setErrorText(msg.message);
            if (msg.code === 'ROOM_FULL' || msg.code === 'ROOM_NOT_FOUND') {
              setPhase('error');
            }
            break;
          case 'pong':
          case 'match_tick':
            // Day 8/9
            break;
        }
      },
      onClose: (code, reason) => {
        if (cancelled) return;
        setPhase((curr) => {
          if (curr === 'finished' || curr === 'error') return curr;
          setErrorText(`${t('match.connectionLost', 'Connection lost')} (${code} ${reason})`);
          return 'error';
        });
      },
      onError: () => {
        if (cancelled) return;
        setErrorText(t('match.connectionError', 'Connection error'));
      },
    });
    wsRef.current = ws;

    ws.connect()
      .then(() => {
        if (cancelled) return;
        ws.send({
          type: 'join_room',
          roomCode,
          nickname: nicknameRef.current,
          locale: getBrowserLocale(),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorText(`${t('match.cannotConnect', 'Cannot connect to server')}: ${String(err.message ?? err)}`);
        setPhase('error');
      });

    return () => {
      cancelled = true;
      ws.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const toggleReady = useCallback(() => {
    if (!wsRef.current || !me) return;
    wsRef.current.send({ type: 'set_ready', ready: !me.ready });
  }, [me]);

  const copyShareUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      window.prompt(t('match.copyUrl', 'Copy this URL:'), window.location.href);
    }
  }, [t]);

  const goBack = useCallback(() => {
    wsRef.current?.disconnect();
    setScreen('menu');
  }, [setScreen]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: T.bg, color: T.textPrimary,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        height: 56, padding: '0 24px',
        display: 'flex', alignItems: 'center', gap: 14,
        borderBottom: `1px solid ${T.border}`, background: T.bgElevated,
      }}>
        <Button variant="ghost" size="sm" onClick={goBack}>
          ← {t('common.back', 'Back')}
        </Button>
        <Eyebrow>· {t('match.title', 'PvP Match')}</Eyebrow>
        {roomCode && (
          <Chip color={T.info} size="sm">room: {roomCode}</Chip>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Chip
            color={
              phase === 'connecting'  ? T.warning
              : phase === 'lobby'     ? T.info
              : phase === 'countdown' ? T.accent
              : phase === 'playing'   ? T.success
              : phase === 'finished'  ? T.success
              : T.danger
            }
            filled size="sm"
          >
            {phase}
          </Chip>
          <Chip color={T.accent} size="sm">
            👤 {nicknameRef.current}
          </Chip>
        </span>
      </div>

      {/* Main area */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 32, gap: 24,
      }}>
        {phase === 'connecting' && <ConnectingView t={t} T={T} />}
        {phase === 'lobby' && (
          <LobbyView
            t={t} T={T}
            players={players}
            me={me}
            opponent={opponent}
            roomCode={roomCode!}
            onReadyToggle={toggleReady}
            onCopyUrl={copyShareUrl}
          />
        )}
        {phase === 'countdown' && (
          <div style={{ fontSize: 96, fontWeight: 700, color: T.accent, fontFamily: 'JetBrains Mono, monospace' }}>
            3
          </div>
        )}
        {phase === 'playing' && (
          <div style={{ color: T.textMuted, fontFamily: 'JetBrains Mono, monospace' }}>
            {t('match.playingStub', 'Playing… (Day 8 will render the field here)')}
          </div>
        )}
        {phase === 'finished' && (
          <div style={{ color: T.textMuted, fontFamily: 'JetBrains Mono, monospace' }}>
            {t('match.finishedStub', 'Match finished (Day 11 will render banner here)')}
          </div>
        )}
        {phase === 'error' && (
          <ErrorView t={t} T={T} text={errorText} onBack={goBack} />
        )}
      </div>
    </div>
  );
}

// ─── Sub-views ──────────────────────────────────────────────────────────────

interface SubViewBase {
  t: (k: string, d?: string) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T: any;
}

function ConnectingView({ t, T }: SubViewBase) {
  return (
    <>
      <div style={{
        width: 48, height: 48,
        border: `4px solid ${T.border}`,
        borderTopColor: T.accent,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      <div style={{ color: T.textMuted, fontFamily: 'JetBrains Mono, monospace' }}>
        {t('match.connecting', 'Connecting to server...')}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function LobbyView({
  t, T, players, me, opponent, onReadyToggle, onCopyUrl,
}: SubViewBase & {
  players: PlayerInfo[];
  me: PlayerInfo | undefined;
  opponent: PlayerInfo | undefined;
  roomCode: string;
  onReadyToggle: () => void;
  onCopyUrl: () => void;
}) {
  return (
    <div style={{
      width: '100%', maxWidth: 600,
      display: 'flex', flexDirection: 'column', gap: 20,
    }}>
      <h2 style={{ margin: 0, fontSize: 22 }}>
        {t('match.lobbyTitle', 'Lobby')}
        <span style={{
          color: T.textMuted, fontSize: 14, marginLeft: 12,
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          {players.length}/2
        </span>
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PlayerSlot t={t} T={T} player={me} isMe label={t('match.you', 'You')} />
        <PlayerSlot t={t} T={T} player={opponent} isMe={false} label={t('match.opponent', 'Opponent')} />
      </div>

      {me && (
        <Button
          variant={me.ready ? 'ghost' : 'primary'}
          size="md"
          fullWidth
          onClick={onReadyToggle}
        >
          {me.ready
            ? t('match.unready', '✓ Ready — click to cancel')
            : t('match.ready', 'Click when ready ▶')}
        </Button>
      )}

      {!opponent && (
        <div style={{
          padding: 14,
          background: T.bgOverlay,
          border: `1px dashed ${T.border}`,
          borderRadius: T.radiusSm,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>
            {t('match.shareHint', 'Waiting for opponent — share this URL:')}
          </div>
          <div style={{
            padding: 8,
            background: T.bg,
            border: `1px solid ${T.border}`,
            borderRadius: T.radiusSm,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            color: T.textPrimary,
            overflow: 'auto',
            whiteSpace: 'nowrap',
          }}>
            {typeof window !== 'undefined' ? window.location.href : '?room=...'}
          </div>
          <Button variant="ghost" size="sm" onClick={onCopyUrl}>
            📋 {t('match.copyShareUrl', 'Copy URL')}
          </Button>
        </div>
      )}
    </div>
  );
}

function PlayerSlot({
  t, T, player, label,
}: SubViewBase & {
  player: PlayerInfo | undefined;
  isMe: boolean;
  label: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: 12,
      background: player ? T.bgOverlay : 'transparent',
      border: `1px solid ${player ? (player.ready ? T.success : T.border) : T.border}`,
      borderRadius: T.radiusSm,
      borderStyle: player ? 'solid' : 'dashed',
    }}>
      <div style={{ fontSize: 24 }}>{player ? '👤' : '⏳'}</div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 11, color: T.textMuted, textTransform: 'uppercase',
          letterSpacing: 1, fontFamily: 'JetBrains Mono, monospace',
        }}>
          {label}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {player ? player.nickname : t('match.waiting', 'Waiting...')}
        </div>
      </div>
      {player && (
        <Chip
          color={player.ready ? T.success : T.textMuted}
          filled={player.ready}
          size="sm"
        >
          {player.ready
            ? t('match.statusReady', 'ready')
            : t('match.statusNotReady', 'not ready')}
        </Chip>
      )}
    </div>
  );
}

function ErrorView({
  t, T, text, onBack,
}: SubViewBase & {
  text: string | null;
  onBack: () => void;
}) {
  return (
    <div style={{
      maxWidth: 500,
      display: 'flex', flexDirection: 'column', gap: 16,
      alignItems: 'center',
    }}>
      <div style={{ fontSize: 48 }}>⚠</div>
      <h2 style={{ margin: 0 }}>{t('match.errorTitle', 'Something went wrong')}</h2>
      <p style={{
        color: T.textMuted,
        background: T.bgOverlay,
        padding: 12,
        borderRadius: T.radiusSm,
        border: `1px solid ${T.danger}40`,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 12,
        margin: 0,
        textAlign: 'center',
      }}>
        {text ?? t('match.unknownError', 'Unknown error')}
      </p>
      <Button variant="primary" size="md" onClick={onBack}>
        ← {t('match.backToMenu', 'Back to menu')}
      </Button>
    </div>
  );
}
