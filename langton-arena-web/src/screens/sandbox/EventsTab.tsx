// src/screens/sandbox/EventsTab.tsx
//
// Лента событий симуляции с фильтром по типам.
// Reverse-chronological: новые сверху. Click на event → step back.

import { useState, useMemo } from 'react';
import { useTheme } from '@theme/ThemeProvider';
import { useLiveStats } from '@state/LiveStatsContext';
import { Section } from './_shared';
import { EventCard } from './EventCard';
import type { LogEventType } from '@core/contract/state';

interface EventsTabProps {
  onJumpTo: (tick: number) => void;
}

const ALL_TYPES: LogEventType[] = ['capture', 'clash', 'death', 'birth', 'hybrid', 'wild'];

export function EventsTab({ onJumpTo }: EventsTabProps) {
  const { tokens: T } = useTheme();
  const stats = useLiveStats();

  // По умолчанию все включены кроме captures (их слишком много — спамят лог)
  const [enabledTypes, setEnabledTypes] = useState<Set<LogEventType>>(
    () => new Set(['clash', 'death', 'birth', 'hybrid', 'wild']),
  );

  const toggleType = (t: LogEventType) => {
    setEnabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const filteredEvents = useMemo(
    () => stats.events.filter((e) => enabledTypes.has(e.type)),
    [stats.events, enabledTypes],
  );

  // Reverse: новые сверху
  const displayList = useMemo(
    () => [...filteredEvents].reverse(),
    [filteredEvents],
  );

  return (
    <div>
      <Section title="Filter">
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 4,
        }}>
          {ALL_TYPES.map((t) => {
            const on = enabledTypes.has(t);
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                style={{
                  padding: '4px 10px',
                  background: on ? T.accent : T.bgOverlay,
                  color: on ? T.bg : T.textMuted,
                  border: `1px solid ${on ? T.accent : T.border}`,
                  borderRadius: T.radiusSm,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >{t}</button>
            );
          })}
        </div>
      </Section>

      <Section title={`Log · ${filteredEvents.length} of ${stats.events.length} events`}>
        {enabledTypes.size === 0 ? (
          <div style={{
            padding: 12, fontSize: 10, color: T.textMuted,
            fontFamily: 'JetBrains Mono, monospace',
            background: T.bgOverlay, borderRadius: T.radiusSm,
            border: `1px dashed ${T.border}`,
            textAlign: 'center',
          }}>
            Enable at least one event type
          </div>
        ) : displayList.length === 0 ? (
          <div style={{
            padding: 12, fontSize: 10, color: T.textMuted,
            fontFamily: 'JetBrains Mono, monospace',
            background: T.bgOverlay, borderRadius: T.radiusSm,
            border: `1px dashed ${T.border}`,
            textAlign: 'center',
          }}>
            No events yet — run the simulation.
          </div>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 3,
            maxHeight: 500, overflowY: 'auto',
          }}>
            {displayList.map((e) => (
              <EventCard key={e.id} event={e} onJumpTo={onJumpTo} />
            ))}
          </div>
        )}

        {stats.events.length >= 500 && (
          <div style={{
            marginTop: 8,
            padding: 6, fontSize: 9,
            color: T.warning,
            fontFamily: 'JetBrains Mono, monospace',
            background: T.warning + '15',
            border: `1px dashed ${T.warning}40`,
            borderRadius: T.radiusSm,
          }}>
            Ring buffer full · oldest events being overwritten
          </div>
        )}
      </Section>
    </div>
  );
}
