// src/ui/Logo.tsx
import { useTheme } from '@theme/ThemeProvider';

export function Logo({ size = 24 }: { size?: number }) {
  const { tokens: T } = useTheme();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <rect x="6"  y="6"  width="8" height="8" rx="1" fill={T.textPrimary} opacity=".4"/>
      <rect x="16" y="6"  width="8" height="8" rx="1" fill={T.textPrimary} opacity=".6"/>
      <rect x="6"  y="16" width="8" height="8" rx="1" fill={T.textPrimary} opacity=".8"/>
      <rect x="16" y="16" width="8" height="8" rx="1" fill={T.accent}/>
      <circle cx="22" cy="22" r="2" fill={T.bg}/>
    </svg>
  );
}
