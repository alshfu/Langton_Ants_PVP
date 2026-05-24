// src/ui/Mono.tsx
import React from 'react';
import { useTheme } from '@theme/ThemeProvider';

export function Mono({
  children, size = 12, color, weight = 500, style,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  weight?: number;
  style?: React.CSSProperties;
}) {
  const { tokens: T } = useTheme();
  return (
    <span style={{
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: size,
      fontWeight: weight,
      color: color ?? T.textPrimary,
      ...style,
    }}>{children}</span>
  );
}
