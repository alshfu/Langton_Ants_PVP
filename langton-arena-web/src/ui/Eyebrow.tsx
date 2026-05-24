// src/ui/Eyebrow.tsx
import React from 'react';
import { useTheme } from '@theme/ThemeProvider';

export function Eyebrow({ children, color, style }: { children: React.ReactNode; color?: string; style?: React.CSSProperties }) {
  const { tokens: T } = useTheme();
  return (
    <span style={{
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 10,
      letterSpacing: 2,
      textTransform: 'uppercase',
      color: color ?? T.textMuted,
      ...style,
    }}>{children}</span>
  );
}
