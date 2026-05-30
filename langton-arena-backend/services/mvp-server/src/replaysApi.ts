// src/replaysApi.ts
//
// Stage 9.5: REST API для browse public replays.
//
// Endpoints:
//   GET /api/replays                     — list (paginated, filterable)
//   GET /api/replays/:matchId            — full replay payload (config + deploys)
//
// Все responses JSON, с CORS headers разрешающими client (хостинг
// на GitHub Pages, другой origin).

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext } from './serverContext.js';
import type { MatchRecord, User } from './persistence.js';

/** Shape возвращаемая в list endpoint. */
export interface ReplayListItem {
  matchId: string;
  startedAt: number;
  finishedAt: number | null;
  durationTicks: number | null;
  winnerNickname: string | null;
  reason: string;
  winConditionKind: string | null;
  participants: Array<{ nickname: string; territoryPct: number }>;
}

/** Shape full detail endpoint. */
export interface ReplayDetail {
  matchId: string;
  startedAt: number;
  finishedAt: number | null;
  durationTicks: number | null;
  reason: string;
  config: unknown;            // SandboxConfig — серверу не нужно strict parse
  replay: unknown | null;     // Replay payload — может быть null если не stored
  participants: Array<{ nickname: string; territoryPct: number }>;
  winnerNickname: string | null;
}

function jsonResponse(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

function notFound(res: ServerResponse): void {
  jsonResponse(res, 404, { error: 'not_found' });
}

function nicknameByUserId(usersMap: Record<string, User>, userId: string): string {
  const u = usersMap[userId];
  return u?.nickname ?? 'Anonymous';
}

function toListItem(rec: MatchRecord, usersMap: Record<string, User>): ReplayListItem {
  let winConditionKind: string | null = null;
  try {
    const cfg = JSON.parse(rec.configJson) as { winCondition?: { kind?: string } };
    winConditionKind = cfg.winCondition?.kind ?? null;
  } catch { /* leave null */ }
  const participants = rec.participants.map((p) => ({
    nickname: nicknameByUserId(usersMap, p.userId),
    territoryPct: p.finalTerritoryPct,
  }));
  return {
    matchId: rec.id,
    startedAt: rec.startedAt,
    finishedAt: rec.finishedAt ?? null,
    durationTicks: rec.durationTicks ?? null,
    winnerNickname: rec.winnerUserId ? nicknameByUserId(usersMap, rec.winnerUserId) : null,
    reason: rec.reason,
    winConditionKind,
    participants,
  };
}

function toDetail(rec: MatchRecord, usersMap: Record<string, User>): ReplayDetail {
  let config: unknown = null;
  try { config = JSON.parse(rec.configJson); } catch { /* leave null */ }
  let replay: unknown = null;
  if (rec.replayJson) {
    try { replay = JSON.parse(rec.replayJson); } catch { /* leave null */ }
  }
  const participants = rec.participants.map((p) => ({
    nickname: nicknameByUserId(usersMap, p.userId),
    territoryPct: p.finalTerritoryPct,
  }));
  return {
    matchId: rec.id,
    startedAt: rec.startedAt,
    finishedAt: rec.finishedAt ?? null,
    durationTicks: rec.durationTicks ?? null,
    reason: rec.reason,
    config,
    replay,
    participants,
    winnerNickname: rec.winnerUserId ? nicknameByUserId(usersMap, rec.winnerUserId) : null,
  };
}

export async function handleReplaysApi(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: ServerContext,
): Promise<void> {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }
  if (req.method !== 'GET') {
    jsonResponse(res, 405, { error: 'method_not_allowed' });
    return;
  }

  const url = req.url ?? '';
  // Strip query, work with path.
  const qIdx = url.indexOf('?');
  const path = qIdx >= 0 ? url.slice(0, qIdx) : url;
  const queryString = qIdx >= 0 ? url.slice(qIdx + 1) : '';
  const params = new URLSearchParams(queryString);

  // Build usersMap once для O(1) nickname lookup при serializing.
  // Не используем direct access — persistence interface не exposes.
  // Workaround: use getUserStats lazy, или extract from state via duck-typing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const directUsers = (ctx.persistence as any).state?.users as
    | Record<string, User>
    | undefined;
  const usersMap: Record<string, User> = directUsers ?? {};

  // GET /api/replays — list
  if (path === '/api/replays' || path === '/api/replays/') {
    const limit = parseIntOrDefault(params.get('limit'), 20);
    const offset = parseIntOrDefault(params.get('offset'), 0);
    const winConditionKind = params.get('kind') ?? undefined;
    const since = params.get('since');
    const sinceMs = since ? Number.isFinite(Number(since)) ? Number(since) : Date.parse(since) : undefined;
    const finishedOnlyParam = params.get('finishedOnly');
    const finishedOnly = finishedOnlyParam == null ? true : finishedOnlyParam !== 'false';

    const result = await ctx.persistence.queryMatches({
      limit, offset, winConditionKind,
      since: sinceMs && Number.isFinite(sinceMs) ? sinceMs : undefined,
      finishedOnly,
    });
    jsonResponse(res, 200, {
      items: result.items.map((r) => toListItem(r, usersMap)),
      total: result.total,
      limit, offset,
    });
    return;
  }

  // GET /api/replays/:matchId — detail
  const detailMatch = /^\/api\/replays\/([^/]+)$/.exec(path);
  if (detailMatch) {
    const matchId = decodeURIComponent(detailMatch[1]!);
    const rec = await ctx.persistence.getMatch(matchId);
    if (!rec) {
      notFound(res);
      return;
    }
    jsonResponse(res, 200, toDetail(rec, usersMap));
    return;
  }

  notFound(res);
}

function parseIntOrDefault(s: string | null, dflt: number): number {
  if (s == null) return dflt;
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return dflt;
  return n;
}
