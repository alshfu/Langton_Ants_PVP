// src/ui/Button.tsx
import React from 'react';
import { useTheme } from '@theme/ThemeProvider';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  style,
  children,
  ...rest
}: ButtonProps) {
  const { tokens: T } = useTheme();
  const padding = size === 'sm' ? '8px 14px' : size === 'lg' ? '14px 28px' : '10px 20px';
  const fontSize = size === 'sm' ? 12 : size === 'lg' ? 16 : 14;
  const base: React.CSSProperties = {
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 600,
    letterSpacing: 0.2,
    borderRadius: T.radiusMd,
    padding, fontSize,
    width: fullWidth ? '100%' : 'auto',
    transition: 'transform .12s, background .12s, opacity .12s',
  };
  let palette: React.CSSProperties;
  if (variant === 'primary') {
    palette = { background: T.accent, color: T.bg };
  } else if (variant === 'danger') {
    palette = { background: T.danger, color: '#fff' };
  } else {
    palette = { background: T.bgOverlay, color: T.textPrimary, border: `1px solid ${T.border}` };
  }
  return (
    <button {...rest} style={{ ...base, ...palette, ...style }}>
      {children}
    </button>
  );
}
