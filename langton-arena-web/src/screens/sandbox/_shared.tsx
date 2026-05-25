// src/screens/sandbox/_shared.tsx
//
// Маленькие переиспользуемые блоки для всех табов sandbox.
// Цель: единый визуальный язык внутри правой панели.

import React from 'react';
import { useTheme } from '@theme/ThemeProvider';
import { Eyebrow } from '@ui/Eyebrow';

/** Секция с заголовком — обёртка для группы контролов. */
export function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Eyebrow>{title}</Eyebrow>
        {right}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

/** Один параметр: label слева, контрол справа. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const { tokens: T } = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 11, color: T.textMuted, fontFamily: 'JetBrains Mono, monospace' }}>
          {label}
        </span>
        {hint && (
          <span style={{ fontSize: 10, color: T.textDim, fontFamily: 'JetBrains Mono, monospace' }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/** Селект в стиле проекта. */
export function Select<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  disabled?: boolean;
}) {
  const { tokens: T } = useTheme();
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      style={{
        background: T.bgOverlay,
        color: T.textPrimary,
        border: `1px solid ${T.border}`,
        borderRadius: T.radiusSm,
        padding: '6px 8px',
        fontSize: 12,
        fontFamily: 'JetBrains Mono, monospace',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: '100%',
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

/** Маленький round button для +/× контекстов. */
export function IconButton({
  onClick,
  title,
  variant = 'ghost',
  children,
  disabled,
}: {
  onClick: () => void;
  title: string;
  variant?: 'ghost' | 'danger' | 'primary';
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const { tokens: T } = useTheme();
  const colors = {
    ghost:   { bg: T.bgOverlay, fg: T.textPrimary, border: T.border },
    danger:  { bg: 'transparent', fg: T.danger, border: T.border },
    primary: { bg: T.accent, fg: T.bg, border: T.accent },
  }[variant];

  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        width: 24, height: 24,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: colors.bg, color: colors.fg,
        border: `1px solid ${colors.border}`,
        borderRadius: T.radiusSm,
        fontSize: 12, fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        padding: 0,
      }}
    >{children}</button>
  );
}

/** Цветной свотч + название игрока — для списков. */
export function PlayerSwatch({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 3,
      background: color,
      flexShrink: 0,
    }}/>
  );
}
