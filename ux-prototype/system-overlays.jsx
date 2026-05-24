// system-overlays.jsx — global overlays: toasts, modals, connection banner, ping indicator.
// All read from AppState; all dispatch through actions.

// ─────────────────────────────────────────────────────────────────────────────
// TOASTS — stacked top-right, 4 types, swipe-to-dismiss
// ─────────────────────────────────────────────────────────────────────────────

const TOAST_STYLE = {
  info:    { bg: 'rgba(77,168,255,.14)',  border: 'rgba(77,168,255,.40)',  fg: T.info, icon: 'i' },
  success: { bg: 'rgba(57,217,138,.14)',  border: 'rgba(57,217,138,.40)',  fg: T.success, icon: '✓' },
  warning: { bg: 'rgba(255,138,61,.14)',  border: 'rgba(255,138,61,.40)',  fg: T.warning, icon: '!' },
  error:   { bg: 'rgba(255,69,58,.14)',   border: 'rgba(255,69,58,.42)',   fg: T.danger, icon: '×' },
};

function Toast({ toast, onDismiss, onAction }) {
  const style = TOAST_STYLE[toast.type] || TOAST_STYLE.info;
  const ref = React.useRef(null);
  const [dragX, setDragX] = React.useState(0);
  const drag = React.useRef({ start: 0, active: false });

  // Auto-dismiss
  React.useEffect(() => {
    if (toast.durationMs <= 0) return;
    const id = setTimeout(() => onDismiss?.(toast.id), toast.durationMs);
    return () => clearTimeout(id);
  }, [toast.id]);

  const onPointerDown = (e) => { drag.current = { start: e.clientX, active: true }; };
  const onPointerMove = (e) => { if (drag.current.active) setDragX(e.clientX - drag.current.start); };
  const onPointerUp = () => {
    if (Math.abs(dragX) > 80) onDismiss?.(toast.id);
    else setDragX(0);
    drag.current.active = false;
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      style={{
        background: T.bgElevated, border: `1px solid ${style.border}`,
        borderLeft: `3px solid ${style.fg}`, borderRadius: 10, padding: '12px 14px',
        minWidth: 280, maxWidth: 360, color: T.textPrimary,
        display: 'flex', alignItems: 'flex-start', gap: 12,
        boxShadow: '0 12px 32px rgba(0,0,0,.45)', fontFamily: 'Inter, system-ui, sans-serif',
        transform: `translateX(${dragX}px)`,
        opacity: 1 - Math.min(0.6, Math.abs(dragX) / 200),
        transition: drag.current.active ? 'none' : 'transform .2s ease-out, opacity .2s',
        cursor: 'grab', userSelect: 'none', touchAction: 'pan-y',
      }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', background: style.bg, border: `1px solid ${style.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: style.fg, fontWeight: 800, fontSize: 12, flexShrink: 0,
      }}>{toast.icon || style.icon}</div>
      <div style={{ flex: 1, fontSize: 13, lineHeight: 1.45, paddingTop: 2 }}>
        {toast.message}
        {toast.action ? (
          <button
            onClick={() => onAction?.(toast.id)}
            style={{
              display: 'block', marginTop: 6, background: 'none', border: 'none',
              color: style.fg, fontWeight: 700, fontSize: 11, letterSpacing: 0.6,
              textTransform: 'uppercase', cursor: 'pointer', padding: 0,
            }}>{toast.action.label} →</button>
        ) : null}
      </div>
      <button
        onClick={() => onDismiss?.(toast.id)}
        aria-label="dismiss"
        style={{
          background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer',
          fontSize: 18, lineHeight: 1, padding: 0, marginTop: -2,
        }}>×</button>
    </div>
  );
}

