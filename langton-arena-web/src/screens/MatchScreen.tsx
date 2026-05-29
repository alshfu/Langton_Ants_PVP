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
import type { ServerMessage, PlayerInfo, SandboxConfig, Ant, DeployAction, SimState, MatchResult, Replay } from '@langton/core';
import { buildAntsFromConfig, applyDeployAction } from '@langton/core';
import { saveReplay } from '@lib/replayStorage';
import {
  makeGhost, addGhost, reconcileGhosts, rejectGhost, gcStaleGhosts,
  type Ghost,
} from '@lib/clientPrediction';
import {
  getResumeToken, setResumeToken, clearResumeToken,
} from '@lib/resumeToken';
import { PLAYER_PALETTE } from '@core/shared/constants';
import { fx } from '@lib/audio';
import { renderQrSvg, tryWebShare, isWebShareAvailable } from '@lib/qrCode';
import { computeScoreboard, type ScoreboardSummary } from '@lib/computeScoreboard';
import { hasSeenHint, markHintSeen, type HintId } from '@lib/onboarding';
import { OnboardingHint } from '@components/OnboardingHint';
import { music, moodFromDelta } from '@lib/music';
import { VolumePanel } from '@components/VolumePanel';
import { detectMilestones, type Milestone, type MilestoneId } from '@lib/matchMilestones';
import { MilestoneBanner } from '@components/MilestoneBanner';

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

/**
 * Day 17: viewport-size hook. Слушает resize + orientationchange.
 * Используется для адаптивного cellSize канваса — раньше был фиксированный
 * 800px и канвас не помещался на телефоне.
 */
