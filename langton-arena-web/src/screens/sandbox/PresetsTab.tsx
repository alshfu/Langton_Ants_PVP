// src/screens/sandbox/PresetsTab.tsx
//
// Список встроенных пресетов + пользовательские (из localStorage).
// При клике на пресет — загружается в state.sandbox.
// Можно сохранить текущую конфигурацию как новый user-preset.

import { useEffect, useState } from 'react';
import { useTheme } from '@theme/ThemeProvider';
import { useAppState } from '@state/AppStateProvider';
import { loadBuiltinPresets } from '@state/presets';
import type { BuiltinPreset } from '@core/contract/state';
import { Button } from '@ui/Button';
import { Section, IconButton } from './_shared';

export function PresetsTab() {
  const { tokens: T } = useTheme();
  const { state, sandbox: sx } = useAppState();
  const [builtin, setBuiltin] = useState<BuiltinPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveDialog, setSaveDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadBuiltinPresets().then((p) => {
      if (!cancelled) {
        setBuiltin(p);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSave = () => {
    const name = newName.trim() || `Preset ${state.userPresets.length + 1}`;
    const res = sx.saveUserPreset(name);
    if (res.ok) {
      showToast(`Saved as "${name}"`);
      setNewName('');
      setSaveDialog(false);
    } else {
      showToast(res.reason ?? 'Save failed');
    }
  };

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 70, right: 24, zIndex: 100,
          padding: '8px 14px',
          background: T.bgElevated,
          border: `1px solid ${T.accent}`,
          borderRadius: T.radiusSm,
          color: T.textPrimary, fontSize: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,.4)',
        }}>{toast}</div>
      )}

      {/* Save current */}
      <Section title="Save current">
        {!saveDialog ? (
          <Button
            variant="primary" size="sm" fullWidth
            onClick={() => setSaveDialog(true)}
            disabled={state.userPresets.length >= 10}
          >
            💾 Save as preset ({state.userPresets.length} / 10)
          </Button>
        ) : (
          <div style={{
            padding: 10, background: T.bgOverlay, borderRadius: T.radiusSm,
            border: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Preset name"
              maxLength={40}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setSaveDialog(false);
              }}
              style={{
                background: T.bg, color: T.textPrimary,
                border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
                padding: '6px 8px', fontSize: 12,
              }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="primary" size="sm" onClick={handleSave} style={{ flex: 1 }}>Save</Button>
              <Button variant="ghost" size="sm" onClick={() => { setSaveDialog(false); setNewName(''); }} style={{ flex: 1 }}>Cancel</Button>
            </div>
          </div>
        )}
      </Section>

      {/* Built-in */}
      <Section title="Built-in">
        {loading && (
          <div style={{ fontSize: 11, color: T.textMuted, padding: 8 }}>Loading...</div>
        )}
        {!loading && builtin.length === 0 && (
          <div style={{ fontSize: 11, color: T.warning, padding: 8 }}>
            No presets found. Check /presets/index.json.
          </div>
        )}
        {builtin.map((p) => (
          <div
            key={p.id}
            onClick={() => { sx.loadPreset(p.config); showToast(`Loaded "${p.name}"`); }}
            style={{
              padding: 10, cursor: 'pointer',
              background: T.bgOverlay, border: `1px solid ${T.border}`,
              borderRadius: T.radiusSm,
              display: 'flex', flexDirection: 'column', gap: 4,
              transition: 'background .15s, border .15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = T.accent;
              e.currentTarget.style.background = T.accentMuted;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = T.border;
              e.currentTarget.style.background = T.bgOverlay;
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: T.textPrimary }}>
                ★ {p.name}
              </div>
              <span style={{ fontSize: 10, color: T.textMuted, fontFamily: 'JetBrains Mono, monospace' }}>
                {p.config.players.length}p
              </span>
            </div>
            <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.4 }}>
              {p.description}
            </div>
            {p.tags && p.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                {p.tags.map((tag) => (
                  <span key={tag} style={{
                    fontSize: 9, padding: '2px 6px',
                    background: T.bg, color: T.textMuted,
                    borderRadius: 999, fontFamily: 'JetBrains Mono, monospace',
                  }}>{tag}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </Section>

      {/* User presets */}
      <Section title={`My presets · ${state.userPresets.length} / 10`}>
        {state.userPresets.length === 0 ? (
          <div style={{
            padding: 12, fontSize: 11, color: T.textMuted,
            textAlign: 'center', fontFamily: 'JetBrains Mono, monospace',
            border: `1px dashed ${T.border}`, borderRadius: T.radiusSm,
          }}>
            No saved presets yet
          </div>
        ) : (
          state.userPresets.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: 10,
                background: T.bgOverlay,
                border: `1px solid ${T.border}`,
                borderRadius: T.radiusSm,
              }}
            >
              <div
                onClick={() => { sx.loadPreset(p.config); showToast(`Loaded "${p.name}"`); }}
                style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, color: T.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 10, color: T.textMuted, fontFamily: 'JetBrains Mono, monospace' }}>
                  {p.config.players.length}p · {new Date(p.createdAt).toLocaleDateString()}
                </div>
              </div>
              <IconButton
                onClick={() => sx.deleteUserPreset(p.id)}
                title="Delete"
                variant="danger"
              >×</IconButton>
            </div>
          ))
        )}
      </Section>
    </div>
  );
}
