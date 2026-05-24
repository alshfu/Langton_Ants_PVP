// src/ui/Chip.tsx
import React from 'react';
import { useTheme } from '@theme/ThemeProvider';

export function Chip({
  color,
  filled = false,
  size = 'md',
  children,
  style,
}: {
  color?: string;
  filled?: boolean;
  size?: 'sm' | 'md';
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const { tokens: T } = useTheme();
  const c = color ?? T.accent;
  const fs = size === 'sm' ? 10 : 11;
  const pad = size === 'sm' ? '3px 8px' : '4px 10px';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: pad, borderRadius: T.radiusFull,
      fontSize: fs, fontWeight: 600,
      background: filled ? c : `${c}22`,
      color: filled ? T.bg : c,
      ...style,
    }}>{children}</span>
  );
}
