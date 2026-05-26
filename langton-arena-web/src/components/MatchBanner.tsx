// src/components/MatchBanner.tsx
//
// Banner поверх канваса когда match.finished && match.bannerVisible.
// Полупрозрачный overlay с именем победителя.
// Click Continue → bannerVisible=false (но finished остаётся true).
// Click Reset → onReset (обычно switchToEdit).

import { useTheme } from '@theme/ThemeProvider';
import { useAppState } from '@state/AppStateProvider';
import type { MatchResult } from '@core/contract/state';

interface MatchBannerProps {
  match: MatchResult;
  onContinue: () => void;
  onReset: () => void;
}

export function MatchBanner({ match, onContinue, onReset }: MatchBannerProps) {
  const { tokens: T } = useTheme();
  const { state } = useAppState();

  if (!match.finished || !match.bannerVisible) return null;

  // Цвет рамки по winner'у (если есть)
  const winnerPlayer = match.winnerId
    ? state.sandbox.players.find((p) => p.id === match.winnerId)
    : null;
  const accent = winnerPlayer?.color ?? T.warning;

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0, 0, 0, .50)',
      backdropFilter: 'blur(2px)',
      zIndex: 50,
      pointerEvents: 'auto',
    }}>
      <div style={{
        padding: '24px 32px',
        background: T.bgElevated,
        border: `2px solid ${accent}`,
        borderRadius: T.radiusSm,
        boxShadow: `0 0 40px ${accent}40, 0 8px 32px rgba(0,0,0,.5)`,
        textAlign: 'center',
        minWidth: 320,
        maxWidth: 480,
      }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>
          {match.winnerId ? '🏆' : '🤝'}
        </div>
        <div style={{
          fontSize: 18, fontWeight: 700,
          color: T.textPrimary,
          marginBottom: 6,
          letterSpacing: 0.5,
        }}>
          {match.winnerName
            ? <><span style={{ color: accent }}>{match.winnerName}</span> wins</>
            : 'Draw — all eliminated'}
        </div>
        <div style={{
          fontSize: 11, color: T.textMuted,
          fontFamily: 'JetBrains Mono, monospace',
          marginBottom: 20,
        }}>
          {match.reason} · tick {match.finishedAtTick}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button
            onClick={onContinue}
            style={{
              padding: '8px 18px',
              background: T.bgOverlay,
              color: T.textPrimary,
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusSm,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}
          >Continue watching</button>
          <button
            onClick={onReset}
            style={{
              padding: '8px 18px',
              background: accent,
              color: T.bg,
              border: 'none',
              borderRadius: T.radiusSm,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
            }}
          >New match</button>
        </div>
      </div>
    </div>
  );
}
