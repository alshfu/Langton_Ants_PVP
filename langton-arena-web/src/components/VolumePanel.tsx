// src/components/VolumePanel.tsx
//
// Stage 8 Day 26: popover с volume sliders + mute toggle.
//
// Открывается click'ом на mute button в top bar (MatchScreen / SandboxScreen).
// Click outside (overlay) или Esc → closes. 3 sliders: Master / Music / SFX.
// Mute checkbox внутри. Persistence через fx (localStorage).

import { useEffect, useState, useCallback } from 'react';
import { useTheme } from '@theme/ThemeProvider';
import { fx, getVolumes } from '@lib/audio';

export interface VolumePanelProps {
  /** Anchor coords для positioning popover (typically right edge of mute button). */
  anchorRight: number;
  anchorTop: number;
  onClose: () => void;
}

export function VolumePanel({ anchorRight, anchorTop, onClose }: VolumePanelProps) {
  const { tokens: T } = useTheme();
  const [vol, setVol] = useState(() => getVolumes());
  const [muted, setMuted] = useState(() => fx.isMuted());

  // Esc → close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleMaster = useCallback((v: number) => {
    fx.setVolume({ master: v });
    setVol((s) => ({ ...s, master: v }));
  }, []);
  const handleMusic = useCallback((v: number) => {
    fx.setVolume({ music: v });
    setVol((s) => ({ ...s, music: v }));
  }, []);
  const handleSfx = useCallback((v: number) => {
    fx.setVolume({ sfx: v });
    setVol((s) => ({ ...s, sfx: v }));
  }, []);
  const handleMute = useCallback(() => {
    const next = !muted;
    fx.setMuted(next);
    setMuted(next);
  }, [muted]);

  return (
    <>
      {/* Backdrop — клик закрывает */}
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 90,
          background: 'transparent',
        }}
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-label="Audio volume controls"
        data-testid="volume-panel"
        style={{
          position: 'fixed',
          // Try to anchor to right of mute button, else stick to right edge of viewport.
          right: Math.max(8, window.innerWidth - anchorRight),
          top: anchorTop + 36,
          zIndex: 95,
          width: 240,
          padding: 14,
          background: T.bgElevated,
          border: `1px solid ${T.border}`,
          borderRadius: T.radiusSm,
          boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
          fontFamily: 'JetBrains Mono, monospace',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          fontSize: 11, color: T.textMuted, letterSpacing: 1,
          textTransform: 'uppercase',
        }}>
          Audio
        </div>

        <VolumeRow
          T={T}
          label="Master"
          value={vol.master}
          onChange={handleMaster}
          testId="vol-master"
        />
        <VolumeRow
          T={T}
          label="Music"
          value={vol.music}
          onChange={handleMusic}
          testId="vol-music"
        />
        <VolumeRow
          T={T}
          label="SFX"
          value={vol.sfx}
          onChange={handleSfx}
          testId="vol-sfx"
        />

        <div style={{
          height: 1, background: T.border, margin: '4px 0',
        }} />

        <label style={{
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 12, color: T.textPrimary, cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={muted}
            onChange={handleMute}
            data-testid="vol-mute"
            style={{ cursor: 'pointer' }}
          />
          <span>{muted ? '🔇 Muted' : '🔊 Sound on'}</span>
        </label>

        <div style={{
          fontSize: 9, color: T.textMuted, lineHeight: 1.5,
          paddingTop: 4, borderTop: `1px dashed ${T.border}66`,
        }}>
          Settings persist across sessions.
          <br />Press Esc or click outside to close.
        </div>
      </div>
    </>
  );
}

interface VolumeRowProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T: any;
  label: string;
  value: number;
  onChange: (v: number) => void;
  testId: string;
}

function VolumeRow({ T, label, value, onChange, testId }: VolumeRowProps) {
  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 10, color: T.textMuted, marginBottom: 4,
      }}>
        <span>{label}</span>
        <span style={{
          fontVariantNumeric: 'tabular-nums',
          color: value === 0 ? T.textMuted : T.textPrimary,
        }}>
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(parseInt(e.target.value, 10) / 100)}
        data-testid={testId}
        style={{
          width: '100%',
          accentColor: T.accent,
          cursor: 'pointer',
        }}
      />
    </div>
  );
}
