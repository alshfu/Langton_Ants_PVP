// src/components/BotInviteDialog.tsx
//
// Stage 8 Day 31: dialog для выбора difficulty при invite бота.
//
// Показывается из LobbyView когда opponent slot empty и player кликает
// "Play vs Bot". 3 кнопки (Easy / Normal / Hard) + Cancel. Esc и backdrop
// click закрывают.

import { useEffect } from 'react';
import { useTheme } from '@theme/ThemeProvider';
import type { BotDifficulty } from '@lib/botPlayer';

export interface BotInviteDialogProps {
  onSelect: (difficulty: BotDifficulty) => void;
  onCancel: () => void;
}

const DIFFICULTIES: Array<{
  id: BotDifficulty;
  icon: string;
  label: string;
  description: string;
}> = [
  {
    id: 'easy',
    icon: '🟢',
    label: 'Easy',
    description: 'Slow + random deploys. Good for testing the game.',
  },
  {
    id: 'normal',
    icon: '🟡',
    label: 'Normal',
    description: 'Moderate speed, aims for your side. Reasonable challenge.',
  },
  {
    id: 'hard',
    icon: '🔴',
    label: 'Hard',
    description: 'Fast + aggressive. Targets your territory.',
  },
];

export function BotInviteDialog({ onSelect, onCancel }: BotInviteDialogProps) {
  const { tokens: T } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <>
      {/* Backdrop */}
      <div
        role="presentation"
        onClick={onCancel}
        style={{
          position: 'fixed', inset: 0, zIndex: 110,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(2px)',
        }}
      />
      <div
        role="dialog"
        aria-label="Choose bot difficulty"
        data-testid="bot-invite-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 115,
          width: 'min(420px, calc(100vw - 32px))',
          padding: 20,
          background: T.bgElevated,
          border: `1px solid ${T.border}`,
          borderRadius: T.radiusSm,
          boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
          fontFamily: 'JetBrains Mono, monospace',
          display: 'flex', flexDirection: 'column', gap: 14,
          animation: 'dialog-pop 0.25s ease-out',
        }}
      >
        <div style={{
          fontSize: 11, color: T.textMuted, letterSpacing: 1.5,
          textTransform: 'uppercase', fontWeight: 700,
        }}>
          🤖 Play vs Bot
        </div>
        <div style={{
          fontSize: 12, color: T.textPrimary, lineHeight: 1.4,
        }}>
          Choose difficulty. The bot will join immediately and the match starts.
        </div>

        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelect(d.id)}
              data-testid={`bot-difficulty-${d.id}`}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '10px 12px',
                background: T.bgOverlay,
                border: `1px solid ${T.border}`,
                borderRadius: T.radiusSm,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'JetBrains Mono, monospace',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = T.bgElevated;
                e.currentTarget.style.borderColor = T.accent;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = T.bgOverlay;
                e.currentTarget.style.borderColor = T.border;
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>
                {d.icon}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: T.textPrimary,
                  letterSpacing: 0.5,
                }}>
                  {d.label}
                </span>
                <span style={{
                  fontSize: 10, color: T.textMuted, lineHeight: 1.4,
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}>
                  {d.description}
                </span>
              </div>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCancel}
          data-testid="bot-cancel"
          style={{
            padding: '8px 14px',
            background: 'transparent',
            color: T.textMuted,
            border: `1px solid ${T.border}`,
            borderRadius: T.radiusSm,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.5,
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          Cancel
        </button>

        <style>{`@keyframes dialog-pop {
          0%   { transform: translate(-50%, -50%) scale(0.85); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }`}</style>
      </div>
    </>
  );
}
