// src/screens/sandbox/TabStrip.tsx
//
// Вертикальная полоса табов слева от tab content.
// Иконка + короткий лейбл. По наведению — tooltip с полным описанием.

import { useTheme } from '@theme/ThemeProvider';

export type SandboxTabId = 'players' | 'ants' | 'stats' | 'field' | 'combat' | 'birth' | 'visual' | 'presets';

interface TabDef {
  id: SandboxTabId;
  icon: string;
  label: string;
  description: string;
}

const TABS: TabDef[] = [
  { id: 'players', icon: '👥', label: 'Players', description: 'Add, remove, configure players (2-10)' },
  { id: 'ants',    icon: '🐜', label: 'Ants',    description: 'Individual ants of active player' },
  { id: 'stats',   icon: '📊', label: 'Stats',   description: 'Live statistics during simulation' },
  { id: 'field',   icon: '⬜', label: 'Field',   description: 'Size, topology, background' },
  { id: 'combat',  icon: '⚔',  label: 'Combat',  description: 'HP, damage cap, cooldown' },
  { id: 'birth',   icon: '✚',  label: 'Birth',   description: 'Reproduction, hybrids, wilds' },
  { id: 'visual',  icon: '✨', label: 'Visual',  description: 'Glow, trails, ant scale, skins' },
  { id: 'presets', icon: '★',  label: 'Presets', description: 'Load and save scenarios' },
];

export function TabStrip({
  active,
  onChange,
}: {
  active: SandboxTabId;
  onChange: (id: SandboxTabId) => void;
}) {
  const { tokens: T } = useTheme();
  return (
    <div style={{
      width: 64,
      borderRight: `1px solid ${T.border}`,
      background: T.bgElevated,
      display: 'flex', flexDirection: 'column',
      flexShrink: 0,
    }}>
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            title={`${tab.label} — ${tab.description}`}
            style={{
              padding: '14px 0 12px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              background: isActive ? T.accentMuted : 'transparent',
              // Используем только long-form borders — нельзя мешать border (shorthand) с borderLeft (specific)
              borderTop: 'none',
              borderRight: 'none',
              borderBottom: 'none',
              borderLeft: `3px solid ${isActive ? T.accent : 'transparent'}`,
              borderRadius: 0,
              cursor: 'pointer',
              color: isActive ? T.accent : T.textMuted,
              transition: 'background .15s, color .15s',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = T.bgOverlay;
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = 'transparent';
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
            <span style={{
              fontSize: 9, fontWeight: 600,
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