function useViewportSize(): { w: number; h: number } {
  const getSize = () => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1024,
    h: typeof window !== 'undefined' ? window.innerHeight : 768,
  });
  const [size, setSize] = useState(getSize);
  useEffect(() => {
    const update = () => setSize(getSize());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return size;
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
  // Day 12: inline replay payload (PvP), захватываем из match_ended.
  const [pvpReplay, setPvpReplay] = useState<Replay | null>(null);
  // Day 13: reconnect state — true когда показываем "Reconnecting…" overlay.
  const [reconnectStatus, setReconnectStatus] = useState<'idle' | 'reconnecting' | 'opponent_away'>('idle');
  // Day 18: mute toggle for in-match audio. Persists в localStorage через fx.
  const [muted, setMuted] = useState<boolean>(fx.isMuted());
  const lastBeepSecRef = useRef<number>(-1);
  // Day 26: volume panel popover state. anchor stores button coords чтобы
  // позиционировать popover. null → закрыт.
  const [volumePanel, setVolumePanel] = useState<{ right: number; top: number } | null>(null);
  // Day 27: milestone banner state. activeMilestone — current banner;
  // prevScoreboardRef — для detect threshold crossings; firedMilestonesRef —
  // set of ids уже fired в этом матче (не повторять).
  const [activeMilestone, setActiveMilestone] = useState<Milestone | null>(null);
  const prevScoreboardRef = useRef<ScoreboardSummary | null>(null);
  const firedMilestonesRef = useRef<Set<MilestoneId>>(new Set());
  // Day 20: live scoreboard updated на каждый engine tick.
  const [scoreboard, setScoreboard] = useState<ScoreboardSummary | null>(null);
  // Day 23: rematch state. iRequestedRematch = клик "Play Again"; opp = тоже.
  const [iRequestedRematch, setIRequestedRematch] = useState(false);
  const [opponentRequestedRematch, setOpponentRequestedRematch] = useState(false);
  // Day 24: onboarding hint state. null означает либо все hints уже показаны,
  // либо текущая phase без hint. Reset на каждый phase change.
  const [activeHint, setActiveHint] = useState<HintId | null>(null);

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

  // Day 18: countdown sound effects — beep на 3/2/1, GO! на 0.
  // Триггеримся когда `ceil(remaining/1000)` пересекает следующий integer.
  useEffect(() => {
    if (phase !== 'countdown') {
      lastBeepSecRef.current = -1;
      return;
    }
    const sec = Math.ceil(countdownRemaining / 1000);
    if (sec !== lastBeepSecRef.current && sec >= 0 && sec <= 3) {
      lastBeepSecRef.current = sec;
      if (sec === 0) fx.play('countdown_go');
      else fx.play('countdown_beep');
    }
  }, [phase, countdownRemaining]);

  // Day 18: match end sound (победа/поражение/ничья). Триггеримся в phase
  // transition в 'finished' с уже set matchResult.
  // matchResult.winnerId это server playerId 'p0'/'p1' — конвертируем в idx
  // тем же способом что FinishedView (см. line ~985).
  useEffect(() => {
    if (phase !== 'finished' || !matchResult) return;
    const myIdx = myPlayerIdxRef.current;
    const winnerIdx = matchResult.winnerId
      ? Number(matchResult.winnerId.replace(/\D/g, ''))
      : null;
    if (winnerIdx == null) {
      fx.play('tie');
    } else if (myIdx != null && winnerIdx === myIdx) {
      fx.play('victory');
    } else {
      fx.play('defeat');
    }
  }, [phase, matchResult]);

  // Day 26: mute теперь управляется через VolumePanel popover (см. mute-toggle
  // button onClick). Локальное состояние `muted` синкается через setMuted после
  // panel close. setMuted сохраняется в state для иконки 🔊/🔇.
  // Day 18 toggleMute removed.

  // Day 24: показываем contextual hint на phase entry если ещё не видели.
  // Reactив на phase. markHintSeen вызывается в dismissActiveHint.
  useEffect(() => {
    let hintId: HintId | null = null;
    if (phase === 'lobby' && !hasSeenHint('match_lobby')) {
      hintId = 'match_lobby';
    } else if (phase === 'playing' && !hasSeenHint('match_playing')) {
      hintId = 'match_playing';
    } else if (phase === 'finished' && !hasSeenHint('match_finished')) {
      hintId = 'match_finished';
    }
    setActiveHint(hintId);
  }, [phase]);
  const dismissActiveHint = useCallback(() => {
    if (activeHint) markHintSeen(activeHint);
    setActiveHint(null);
  }, [activeHint]);

  // Day 25/26: dynamic music через все игровые phase'ы.
  // - lobby: pad-only ambient (intensity 0.1)
  // - countdown: buildup (intensity 0.3)
  // - playing: full Day 25 dynamic logic
  // - finished/error/connecting: stop
  useEffect(() => {
    if (phase === 'lobby' || phase === 'countdown' || phase === 'playing') {
      music.start();
      if (phase === 'lobby') {
        music.setMood('neutral');
        music.setIntensity(0.1);  // ambient pad для lobby
      } else if (phase === 'countdown') {
        music.setIntensity(0.3);  // pre-match buildup
      }
    } else {
      music.stop();
    }
    return () => {
      music.stop();
    };
  }, [phase]);
  // Day 27: detect milestones на scoreboard change. Trigger stinger + banner.
  // firedMilestonesRef гарантирует что каждый milestone стреляет максимум
  // один раз за матч (даже если повторно пересекает threshold).
  useEffect(() => {
    if (phase !== 'playing' || !scoreboard) {
      // Reset на новый матч (включая rematch)
      if (phase === 'lobby' || phase === 'countdown') {
        firedMilestonesRef.current.clear();
        prevScoreboardRef.current = null;
      }
      return;
    }
    const myIdx = myPlayerIdxRef.current;
    const events = detectMilestones(prevScoreboardRef.current, scoreboard, myIdx);
    prevScoreboardRef.current = scoreboard;
    if (events.length === 0) return;
    // Take первый non-fired (lead change > 50_up > 75_up > 25_down priority)
    const order: MilestoneId[] = ['lead_change', 'crossed_75_up', 'crossed_50_up', 'crossed_25_down'];
    const sorted = events.slice().sort((a, b) =>
      order.indexOf(a.id) - order.indexOf(b.id),
    );
    for (const ev of sorted) {
      if (firedMilestonesRef.current.has(ev.id)) continue;
      firedMilestonesRef.current.add(ev.id);
      setActiveMilestone(ev);
      // Stinger sound per milestone
      const soundId =
        ev.id === 'crossed_50_up'   ? 'stinger_lead'
        : ev.id === 'crossed_75_up' ? 'stinger_dominance'
        : ev.id === 'crossed_25_down' ? 'stinger_critical'
        : 'stinger_comeback';
      fx.play(soundId);
      break; // показываем по одному banner'у — за tick max 1
    }
  }, [phase, scoreboard]);

  // Intensity + mood обновляются на каждый tick через scoreboard updates.
  useEffect(() => {
    if (phase !== 'playing' || !matchConfig || !scoreboard) return;
    const threshold = matchConfig.winCondition.kind === 'time'
      ? matchConfig.winCondition.threshold
      : 300;
    const tickProgress = Math.min(1, stepSignal / threshold);
    // Базовая intensity растёт с прогрессом матча. Last 20% — full intensity
    // (climactic finale). Bonus +0.15 если матч близкий (delta < 5%).
    let intensity = 0.4 + tickProgress * 0.5;
    if (tickProgress > 0.8) intensity = 1;
    const myIdx = myPlayerIdxRef.current;
    if (myIdx != null) {
      const myEntry = scoreboard.entries.find((e) => e.playerIdx === myIdx);
      const oppEntry = scoreboard.entries.find((e) => e.playerIdx !== myIdx);
      if (myEntry && oppEntry) {
        const delta = Math.abs(myEntry.percent - oppEntry.percent);
        if (delta < 5) intensity = Math.min(1, intensity + 0.15);
        music.setMood(moodFromDelta(myEntry.percent, oppEntry.percent));
      }
    }
    music.setIntensity(intensity);
  }, [phase, stepSignal, scoreboard, matchConfig]);

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
  // Day 17: адаптивный cellSize от viewport (раньше был фиксированный 800).
  // Chrome ≈ top bar 56 + chips 32 + footer 24 + paddings ~80 = ~190px вертикали.
  // Горизонтали: paddings + border ~ 40px (16 каждая сторона на мобиле).
  const vp = useViewportSize();
  const isNarrow = vp.w < 720;
  const cellSize = useMemo(() => {
    if (!matchConfig) return 8;
    const avail = Math.min(
      vp.w - (isNarrow ? 24 : 80),
      vp.h - (isNarrow ? 220 : 240),
      800,
    );
    const maxDim = Math.max(matchConfig.width, matchConfig.height);
    return Math.max(1, Math.min(14, Math.floor(avail / maxDim)));
  }, [matchConfig, vp.w, vp.h, isNarrow]);

  // ─── WS connection ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!roomCode) return;
    let cancelled = false;

    // Day 13: helper для (re)send join_room — используется на каждое open
    // (включая reconnect). Подкладывает saved resumeToken если есть.
    const sendJoin = () => {
      const savedToken = getResumeToken(roomCode);
      wsRef.current?.send({
        type: 'join_room',
        roomCode,
        nickname: nicknameRef.current,
        locale: getBrowserLocale(),
        ...(savedToken ? { resumeToken: savedToken } : {}),
      });
    };

    const ws = new WSClient({
      url: getWsUrl(),
      autoReconnect: true,
      reconnectDelayMs: 1500,
      onOpen: (reopen) => {
        if (cancelled) return;
        // Day 13: на reopen после неожиданного close — переотправить join_room
        // с сохранённым resumeToken. Initial open тоже делается через этот
        // callback вместо .then() ниже (.then() оставлен для backwards
        // compat handling reject).
        if (reopen) {
          setReconnectStatus('reconnecting');
          sendJoin();
        }
      },
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
            // Day 13: персистим token для будущего reconnect (только если есть
            // roomCode, что всегда true в этой ветке).
            if (roomCode && msg.resumeToken) {
              setResumeToken(roomCode, msg.resumeToken);
            }
            // Если это resume — match_resume_state придёт следующим,
            // оставляем phase='reconnecting' до его получения. Иначе lobby.
            if (msg.resumed) {
              setReconnectStatus('reconnecting');
            } else {
              setPhase('lobby');
            }
            break;
          case 'room_updated':
            setPlayers(msg.players);
            {
              const myId = clientId; // closure capture последнего state
              const idx = msg.players.findIndex((p) => p.clientId === myId);
              if (idx >= 0) myPlayerIdxRef.current = idx;
            }
            // Day 13: показываем "Opponent reconnecting…" если оппонент в grace
            {
              const opp = msg.players.find((p) => p.clientId !== clientId);
              if (opp?.disconnected) setReconnectStatus('opponent_away');
              else if (reconnectStatus === 'opponent_away') setReconnectStatus('idle');
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
            // Day 12: + inline replay payload для local save.
            // Day 13: матч закончен — token больше не нужен.
            if (roomCode) clearResumeToken(roomCode);
            setMatchResult(msg.result);
            setReplayUrl(msg.replayUrl);
            setPvpReplay(msg.replay ?? null);
            setPhase('finished');
            setReconnectStatus('idle');
            // Day 23: reset rematch state на новый матч/конец
            setIRequestedRematch(false);
            setOpponentRequestedRematch(false);
            break;
          case 'rematch_status': {
            // Day 23: server broadcasts кто согласился.
            const agreed = msg.agreedClientIds;
            setIRequestedRematch(clientId != null && agreed.includes(clientId));
            setOpponentRequestedRematch(
              agreed.some((id) => id !== clientId),
            );
            break;
          }
          case 'rematch_reset':
            // Day 23: server reset'нул room в lobby — clear match state и
            // вернуться к Ready'ть-up flow. room_updated следом обновит players.
            setMatchResult(null);
            setReplayUrl(null);
            setPvpReplay(null);
            setScoreboard(null);
            setIRequestedRematch(false);
            setOpponentRequestedRematch(false);
            setStepSignal(0);
            currentTickRef.current = 0;
            pendingDeploysByTickRef.current.clear();
            setPendingGhosts([]);
            setPhase('lobby');
            break;
          case 'error':
            // Day 10: deploy rejection → откатить matching ghost + toast.
            // Day 14: RATE_LIMIT_EXCEEDED тоже rollback'ает ghost (context
            // отправляется только для deploy rate-limit, не для msg-flood).
            if (
              msg.code === 'INVALID_DEPLOY' ||
              msg.code === 'INPUT_TOO_OLD' ||
              msg.code === 'RATE_LIMIT_EXCEEDED'
            ) {
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
            // Day 15: ROOM_TIMEOUT + SERVER_SHUTDOWN тоже fatal — пользователь
            // в lobby не дождался оппонента / сервер пошёл на reboot.
            if (
              msg.code === 'ROOM_FULL' ||
              msg.code === 'ROOM_NOT_FOUND' ||
              msg.code === 'ROOM_TIMEOUT' ||
              msg.code === 'SERVER_SHUTDOWN'
            ) {
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
          case 'match_resume_state': {
            // Day 13: catch-up после reconnect mid-match.
            // 1. Restore config/seed/matchId — engine пересоздастся в LangtonField
            //    через useEffect на seed+ants change.
            // 2. Pre-fill pendingDeploysByTickRef со всеми историческими deploys
            //    grouped by tick.
            // 3. Bump stepSignal до server's tick — LangtonField fast-forward,
            //    onTick callback применит каждый pending deploy при достижении
            //    соответствующего sim.tick.
            setMatchConfig({ ...msg.config, seed: msg.seed });
            setMatchId(msg.matchId);
            const map = new Map<number, DeployAction[]>();
            for (const d of msg.deployTimeline) {
              const arr = map.get(d.tick) ?? [];
              arr.push(d);
              map.set(d.tick, arr);
            }
            pendingDeploysByTickRef.current = map;
            currentTickRef.current = msg.tick;
            // Clear stale ghosts от прошлой connection
            setPendingGhosts([]);
            setStepSignal(msg.tick);
            setPhase('playing');
            setReconnectStatus('idle');
            break;
          }
          case 'pong':
            break;
        }
      },
      onClose: (code, reason) => {
        if (cancelled) return;
        // Day 13: если autoReconnect активен — показываем "reconnecting…"
        // вместо fatal error. Реальный error fired только если user explicitly
        // disconnected или матч закончился.
        setPhase((curr) => {
          if (curr === 'finished' || curr === 'error') return curr;
          // Normal closes (1000) во время lobby — не показываем error
          if (code === 1000 && curr === 'lobby') return curr;
          setReconnectStatus('reconnecting');
          setErrorText(`${t('match.connectionLost', 'Connection lost')} (${code} ${reason})`);
          return curr; // НЕ переключаемся в error, ждём reconnect attempt
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
        // Initial join (Day 13: resumeToken подкладывается через helper).
        sendJoin();
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
    // Day 13: explicit leave — token больше не валиден (server cleanup
    // ws.close handler immediate в lobby/finished phase). Если игрок вернётся
    // в эту же комнату — будет fresh join.
    if (roomCode) clearResumeToken(roomCode);
    wsRef.current?.disconnect();
    setScreen('menu');
  }, [setScreen, roomCode]);

  // Stage 8 Day 9: click на канвас → send deploy сообщение.
  // Stage 8 Day 10: + optimistic ghost для instant визуальной обратной связи.
  // Stage 8 Day 18: + 'deploy' sound для tactile feedback.
  // Reconciliation: ghost удаляется когда server echo'ит deploy в match_tick
  // (см. case 'match_tick') или присылает error('INVALID_DEPLOY').
  const handleDeployClick = useCallback((x: number, y: number) => {
    const idx = myPlayerIdxRef.current;
    if (idx == null || !wsRef.current) return;
    const tick = currentTickRef.current;
    wsRef.current.send({ type: 'deploy', tick, x, y });
    // Optimistic ghost (instant visual feedback ~RTT/2 раньше реального ant).
    setPendingGhosts((prev) => addGhost(prev, makeGhost(x, y, idx, tick)));
    fx.play('deploy');
  }, []);

  // Stage 8 Day 9: server-driven onTick callback.
  // LangtonField сделал step → sim.tick поднялся → достаём queued deploys для
  // этого тика и применяем через shared applyDeployAction.
  // Stage 8 Day 20: + live scoreboard recompute из текущей engine state.
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
    // Day 20: scoreboard recompute. computeScoreboard ~microsecond на 60×60,
    // безопасно на каждый tick. matchConfig.players и palette derived из
    // matchConfig — derived обновляется в полстроку.
    if (matchConfig) {
      setScoreboard(computeScoreboard(
        sim,
        matchConfig.players.map(p => ({ id: p.id, name: p.name })),
        palette,
      ));
    }
  }, [matchConfig, palette]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: T.bg, color: T.textPrimary,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar — Day 17: responsive flex-wrap для узких экранов */}
      <div style={{
        minHeight: 56, padding: isNarrow ? '8px 12px' : '0 24px',
        display: 'flex', alignItems: 'center', flexWrap: 'wrap',
        gap: isNarrow ? 8 : 14,
        borderBottom: `1px solid ${T.border}`, background: T.bgElevated,
      }}>
        <Button variant="ghost" size="sm" onClick={goBack}>
          ← {t('common.back', 'Back')}
        </Button>
        {!isNarrow && <Eyebrow>· {t('match.title', 'PvP Match')}</Eyebrow>}
        {roomCode && (
          <Chip color={T.info} size="sm">room: {roomCode}</Chip>
        )}
        <span style={{
          marginLeft: isNarrow ? 0 : 'auto',
          display: 'flex', gap: 8, flexWrap: 'wrap',
        }}>
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
          {!isNarrow && (
            <Chip color={T.accent} size="sm">
              👤 {nicknameRef.current}
            </Chip>
          )}
          {/* Day 18/26: speaker icon → opens VolumePanel popover (Day 26).
              Click also toggles muted state синхронизированы. */}
          <button
            type="button"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setVolumePanel({ right: r.right, top: r.top });
              // Sync local muted state — VolumePanel может изменить через checkbox
              setMuted(fx.isMuted());
            }}
            data-testid="mute-toggle"
            aria-label={t('match.audio', 'Audio settings')}
            title={t('match.audio', 'Audio settings')}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 28, padding: 0,
              background: 'transparent',
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusSm,
              color: muted ? T.textMuted : T.textPrimary,
              cursor: 'pointer',
              fontSize: 14, lineHeight: 1,
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </span>
      </div>

      {/* Main area — Day 17: smaller padding на мобиле чтобы canvas помещался */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: isNarrow ? 12 : 32,
        gap: isNarrow ? 12 : 24,
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
            scoreboard={scoreboard}
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
            replay={pvpReplay}
            onBack={goBack}
            onPlayAgain={() => {
              // Day 23: rematch flow — шлём request_rematch вместо back.
              // Server ждёт оба intent'а → rematch_reset → phase=lobby.
              if (iRequestedRematch) return; // idempotent защита
              setIRequestedRematch(true);
              wsRef.current?.send({ type: 'request_rematch' });
              fx.play('ui_click');
            }}
            iRequestedRematch={iRequestedRematch}
            opponentRequestedRematch={opponentRequestedRematch}
          />
        )}
        {phase === 'error' && (
          <ErrorView t={t} T={T} text={errorText} onBack={goBack} />
        )}
      </div>

      {/* Day 27: milestone banner — territory thresholds + lead changes */}
      {activeMilestone && (
        <MilestoneBanner
          milestone={activeMilestone}
          onDismiss={() => setActiveMilestone(null)}
        />
      )}

      {/* Day 26: volume panel popover (3 sliders + mute toggle) */}
      {volumePanel && (
        <VolumePanel
          anchorRight={volumePanel.right}
          anchorTop={volumePanel.top}
          onClose={() => {
            setVolumePanel(null);
            setMuted(fx.isMuted()); // sync icon после close
          }}
        />
      )}

      {/* Day 24: contextual onboarding hint — показывается один раз ever per
          hint id. activeHint computed в useEffect от phase. */}
      {activeHint && (
        <OnboardingHint
          icon={
            activeHint === 'match_lobby'    ? '👋'
            : activeHint === 'match_playing' ? '👆'
            : activeHint === 'match_finished' ? '🔁'
            : '💡'
          }
          text={
            activeHint === 'match_lobby'
              ? t('hint.lobby',
                  "Welcome! Click Ready when you're set. Need a friend? Share the QR code or URL above — they'll join your room.")
            : activeHint === 'match_playing'
              ? t('hint.playing',
                  'Click any cell on the field to deploy your ant. The match runs 30 seconds — whoever captures more territory wins.')
            : activeHint === 'match_finished'
              ? t('hint.finished',
                  'Match over! Click Play again — your opponent has to click too. Both agree → instant new match in the same room.')
            : ''
          }
          onDismiss={dismissActiveHint}
        />
      )}

      {/* Day 13: reconnect overlay (на всех phase кроме error/finished) */}
      {reconnectStatus !== 'idle' && phase !== 'error' && phase !== 'finished' && (
        <div data-testid="reconnect-overlay" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100,
        }}>
          <div style={{
            padding: '20px 28px',
            background: T.bgElevated,
            border: `1px solid ${T.warning}66`,
            borderRadius: T.radiusSm,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            maxWidth: 360,
            boxShadow: `0 8px 24px rgba(0,0,0,0.5)`,
          }}>
            <div style={{
              width: 32, height: 32,
              border: `3px solid ${T.border}`,
              borderTopColor: T.warning,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <div style={{
              fontSize: 13, color: T.textPrimary,
              fontFamily: 'JetBrains Mono, monospace', textAlign: 'center',
            }}>
              {reconnectStatus === 'reconnecting'
                ? t('match.reconnecting', 'Reconnecting…')
                : t('match.opponentAway', 'Opponent reconnecting…')}
            </div>
            {reconnectStatus === 'opponent_away' && (
              <div style={{
                fontSize: 11, color: T.textMuted,
                fontFamily: 'JetBrains Mono, monospace', textAlign: 'center',
                maxWidth: 280,
              }}>
                {t('match.graceHint', 'If they don\'t return in time you win by forfeit.')}
              </div>
            )}
          </div>
        </div>
      )}
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
  t, T, players, me, opponent, roomCode, onReadyToggle, onCopyUrl,
}: SubViewBase & {
  players: PlayerInfo[];
  me: PlayerInfo | undefined;
  opponent: PlayerInfo | undefined;
  roomCode: string;
  onReadyToggle: () => void;
  onCopyUrl: () => void;
}) {
  // Day 19: room invite URL — для QR code и Web Share.
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  // QR SVG memo'ится по URL, чтобы не пересчитывать на каждый render
  // (PlayerSlot ready toggle вызывает rerender LobbyView).
  const qrSvg = useMemo(
    () => shareUrl
      ? renderQrSvg(shareUrl, { size: 180, darkColor: T.textPrimary, lightColor: T.bg })
      : '',
    [shareUrl, T.textPrimary, T.bg],
  );

  // Web Share availability — лениво (не во время SSR).
  const webShareOk = useMemo(() => isWebShareAvailable(), []);

  const handleShare = useCallback(async () => {
    if (webShareOk) {
      const shared = await tryWebShare({
        title: 'Langton Arena · PvP match',
        text: `Join my room ${roomCode} on Langton Arena!`,
        url: shareUrl,
      });
      if (shared) return;
      // fallback на copy если share rejected (NotAllowedError)
    }
    onCopyUrl();
  }, [webShareOk, roomCode, shareUrl, onCopyUrl]);

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
          padding: 16,
          background: T.bgOverlay,
          border: `1px dashed ${T.border}`,
          borderRadius: T.radiusSm,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>
            {t('match.shareHint', 'Waiting for opponent — invite them to join:')}
          </div>

          {/* Day 19: QR code — point phone camera, join instantly */}
          {qrSvg && (
            <div
              data-testid="lobby-qr"
              style={{
                display: 'flex', justifyContent: 'center',
                padding: 8,
                background: T.bg,
                border: `1px solid ${T.border}`,
                borderRadius: T.radiusSm,
              }}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          )}

          {/* URL bar (на случай если QR не отсканировать) */}
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
            {shareUrl || '?room=...'}
          </div>

          {/* Day 19: Web Share API если доступен, иначе fallback copy */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            data-testid="share-button"
          >
            {webShareOk
              ? `📤 ${t('match.shareInvite', 'Share invite')}`
              : `📋 ${t('match.copyShareUrl', 'Copy URL')}`}
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
  ghostDeploys, rejectionToast, scoreboard,
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
  scoreboard: ScoreboardSummary | null;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 12,
      alignItems: 'center',
    }}>
      {/* Day 20: live scoreboard над канвасом — competitive visibility */}
      {scoreboard && (
        <LiveScoreboard
          T={T}
          summary={scoreboard}
          myPlayerIdx={myPlayerIdx}
        />
      )}
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

