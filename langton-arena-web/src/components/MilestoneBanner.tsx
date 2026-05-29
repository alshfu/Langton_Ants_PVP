// src/components/MilestoneBanner.tsx
//
// Stage 8 Day 27: floating top-center banner для milestone events.
//
// Auto-dismiss 2.5 секунды. Animated entry (slide-down + scale-up) и
// exit (fade-out + scale-down). Цвет border'а зависит от accent.

import { useEffect, useState } from 'react';
import { useTheme } from '@theme/ThemeProvider';
import type { Milestone } from '@lib/matchMilestones';

export interface MilestoneBannerProps {
  milestone: Milestone;
  onDismiss: () => void;
  /** Auto-dismiss ms. Default 2500. */
  autoDismissMs?: number;
}

export function MilestoneBanner({
  milestone, onDismiss, autoDismissMs = 2500,
}: MilestoneBannerProps) {
  const { tokens: T } = useTheme();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (autoDismissMs <= 0) return;
    const id = setTimeout(() => handleDismiss(), autoDismissMs);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDismissMs]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss(), 250);
  };

  // Color per accent: positive=green/gold, critical=red, comeback=violet
  const accentColor =
    milestone.accent === 'positive' ? T.success
    : milestone.accent === 'critical' ? T.danger
    : '#C77DFF'; // violet for comeback

  return (
    <div
      role="status"
      aria-live="assertive"
      data-testid={`milestone-${milestone.id}`}
      style={{
        position: 'fixed',
        top: 80, left: '50%',
        transform: visible
          ? 'translateX(-50%) translateY(0) scale(1)'
          : 'translateX(-50%) translateY(-10px) scale(0.92)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.25s ease-out, opacity 0.25s ease-out',
        zIndex: 80,
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 24px',
        background: T.bgElevated,
        border: `2px solid ${accentColor}`,
        borderRadius: T.radiusSm,
        boxShadow: `0 6px 32px rgba(0,0,0,0.55), 0 0 32px ${accentColor}55`,
        animation: 'milestone-pop 0.4s ease-out',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={handleDismiss}
    >
      <span aria-hidden="true" style={{
        fontSize: 28, lineHeight: 1,
        filter: `drop-shadow(0 0 8px ${accentColor}aa)`,
      }}>
        {milestone.icon}
      </span>
      <span style={{
        fontSize: 16,
        fontWeight: 700,
        color: accentColor,
        letterSpacing: 1,
        textTransform: 'uppercase',
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        {milestone.label}
      </span>
      <style>{`@keyframes milestone-pop {
        0%   { transform: translateX(-50%) translateY(-40px) scale(0.5); opacity: 0; }
        40%  { transform: translateX(-50%) translateY(0) scale(1.15); opacity: 1; }
        70%  { transform: translateX(-50%) translateY(0) scale(0.96); }
        100% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
      }`}</style>
    </div>
  );
}