function ToastStack({ toasts = [], onDismiss, onAction, position = 'top-right' }) {
  if (!toasts?.length) return null;
  const pos = {
    'top-right':    { top: 20, right: 20 },
    'top-left':     { top: 20, left: 20 },
    'bottom-right': { bottom: 20, right: 20 },
    'bottom-left':  { bottom: 20, left: 20 },
  }[position];
  return (
    <div style={{
      position: 'absolute', ...pos, zIndex: 9000,
      display: 'flex', flexDirection: 'column', gap: 10,
      pointerEvents: 'none',
    }}>
      {toasts.map((t) => (
        <div key={t.id} className="arena-fadeUp" style={{ pointerEvents: 'auto' }}>
          <Toast toast={t} onDismiss={onDismiss} onAction={onAction} />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL — confirm/alert/input
// ─────────────────────────────────────────────────────────────────────────────

function Modal({ modal, onClose, onAction }) {
  React.useEffect(() => {
    if (!modal) return;
    const h = (e) => { if (e.key === 'Escape' && modal.cancelable) onClose?.(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [modal]);

  const [inputValue, setInputValue] = React.useState('');
  if (!modal) return null;

  return (
    <div
      onClick={() => modal.cancelable && onClose?.()}
      style={{
        position: 'absolute', inset: 0, zIndex: 9500,
        background: 'rgba(8,6,16,.72)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
        animation: 'fadeUp .25s ease-out',
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 440, maxWidth: '92%',
          background: T.bgElevated, border: '1px solid rgba(255,255,255,.10)',
          borderRadius: 16, padding: 28, color: T.textPrimary,
          boxShadow: '0 24px 72px rgba(0,0,0,.6)',
        }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>{modal.title}</h3>
        <p style={{ margin: '12px 0 20px', color: T.textSecondary, fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
          {modal.body}
        </p>

        {modal.type === 'input' ? (
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={modal.placeholder || 'Type here…'}
            autoFocus
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              background: T.bg, border: '1px solid rgba(255,255,255,.12)',
              color: T.textPrimary, fontFamily: 'Inter, sans-serif', fontSize: 13,
              marginBottom: 16, outline: 'none',
            }}/>
        ) : null}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          {modal.buttons.map((b, i) => (
            <button
              key={i}
              autoFocus={b.autoFocus}
              onClick={() => onAction?.(b.actionId, modal.type === 'input' ? inputValue : undefined)}
              style={{
                appearance: 'none', cursor: 'pointer',
                padding: '10px 18px', borderRadius: 8, fontWeight: 700, fontSize: 12,
                letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: 'inherit',
                ...(b.variant === 'primary' ? {
                  background: T.accent, color: T.bg, border: 'none',
                  boxShadow: '0 4px 12px rgba(255,214,10,.30)',
                } : b.variant === 'danger' ? {
                  background: T.danger, color: '#FFFFFF', border: 'none',
                  boxShadow: '0 4px 12px rgba(255,69,58,.30)',
                } : {
                  background: 'transparent', color: T.textPrimary,
                  border: '1px solid rgba(255,255,255,.18)',
                }),
              }}>{b.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTION BANNER
// ─────────────────────────────────────────────────────────────────────────────

function ConnectionBanner({ connection, onReconnect, onCancel }) {
  if (!connection || connection.status === 'connected') return null;
  const map = {
    disconnected: { fg: T.danger, label: 'Disconnected',  body: 'Lost connection to the server', spinner: false },
    connecting:   { fg: T.info, label: 'Connecting…',   body: connection.serverUrl,            spinner: true  },
    reconnecting: { fg: T.warning, label: 'Reconnecting…', body: `Attempt ${5 - (connection.attemptsRemaining || 0)}/5`, spinner: true },
    error:        { fg: T.danger, label: 'Connection error', body: connection.lastError || 'Server unreachable', spinner: false },
  };
  const m = map[connection.status] || map.disconnected;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 8000,
      background: `linear-gradient(180deg, ${m.fg}28, ${m.fg}08)`,
      borderBottom: `1px solid ${m.fg}55`,
      backdropFilter: 'blur(6px)',
      padding: '10px 24px',
      display: 'flex', alignItems: 'center', gap: 14,
      fontFamily: 'Inter, system-ui, sans-serif', color: T.textPrimary,
      animation: 'fadeUp .3s ease-out',
    }}>
      {m.spinner ? (
        <div style={{
          width: 14, height: 14, borderRadius: '50%',
          border: `2px solid ${m.fg}40`, borderTopColor: m.fg,
          animation: 'spin360 .9s linear infinite',
        }} />
      ) : (
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.fg, boxShadow: `0 0 8px ${m.fg}` }} />
      )}
      <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 12, fontSize: 12 }}>
        <strong style={{ color: m.fg, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{m.label}</strong>
        <span style={{ color: T.textSecondary }}>{m.body}</span>
      </div>
      {connection.status === 'error' ? (
        <>
          <button onClick={onReconnect} style={btnGhostMini(m.fg)}>Retry</button>
          <button onClick={onCancel} style={btnGhostMini(T.textMuted)}>Cancel</button>
        </>
      ) : null}
    </div>
  );
}

function btnGhostMini(color) {
  return {
    appearance: 'none', cursor: 'pointer', background: 'transparent',
    border: `1px solid ${color}66`, color, padding: '4px 12px', borderRadius: 6,
    fontFamily: 'inherit', fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PING INDICATOR — colored per contract §7.6
// ─────────────────────────────────────────────────────────────────────────────

function pingColor(ms) {
  if (ms < 30)  return { fg: T.success, dots: 5 };
  if (ms < 80)  return { fg: T.accent, dots: 4 };
  if (ms < 150) return { fg: T.warning, dots: 3 };
  return                { fg: T.danger, dots: 2 };
}

function PingIndicator({ pingMs = 32, jitter = 4, compact = false }) {
  const p = pingColor(pingMs);
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: compact ? '4px 8px' : '6px 12px', borderRadius: 999,
      background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
      fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11,
      color: T.textPrimary,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{
            width: 2.5, height: 3 + i * 2,
            background: i <= p.dots ? p.fg : 'rgba(255,255,255,.18)',
            borderRadius: 1, transition: 'background .2s',
          }} />
        ))}
      </div>
      <span style={{ color: p.fg, fontWeight: 600 }}>{pingMs}<span style={{ color: T.textMuted, fontWeight: 400 }}> ms</span></span>
      {!compact && jitter ? <span style={{ color: T.textDim }}>±{jitter}</span> : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SystemOverlays — bundle all overlays for a given AppState
// ─────────────────────────────────────────────────────────────────────────────
function SystemOverlays({ data, actions }) {
  return (
    <>
      <ConnectionBanner
        connection={data.connection}
        onReconnect={actions.onReconnect}
        onCancel={actions.onCancelReconnect}
      />
      <ToastStack
        toasts={data.toasts}
        onDismiss={actions.onToastDismiss}
        onAction={actions.onToastAction}
        position="top-right"
      />
      <Modal
        modal={data.modal}
        onClose={actions.onModalClose}
        onAction={actions.onModalAction}
      />
    </>
  );
}

Object.assign(window, {
  Toast, ToastStack, Modal, ConnectionBanner, PingIndicator, SystemOverlays, pingColor,
});
