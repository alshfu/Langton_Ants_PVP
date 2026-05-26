// src/screens/sandbox/EventCard.tsx
//
// Карточка одного события в списке EventsTab. Кликабельная — отправляет
// onStepBack до этого tick.

import { useTheme } from '@theme/ThemeProvider';
import { useAppState } from '@state/AppStateProvider';
import type { LogEvent, LogEventType } from '@core/contract/state';

interface EventCardProps {
  event: LogEvent;
  /** При клике — откатиться к этому tick через step back. */
  onJumpTo: (tick: number) => void;
}

const EVENT_LABELS: Record<LogEventType, string> = {
  capture: 'capture',
  clash:   'clash',
  death:   'death',
  birth:   'birth',
  hybrid:  'hybrid',
  wild:    'wild',
};

export function EventCard({ event, onJumpTo }: EventCardProps) {
  const { tokens: T } = useTheme();
  const { state } = useAppState();
  const players = state.sandbox.players;

  // Цвет точки/акцента по типу события
  const dotColor = (() => {
    switch (event.type) {
      case 'capture': return T.info;
      case 'clash':   return T.warning;
      case 'death':   return T.danger;
      case 'birth':   return T.success;
      case 'hybrid':  return '#C77DFF';
      case 'wild':    return '#8E8E93';
    }
  })();

  // Описание: имя игрока + детали
  const playerName = event.ownerIdx >= 0 && event.ownerIdx < players.length
    ? players[event.ownerIdx]!.name
    : event.ownerIdx === 255 ? 'wild' : '?';
  const playerColor = event.ownerIdx >= 0 && event.ownerIdx < players.length
    ? players[event.ownerIdx]!.color
    : '#8E8E93';

  const description = (() => {
    switch (event.type) {
      case 'capture': return `${playerName} took cell`;
      case 'clash':   return `${event.meta?.ants ?? '?'} ants clashed`;
      case 'death':   return `${playerName} ant died`;
      case 'birth':   return `${playerName} ant born`;
      case 'hybrid':  return `${playerName} hybrid born`;
      case 'wild':    return `wild ant born`;
    }
  })();

  return (
    <button
      onClick={() => onJumpTo(event.tick)}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 8px',
        background: T.bgOverlay,
        borderTop: 'none',
        borderRight: 'none',
        borderBottom: 'none',
        borderLeft: `2px solid ${dotColor}`,
        borderRadius: T.radiusSm,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        color: T.textPrimary,
      }}
      title={`Click to step back to tick ${event.tick}`}
    >
      <span style={{
        minWidth: 56,
        color: T.textDim,
      }}>t{event.tick}</span>
      <span style={{
        minWidth: 50,
        color: dotColor,
        fontWeight: 600,
      }}>{EVENT_LABELS[event.type]}</span>
      <span style={{
        flex: 1, minWidth: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        color: T.textPrimary,
      }}>
        <span style={{
          display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
          background: playerColor, marginRight: 6, verticalAlign: 'middle',
        }}/>
        {description}
      </span>
      <span style={{ color: T.textDim }}>
        ({event.x},{event.y})
      </span>
    </button>
  );
}
