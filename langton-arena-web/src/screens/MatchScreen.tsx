// src/screens/MatchScreen.tsx
//
// Stage 8 Day 7: PvP match screen — connecting + lobby phases.
// Day 8 добавит countdown + playing. Day 11 — finished banner.

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useTheme } from '@theme/ThemeProvider';
import { useT } from '@i18n/I18nProvider';
import { useAppState } from '@state/AppStateProvider';
import { Button } from '@ui/Button';
import { Eyebrow } from '@ui/Eyebrow';
import { Chip } from '@ui/Chip';
import { WSClient } from '@lib/wsClient';
import { getOrCreateNickname } from '@lib/nicknames';
import { LangtonField } from '@components/LangtonField';
import type { ServerMessage, PlayerInfo, SandboxConfig, Ant, DeployAction, SimState, MatchResult } from '@langton/core';
import { buildAntsFromConfig, applyDeployAction } from '@langton/core';
import {
  makeGhost, addGhost, reconcileGhosts, rejectGhost, gcStaleGhosts,
  type Ghost,
} from '@lib/clientPrediction';
import { PLAYER_PALETTE } from '@core/shared/constants';

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

  // Stage 8 Day 8: match config + seed захватываются из match_starting,
  // используются в playing phase для инициализации engine.
  const [matchConfig, setMatchConfig] = useState<SandboxConfig | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [countdownEndAt, setCountdownEndAt] = useState<number | null>(null);
  const [countdownRemaining, setCountdownRemaining] = useState<number>(0);
  // Stage 8 Day 9: server-driven ticks.
  // stepSignal — каждое match_tick инкрементируется до msg.tick,
  // LangtonField stepSignal effect делает delta шагов.
  const [stepSignal, setStepSignal] = useState(0);
  // pendingDeploysByTick — map для onTick lookup: на каком tick применять.
  const pendingDeploysByTickRef = useRef<Map<number, DeployAction[]>>(new Map());
  // currentTickRef — последний server tick (для click → deploy с правильным tick).
  const currentTickRef = useRef(0);
  // myPlayerIdx — индекс в room.players (0 или 1). Set on room_joined.
  const myPlayerIdxRef = useRef<number | null>(null);
  // Stage 8 Day 10: client-side prediction.
  // Helper'ы — pure functions в @lib/clientPrediction (тестируются отдельно).
  const [pendingGhosts, setPendingGhosts] = useState<Ghost[]>([]);
  // Day 10: rejection toast — короткое уведомление "Deploy rejected".
  const [rejectionToast, setRejectionToast] = useState<string | null>(null);
  // Day 11: match result + replay URL для финального banner.
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [replayUrl, setReplayUrl] = useState<string | null>(null);

  const me = players.find((p) => p.clientId === clientId);
  const opponent = players.find((p) => p.clientId !== clientId);

  // Stage 8 Day 8: countdown timer — обновляем remaining раз в 100мс
  useEffect(() => {
    if (phase !== 'countdown' || !countdownEndAt) return;
    const id = setInterval(() => {
      const left = Math.max(0, countdownEndAt - Date.now());
      setCountdownRemaining(left);
    }, 100);
    return () => clearInterval(id);
  }, [phase, countdownEndAt]);

  // Stage 8 Day 8: engineAnts + palette + shapes для LangtonField в playing phase
  const engineAnts: Ant[] = useMemo(
    () => (matchConfig ? buildAntsFromConfig(matchConfig) : []),
    [matchConfig],
  );
  const palette = useMemo(
    () => (matchConfig?.players ?? []).map((p) => p.color),
    [matchConfig],
  );
  const shapes = useMemo(
    () => (matchConfig?.players ?? []).map(
      (_, i) => PLAYER_PALETTE[i % PLAYER_PALETTE.length]!.shape,
    ),
    [matchConfig],
  );
  // Cell size: тот же расчёт что в SandboxScreen
  const cellSize = matchConfig
    ? Math.max(1, Math.min(14, Math.floor(800 / Math.max(matchConfig.width, matchConfig.height))))
    : 8;

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
            // Track our slot index for deploy click
            {
              const idx = msg.players.findIndex((p) => p.clientId === msg.clientId);
              myPlayerIdxRef.current = idx >= 0 ? idx : null;
            }
            setPhase('lobby');
            break;
          case 'room_updated':
            setPlayers(msg.players);
            {
              const myId = clientId; // closure capture последнего state
              const idx = msg.players.findIndex((p) => p.clientId === myId);
              if (idx >= 0) myPlayerIdxRef.current = idx;
            }
            break;
          case 'match_starting':
            // Day 8: захватываем config + seed для playing phase.
            // Config приходит с server-applied seed (cfg.seed === msg.seed).
            setMatchConfig({ ...msg.config, seed: msg.seed });
            setMatchId(msg.matchId);
            setCountdownEndAt(Date.now() + msg.countdownMs);
            setPhase('countdown');
            break;
          case 'match_started':
            setMatchId(msg.matchId);
            setPhase('playing');
            break;
          case 'match_ended':
            // Day 11: capture full result + replay URL для FinishedView.
            setMatchResult(msg.result);
            setReplayUrl(msg.replayUrl);
            setPhase('finished');
            break;
          case 'error':
            // Day 10: deploy rejection → откатить matching ghost + toast.
            if (msg.code === 'INVALID_DEPLOY' || msg.code === 'INPUT_TOO_OLD') {
              let didRollback = false;
              setPendingGhosts((prev) => {
                const { ghosts: next, removed } = rejectGhost(
                  prev, myPlayerIdxRef.current, msg.context,
                );
                if (removed) didRollback = true;
                return next;
              });
              // Toast показываем даже если rollback не сработал — пользователь
              // должен знать что server отверг его действие.
              setRejectionToast(msg.message);
              setTimeout(() => setRejectionToast(null), 2200);
              if (didRollback) break;
              // Если rollback не сработал (no context / no matching) — fallthrough
              // в default branch чтобы поведение для non-deploy errors не сломать.
            }
            // Non-deploy errors: keep existing behaviour (banner / fatal).
            setErrorText(msg.message);
            if (msg.code === 'ROOM_FULL' || msg.code === 'ROOM_NOT_FOUND') {
              setPhase('error');
            }
            break;
          case 'match_tick': {
            // Day 9: server-driven engine.
            // 1. Index deploys by tick — onTick callback применит на нужном тике.
            // 2. setStepSignal — LangtonField сделает delta шагов.
            if (msg.deploys.length > 0) {
              const arr = pendingDeploysByTickRef.current.get(msg.tick) ?? [];
              arr.push(...msg.deploys);
              pendingDeploysByTickRef.current.set(msg.tick, arr);
            }
            currentTickRef.current = msg.tick;
            setStepSignal(msg.tick);
            // Day 10: reconciliation + GC через pure helpers.
            setPendingGhosts((prev) => {
              const reconciled = reconcileGhosts(prev, msg.deploys);
              return gcStaleGhosts(reconciled, msg.tick);
            });
            break;
          }
          case 'pong':
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

  // Stage 8 Day 9: click на канвас → send deploy сообщение.
  // Stage 8 Day 10: + optimistic ghost для instant визуальной обратной связи.
  // Reconciliation: ghost удаляется когда server echo'ит deploy в match_tick
  // (см. case 'match_tick') или присылает error('INVALID_DEPLOY').
  const handleDeployClick = useCallback((x: number, y: number) => {
    const idx = myPlayerIdxRef.current;
    if (idx == null || !wsRef.current) return;
    const tick = currentTickRef.current;
    wsRef.current.send({ type: 'deploy', tick, x, y });
    // Optimistic ghost (instant visual feedback ~RTT/2 раньше реального ant).
    setPendingGhosts((prev) => addGhost(prev, makeGhost(x, y, idx, tick)));
  }, []);

  // Stage 8 Day 9: server-driven onTick callback.
  // LangtonField сделал step → sim.tick поднялся → достаём queued deploys для
  // этого тика и применяем через shared applyDeployAction.
  const handleEngineTick = useCallback((sim: SimState) => {
    const map = pendingDeploysByTickRef.current;
    const deploys = map.get(sim.tick);
    if (deploys && matchConfig) {
      for (const d of deploys) applyDeployAction(sim, d, matchConfig);
      map.delete(sim.tick);
    }
    // Garbage collect старые ключи (если что-то застряло из-за reorder).
    for (const t of Array.from(map.keys())) {
      if (t < sim.tick - 5) map.delete(t);
    }
  }, [matchConfig]);

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
          <CountdownView t={t} T={T} remainingMs={countdownRemaining} />
        )}
        {phase === 'playing' && matchConfig && (
          <PlayingView
            t={t} T={T}
            config={matchConfig}
            seed={matchConfig.seed}
            matchId={matchId}
            ants={engineAnts}
            palette={palette}
            shapes={shapes}
            cellSize={cellSize}
            stepSignal={stepSignal}
            onTick={handleEngineTick}
            onDeployClick={handleDeployClick}
            myPlayerIdx={myPlayerIdxRef.current}
            ghostDeploys={pendingGhosts}
            rejectionToast={rejectionToast}
          />
        )}
        {phase === 'finished' && matchResult && (
          <FinishedView
            t={t} T={T}
            result={matchResult}
            myPlayer={me}
            players={players}
            palette={palette}
            replayUrl={replayUrl}
            onBack={goBack}
            onPlayAgain={() => {
              // Day 11 MVP: новая матч = back в menu (без autorejoin).
              // Day 13+ может добавить rejoin / rematch flow.
              goBack();
            }}
          />
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

function CountdownView({
  t, T, remainingMs,
}: SubViewBase & { remainingMs: number }) {
  // Округляем до целых секунд для отображения (3 / 2 / 1 / 0).
  const sec = Math.max(0, Math.ceil(remainingMs / 1000));
  const display = sec === 0 ? 'GO!' : String(sec);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 16,
      alignItems: 'center',
    }}>
      <div style={{
        fontSize: 11, color: T.textMuted, letterSpacing: 2,
        textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace',
      }}>
        {t('match.matchStartingIn', 'Match starting in')}
      </div>
      <div
        key={display}
        style={{
          fontSize: sec === 0 ? 72 : 128,
          fontWeight: 700,
          color: sec === 0 ? T.success : T.accent,
          fontFamily: 'JetBrains Mono, monospace',
          lineHeight: 1,
          animation: 'pop .25s ease-out',
        }}
      >
        {display}
      </div>
      <style>{`@keyframes pop { 0% { transform: scale(0.6); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  );
}

function PlayingView({
  T, config, seed, matchId, ants, palette, shapes, cellSize,
  stepSignal, onTick, onDeployClick, myPlayerIdx,
  ghostDeploys, rejectionToast,
}: SubViewBase & {
  config: SandboxConfig;
  seed: number;
  matchId: string | null;
  ants: Ant[];
  palette: string[];
  shapes: import('../components/antShapes').ShapeId[];
  cellSize: number;
  stepSignal: number;
  onTick: (sim: SimState) => void;
  onDeployClick: (x: number, y: number) => void;
  myPlayerIdx: number | null;
  ghostDeploys: Array<{ x: number; y: number; playerIdx: number }>;
  rejectionToast: string | null;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 12,
      alignItems: 'center',
    }}>
      <div style={{
        display: 'flex', gap: 8, fontSize: 10,
        color: T.textMuted, fontFamily: 'JetBrains Mono, monospace',
      }}>
        <Chip color={T.info} size="sm">
          {config.width}×{config.height} {config.gridType ?? 'square'}
        </Chip>
        <Chip color={T.accent} size="sm">seed: {seed}</Chip>
        <Chip color={T.success} size="sm">tick: {stepSignal}</Chip>
        {ghostDeploys.length > 0 && (
          <Chip color={T.warning} size="sm">pending: {ghostDeploys.length}</Chip>
        )}
        {matchId && <Chip color={T.textMuted} size="sm">{matchId.slice(0, 18)}…</Chip>}
      </div>
      {rejectionToast && (
        <div role="alert" data-testid="rejection-toast" style={{
          position: 'absolute', top: 80, right: 24,
          padding: '10px 14px',
          background: T.danger,
          color: '#fff',
          fontSize: 12,
          fontFamily: 'JetBrains Mono, monospace',
          borderRadius: T.radiusSm,
          boxShadow: `0 4px 16px ${T.danger}66`,
          animation: 'toast-in .25s ease-out',
          zIndex: 50,
        }}>
          ⚠ {rejectionToast}
          <style>{`@keyframes toast-in { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
        </div>
      )}
      <div style={{
        border: `2px solid ${T.success}`,
        borderRadius: T.radiusSm,
        padding: 2,
        boxShadow: `0 0 24px ${T.success}55`,
      }}>
        <LangtonField
          w={config.width}
          h={config.height}
          cellSize={cellSize}
          gridType={config.gridType ?? 'square'}
          ants={ants}
          palette={palette}
          shapes={shapes}
          tps={config.baseTps * config.speedMultiplier}
          paused={true}
          stepSignal={stepSignal}
          onTick={onTick}
          deployMode={myPlayerIdx != null}
          onDeployClick={onDeployClick}
          ghostDeploys={ghostDeploys}
          glow={config.showGlow}
          showTrail={config.showTrails}
          showHpDots={config.showHpDots}
          showDirectionArrows={config.showDirectionArrows}
          showGrid={config.showGrid}
          showCellState={config.showCellState}
          antScale={config.antScale}
          bg={config.bgColor}
          seed={seed}
          collisionCooldownTicks={config.collisionCooldownTicks}
          hpEnabled={config.hpEnabled}
          damageCapEnabled={config.damageCapEnabled}
          topology={config.topology}
        />
      </div>
      <div style={{
        fontSize: 10, color: T.textMuted, fontFamily: 'JetBrains Mono, monospace',
      }}>
        Click to deploy (you are player #{myPlayerIdx ?? '?'}). Server-driven @ {config.baseTps} TPS.
      </div>
    </div>
  );
}