/**
 * Day 20: live territory scoreboard. Compact horizontal bar над канвасом.
 * Каждый игрок — карточка с цветным кружком, name, cells / percent.
 * Лидер подсвечивается небольшой границей. My slot выделяется ring'ом
 * чтобы не путать своё с чужим в 10-player режиме.
 */
function LiveScoreboard({
  T, summary, myPlayerIdx,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T: any;
  summary: ScoreboardSummary;
  myPlayerIdx: number | null;
}) {
  const leaderIdx = summary.entries[0]?.playerIdx ?? null;
  return (
    <div
      data-testid="live-scoreboard"
      style={{
        display: 'flex', gap: 8, flexWrap: 'wrap',
        justifyContent: 'center', alignItems: 'center',
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      {summary.entries.map((e) => {
        const isLeader = e.playerIdx === leaderIdx && summary.totalOwned > 0;
        const isMe = e.playerIdx === myPlayerIdx;
        return (
          <div
            key={e.playerIdx}
            data-testid={`scoreboard-p${e.playerIdx}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px',
              background: isLeader ? `${e.color}1A` : T.bgOverlay,
              border: `1px solid ${isLeader ? e.color : T.border}`,
              borderRadius: T.radiusSm,
              boxShadow: isMe ? `0 0 0 1.5px ${e.color}66 inset` : 'none',
              transition: 'background 0.2s, border-color 0.2s',
            }}
          >
            <span style={{
              display: 'inline-block',
              width: 10, height: 10,
              background: e.color,
              borderRadius: '50%',
              boxShadow: `0 0 6px ${e.color}99`,
            }} />
            <span style={{
              fontSize: 11, fontWeight: isMe ? 700 : 500,
              color: T.textPrimary, letterSpacing: 0.5,
              maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {e.name}{isMe ? ' (you)' : ''}
            </span>
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: e.color,
              minWidth: 32, textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {e.percent.toFixed(1)}%
            </span>
            <span style={{
              fontSize: 10, color: T.textMuted,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {e.cells}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FinishedView({
  t, T, result, myPlayer, players, palette, replayUrl, replay, onBack, onPlayAgain,
  iRequestedRematch, opponentRequestedRematch,
}: SubViewBase & {
  result: MatchResult;
  myPlayer: PlayerInfo | undefined;
  players: PlayerInfo[];
  palette: string[];
  replayUrl: string | null;
  replay: Replay | null;
  onBack: () => void;
  onPlayAgain: () => void;
  iRequestedRematch: boolean;
  opponentRequestedRematch: boolean;
}) {
  // Day 12: replay save state — "Save" / "Saved!" / "Already saved".
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'duplicate' | 'evicted'>('idle');
  const handleSave = useCallback(() => {
    if (!replay) return;
    const { saved, evictedId } = saveReplay(replay);
    if (!saved) {
      setSaveStatus('duplicate');
    } else if (evictedId) {
      setSaveStatus('evicted');
    } else {
      setSaveStatus('saved');
    }
  }, [replay]);
  const handleOpenInSandbox = useCallback(() => {
    if (!replay) return;
    // Ensure saved (idempotent: saveReplay returns saved:false если уже есть)
    saveReplay(replay);
    // Route в Sandbox с replay query param — Router.tsx читает ?replay=
    const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
    window.location.href = `${base}?replay=${encodeURIComponent(replay.metadata.id)}`;
  }, [replay]);
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
      case 'opponent_disconnected': return t('match.reason.opponentLeft', 'Opponent left the match');
      case 'server_shutdown': return t('match.reason.shutdown', 'Server is restarting — match cut short');
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
        flexWrap: 'wrap', justifyContent: 'center',
      }}>
        <Chip color={T.textMuted} size="sm">
          {t('match.finishedAtTick', 'tick')}: {result.finishedAtTick}
        </Chip>
        {replay && (
          <Chip color={T.info} size="sm">
            🎬 {replay.metadata.deployCount} {t('match.deploys', 'deploys')}
          </Chip>
        )}
        {replayUrl && !replay && (
          <Chip color={T.info} size="sm">
            <a href={replayUrl} style={{ color: 'inherit', textDecoration: 'none' }}>
              📼 {t('match.replay', 'Replay')}
            </a>
          </Chip>
        )}
      </div>

      {/* Day 12: Save replay row — две кнопки + status feedback */}
      {replay && (
        <div data-testid="replay-actions" style={{
          width: '100%', maxWidth: 360,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant={saveStatus === 'saved' || saveStatus === 'evicted' ? 'ghost' : 'primary'}
              size="sm" fullWidth onClick={handleSave}
              disabled={saveStatus === 'saved' || saveStatus === 'evicted'}
            >
              {saveStatus === 'idle' && `💾 ${t('match.saveReplay', 'Save replay')}`}
              {saveStatus === 'saved' && `✓ ${t('match.savedReplay', 'Saved!')}`}
              {saveStatus === 'duplicate' && `✓ ${t('match.alreadySaved', 'Already saved')}`}
              {saveStatus === 'evicted' && `✓ ${t('match.savedEvicted', 'Saved (FIFO evict)')}`}
            </Button>
            <Button variant="ghost" size="sm" fullWidth onClick={handleOpenInSandbox}>
              🔬 {t('match.openInSandbox', 'Open in Sandbox')}
            </Button>
          </div>
          <div style={{
            fontSize: 10, color: T.textMuted, fontFamily: 'JetBrains Mono, monospace',
            textAlign: 'center',
          }}>
            {t('match.replayHint', 'Replay stored locally — Sandbox → Replays to play back.')}
          </div>
        </div>
      )}

      {/* Day 23: opponent rematch hint (показывается до того как сами кликнем) */}
      {opponentRequestedRematch && !iRequestedRematch && (
        <div data-testid="opponent-wants-rematch" style={{
          padding: '8px 14px',
          background: `${T.success}15`,
          border: `1px solid ${T.success}66`,
          borderRadius: T.radiusSm,
          fontSize: 12, color: T.success,
          fontFamily: 'JetBrains Mono, monospace',
          textAlign: 'center',
        }}>
          🔁 {t('match.opponentWantsRematch', 'Opponent wants a rematch — click Play again to accept')}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 360 }}>
        <Button variant="ghost" size="md" fullWidth onClick={onBack}>
          ← {t('match.backToMenu', 'Back to menu')}
        </Button>
        <Button
          variant={iRequestedRematch ? 'ghost' : 'primary'}
          size="md"
          fullWidth
          onClick={onPlayAgain}
          disabled={iRequestedRematch}
          data-testid="play-again-button"
        >
          {iRequestedRematch
            ? `⏳ ${t('match.waitingRematch', 'Waiting for opponent...')}`
            : `🔁 ${t('match.playAgain', 'Play again')}`}
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
