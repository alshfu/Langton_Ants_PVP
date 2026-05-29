// src/components/OnboardingHint.tsx
//
// Stage 8 Day 24: contextual onboarding hint banner.
//
// Floating bottom-center баннер с подсказкой для new users. Auto-dismiss
// через `autoDismissMs` или click "Got it" button. На dismiss вызывает
// `onDismiss()` — caller записывает hint id в localStorage чтобы больше
// не показывать.

import { useEffect, useState } from 'react';
import { useTheme } from '@theme/ThemeProvider';

export interface OnboardingHintProps {
  /** Текст подсказки (короткий, 1-2 предложения). */
  text: string;
  /** Optional иконка слева (emoji). */
  icon?: string;
  /** Auto-dismiss через N мс. Default 8000 (8 секунд). */
  autoDismissMs?: number;
  /** Callback на закрытие — записать id в localStorage. */
  onDismiss: () => void;
  /** Label кнопки dismiss. Default "Got it". */
  dismissLabel?: string;
}

export function OnboardingHint({
  text, icon, autoDismissMs = 8000, onDismiss, dismissLabel = 'Got it',
}: OnboardingHintProps) {
  const { tokens: T } = useTheme();
  const [visible, setVisible] = useState(true);

  // Auto-dismiss timer
  useEffect(() => {
    if (autoDismissMs <= 0) return;
    const id = setTimeout(() => handleDismiss(), autoDismissMs);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDismissMs]);

  const handleDismiss = () => {
    setVisible(false);
    // Delay onDismiss callback чтобы exit animation сыграла
    setTimeout(() => onDismiss(), 200);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="onboarding-hint"
      style={{
        position: 'fixed',
        bottom: 24, left: '50%',
        transform: visible
          ? 'translateX(-50%) translateY(0)'
          : 'translateX(-50%) translateY(20px)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
        zIndex: 200,
        maxWidth: 'min(440px, calc(100vw - 32px))',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px',
        background: T.bgElevated,
        border: `1px solid ${T.accent}66`,
        borderRadius: T.radiusSm,
        boxShadow: `0 6px 24px rgba(0,0,0,0.5), 0 0 24px ${T.accent}33`,
        animation: 'hint-pop 0.3s ease-out',
      }}
    >
      {icon && (
        <span aria-hidden="true" style={{
          fontSize: 22, lineHeight: 1,
          filter: `drop-shadow(0 0 6px ${T.accent}aa)`,
        }}>
          {icon}
        </span>
      )}
      <span style={{
        flex: 1,
        fontSize: 13,
        color: T.textPrimary,
        lineHeight: 1.4,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        {text}
      </span>
      <button
        type="button"
        onClick={handleDismiss}
        data-testid="onboarding-hint-dismiss"
        style={{
          padding: '6px 12px',
          background: T.accent,
          color: T.bg,
          border: 'none',
          borderRadius: T.radiusSm,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.5,
          cursor: 'pointer',
          fontFamily: 'JetBrains Mono, monospace',
          whiteSpace: 'nowrap',
        }}
      >
        {dismissLabel}
      </button>
      <style>{`@keyframes hint-pop {
        0% { transform: translateX(-50%) translateY(40px); opacity: 0; }
        100% { transform: translateX(-50%) translateY(0); opacity: 1; }
      }`}</style>
    </div>
  );
}