function FinishedView({
  t, T, result, myPlayer, players, palette, replayUrl, onBack, onPlayAgain,
}: SubViewBase & {
  result: MatchResult;
  myPlayer: PlayerInfo | undefined;
  players: PlayerInfo[];
  palette: string[];
  replayUrl: string | null;
  onBack: () => void;
  onPlayAgain: () => void;
}) {
  // Day 11: определяем outcome для текущего игрока.
  // myPlayer.clientId — наш WS id; matchResult.winnerId — это server-config
  // playerId (формат 'p0'/'p1'), и оно соответствует room slot index.
  const myIdx = players.findIndex((p) => p.clientId === myPlayer?.clientId);
  const winnerIdx = result.winnerId
    ? Number(result.winnerId.replace(/\D/g, '')) // 'p0' → 0, 'p1' → 1
    : null;
  const outcome: 'victory' | 'defeat' | 'draw' =
    winnerIdx == null ? 'draw'
    : winnerIdx === myIdx ? 'victory'
    : 'defeat';

  const titleColor = outcome === 'victory' ? T.success
    : outcome === 'defeat' ? T.danger
    : T.warning;
  const title = outcome === 'victory' ? t('match.victory', 'VICTORY')
    : outcome === 'defeat' ? t('match.defeat', 'DEFEAT')
    : t('match.draw', 'DRAW');

  const reasonLabel = (() => {
    switch (result.reason) {
      case 'time_expired': return t('match.reason.timeExpired', 'Time expired — territory leader wins');
      case 'time_expired_tie': return t('match.reason.timeTie', 'Time expired — territory tied');
      case 'forced': return t('match.reason.disconnect', 'Opponent disconnected');
      default: return result.reason;
    }
  })();

  return (
    <div data-testid="finished-view" style={{
      width: '100%', maxWidth: 560,
      display: 'flex', flexDirection: 'column', gap: 20,
      alignItems: 'center',
    }}>
      <div style={{
        fontSize: 11, color: T.textMuted, letterSpacing: 2,
        textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace',
      }}>
        {t('match.matchEnded', 'Match ended')}
      </div>

      {/* Большой banner */}
      <div data-testid="match-outcome" style={{
        fontSize: 64, fontWeight: 800, color: titleColor,
        letterSpacing: 4, fontFamily: 'JetBrains Mono, monospace',
        lineHeight: 1,
        textShadow: `0 0 24px ${titleColor}88`,
        animation: 'banner-pop .35s ease-out',
      }}>
        {title}
      </div>

      {/* Winner name (если есть) */}
      {result.winnerName && outcome !== 'victory' && (
        <div style={{
          fontSize: 14, color: T.textPrimary,
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          {t('match.winnerIs', 'Winner:')} <strong style={{ color: titleColor }}>{result.winnerName}</strong>
        </div>
      )}

      {/* Reason chip */}
      <Chip color={titleColor} filled size="sm">{reasonLabel}</Chip>

      {/* Territory breakdown */}
      {result.territory && result.territory.length > 0 && (
        <div style={{
          width: '100%',
          padding: 12,
          background: T.bgOverlay,
          border: `1px solid ${T.border}`,
          borderRadius: T.radiusSm,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{
            fontSize: 10, color: T.textMuted, textTransform: 'uppercase',
            letterSpacing: 1, fontFamily: 'JetBrains Mono, monospace',
          }}>
            {t('match.finalTerritory', 'Final territory')}
          </div>
          {result.territory.map((entry, idx) => {
            const isMe = idx === myIdx;
            const isWinner = entry.playerId === result.winnerId;
            const color = palette[idx] ?? (idx === 0 ? T.accent : T.info);
            return (
              <div key={entry.playerId} style={{
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 14, height: 14, borderRadius: 3,
                  background: color,
                }} />
                <div style={{
                  flex: 1, fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 13,
                  color: isMe ? T.textPrimary : T.textMuted,
                  fontWeight: isMe ? 600 : 400,
                }}>
                  {entry.playerName}
                  {isMe && <span style={{ marginLeft: 6, color: T.textMuted, fontSize: 10 }}>(you)</span>}
                  {isWinner && <span style={{ marginLeft: 6, color: titleColor, fontSize: 10 }}>★</span>}
                </div>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 12, color: T.textPrimary,
                  minWidth: 90, textAlign: 'right',
                }}>
                  {(entry.pct * 100).toFixed(1)}% · {entry.cells.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Meta */}
      <div style={{
        display: 'flex', gap: 8, fontSize: 10,
        fontFamily: 'JetBrains Mono, monospace', color: T.textMuted,
      }}>
        <Chip color={T.textMuted} size="sm">
          {t('match.finishedAtTick', 'tick')}: {result.finishedAtTick}
        </Chip>
        {replayUrl && (
          <Chip color={T.info} size="sm">
            <a href={replayUrl} style={{ color: 'inherit', textDecoration: 'none' }}>
              📼 {t('match.replay', 'Replay')}
            </a>
          </Chip>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 360 }}>
        <Button variant="ghost" size="md" fullWidth onClick={onBack}>
          ← {t('match.backToMenu', 'Back to menu')}
        </Button>
        <Button variant="primary" size="md" fullWidth onClick={onPlayAgain}>
          {t('match.playAgain', 'Play again')} →
        </Button>
      </div>

      <style>{`@keyframes banner-pop {
        0% { transform: scale(0.6) translateY(-10px); opacity: 0; }
        60% { transform: scale(1.08) translateY(0); opacity: 1; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
      }`}</style>
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
