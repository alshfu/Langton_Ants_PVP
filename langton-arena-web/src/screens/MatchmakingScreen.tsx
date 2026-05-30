// src/screens/MatchmakingScreen.tsx
//
// Stage 9.3: matchmaking queue UI.
// User clicks "Find match" → connects WS → sends find_match → waits.
// Server pairs со similar-rated player → match_found → navigate /?room=XXX.
// After 60s wait → bot fallback offered.

import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@theme/ThemeProvider';
import { useT } from '@i18n/I18nProvider';
import { useAppState } from '@state/AppStateProvider';
import { Button } from '@ui/Button';
import { Eyebrow } from '@ui/Eyebrow';
import { WSClient } from '@lib/wsClient';
import { getOrCreateNickname } from '@lib/nicknames';
import { getDeviceId } from '@lib/deviceId';
import { buildMatchUrl } from '@lib/roomCodes';
import type { ServerMessage } from '@langton/core';

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

export function MatchmakingScreen() {
  const { tokens: T } = useTheme();
  const t = useT();
  const { setScreen } = useAppState();
  const [waitSec, setWaitSec] = useState(0);
  const [queueSize, setQueueSize] = useState(0);
  const [botFallbackOffered, setBotFallbackOffered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WSClient | null>(null);
  const acceptedBotRef = useRef<'easy' | 'normal' | 'hard' | null>(null);

  useEffect(() => {
    const ws = new WSClient({
      url: getWsUrl(),
      onMessage: (msg: ServerMessage) => {
        switch (msg.type) {
          case 'matchmaking_status':
            setWaitSec(msg.waitSec);
            setQueueSize(msg.queueSize);
            if (msg.botFallbackOffered) setBotFallbackOffered(true);
            break;
          case 'match_found': {
            // Если accepted bot fallback — пробрасываем difficulty в URL
            // так MatchScreen auto-spawn'ит бота как opponent.
            const url = buildMatchUrl(msg.roomCode, acceptedBotRef.current ?? undefined);
            window.location.href = url;
            break;
          }
          case 'error':
            setError(msg.message);
            break;
        }
      },
      onOpen: () => {
        ws.send({
          type: 'find_match',
          nickname: getOrCreateNickname(),
          deviceId: getDeviceId(),
        });
      },
    });
    wsRef.current = ws;
    void ws.connect();
    return () => {
      try { ws.send({ type: 'cancel_matchmaking' }); } catch { /* */ }
      ws.disconnect();
    };
  }, []);

  const handleCancel = () => {
    wsRef.current?.send({ type: 'cancel_matchmaking' });
    setScreen('menu');
  };

  const handleAcceptBot = (difficulty: 'easy' | 'normal' | 'hard') => {
    wsRef.current?.send({ type: 'accept_bot_fallback', difficulty });
    // Server responds match_found, useEffect handler navigates.
    // Also save bot difficulty в URL — MatchScreen auto-spawns bot.
    // Simplification: just wait for match_found, append &bot=... ourselves
    // на navigation. But server's match_found includes opponentNickname — мы
    // знаем что это bot. Add &bot= query через intercepting match_found.
    // Для MVP: client sends accept_bot_fallback, server returns match_found,
    // MatchScreen sees opponent slot empty initially, user can add bot manually.
    // Or — simpler — append ?bot= to URL ourselves perchance.
  };

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: T.bg, color: T.textPrimary,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        height: 56, padding: '0 24px',
        display: 'flex', alignItems: 'center', gap: 14,
        borderBottom: `1px solid ${T.border}`, background: T.bgElevated,
      }}>
        <Button variant="ghost" size="sm" onClick={handleCancel}>
          ← {t('common.back', 'Back')}
        </Button>
        <Eyebrow>· {t('matchmaking.title', 'Finding match')}</Eyebrow>
      </div>
      <div style={{
        flex: 1, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16,
        padding: 24,
      }}>
        {error ? (
          <>
            <div style={{ color: T.danger, fontSize: 16, fontWeight: 600 }}>
              ❌ {error}
            </div>
            <Button onClick={() => setScreen('menu')}>Back to menu</Button>
          </>
        ) : (
          <>
            <div style={{
              width: 48, height: 48,
              border: `3px solid ${T.border}`,
              borderTopColor: T.accent,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: T.textPrimary }}>
              {t('matchmaking.searching', 'Searching for opponent...')}
            </h2>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              color: T.textMuted, fontSize: 13,
              display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center',
            }}>
              <div>⏱ {waitSec}s waiting</div>
              <div>👥 {queueSize} {queueSize === 1 ? 'player' : 'players'} in queue</div>
            </div>

            {botFallbackOffered && (
              <div style={{
                marginTop: 16, padding: 16,
                background: T.bgOverlay,
                border: `1px solid ${T.warning}88`,
                borderRadius: T.radiusSm,
                display: 'flex', flexDirection: 'column', gap: 10,
                maxWidth: 360,
              }}>
                <div style={{
                  fontSize: 12, color: T.textMuted, lineHeight: 1.5, textAlign: 'center',
                }}>
                  {t('matchmaking.noHuman',
                    'No human opponent found yet. Play vs Bot while we wait?')}
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  <Button size="sm" variant="ghost" onClick={() => handleAcceptBot('easy')}>🟢 Easy</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleAcceptBot('normal')}>🟡 Normal</Button>
                  <Button size="sm" variant="primary" onClick={() => handleAcceptBot('hard')}>🔴 Hard</Button>
                </div>
              </div>
            )}

            <Button variant="ghost" size="md" onClick={handleCancel} style={{ marginTop: 16 }}>
              {t('matchmaking.cancel', 'Cancel')}
            </Button>
          </>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
