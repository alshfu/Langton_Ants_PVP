// src/lib/publicReplays.ts
//
// Stage 9.5: REST client для public replays — Sandbox → Replays tab.
//
// Endpoints (см. mvp-server/src/replaysApi.ts):
//   GET /api/replays              — list
//   GET /api/replays/:matchId     — detail
//
// API host derivation такая же как WSClient: prod = window.host:8080
// (через nginx → 127.0.0.1:8080), localhost иначе. Override через
// VITE_API_BASE_URL для dev/E2E.

export interface PublicReplayListItem {
  matchId: string;
  startedAt: number;
  finishedAt: number | null;
  durationTicks: number | null;
  winnerNickname: string | null;
  reason: string;
  winConditionKind: string | null;
  participants: Array<{ nickname: string; territoryPct: number }>;
}

export interface PublicReplayDetail {
  matchId: string;
  startedAt: number;
  finishedAt: number | null;
  durationTicks: number | null;
  reason: string;
  config: unknown;
  replay: unknown | null;
  participants: Array<{ nickname: string; territoryPct: number }>;
  winnerNickname: string | null;
}

export interface ListQuery {
  limit?: number;
  offset?: number;
  winConditionKind?: string;
  since?: number;
}

export function getApiBaseUrl(): string {
  const env = (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env;
  if (env?.VITE_API_BASE_URL) return env.VITE_API_BASE_URL.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // GH Pages статика — VPS хостит API на alshfu.com (nginx → 127.0.0.1:8080).
    if (host.endsWith('github.io')) return 'https://alshfu.com';
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      // Same-origin — работает если reverse proxy настроен на /api.
      return `${window.location.protocol}//${host}`;
    }
  }
  return 'http://localhost:8080';
}

export async function listPublicReplays(q: ListQuery = {}): Promise<{
  items: PublicReplayListItem[];
  total: number;
  limit: number;
  offset: number;
}> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams();
  if (q.limit != null) params.set('limit', String(q.limit));
  if (q.offset != null) params.set('offset', String(q.offset));
  if (q.winConditionKind) params.set('kind', q.winConditionKind);
  if (q.since != null) params.set('since', String(q.since));
  const qs = params.toString();
  const url = `${base}/api/replays${qs ? '?' + qs : ''}`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function fetchPublicReplay(matchId: string): Promise<PublicReplayDetail> {
  const base = getApiBaseUrl();
  const url = `${base}/api/replays/${encodeURIComponent(matchId)}`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}
