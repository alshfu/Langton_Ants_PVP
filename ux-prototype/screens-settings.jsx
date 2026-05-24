// screens-settings.jsx — Settings screen, all 8 categories per contract §4.12.
// Layout: left sidebar with section list, right scrollable panel with controls.

const SETTINGS_SECTIONS = [
  { id: 'graphics',      label: 'Graphics',      icon: '◇' },
  { id: 'audio',         label: 'Audio',         icon: '♪' },
  { id: 'controls',      label: 'Controls',      icon: '◈' },
  { id: 'gameplay',      label: 'Gameplay',      icon: '▶' },
  { id: 'accessibility', label: 'Accessibility', icon: '◉' },
  { id: 'notifications', label: 'Notifications', icon: '✦' },
  { id: 'privacy',       label: 'Privacy',       icon: '◐' },
  { id: 'account',       label: 'Account',       icon: '☉' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Primitive controls
// ─────────────────────────────────────────────────────────────────────────────

function Row({ label, hint, children, gap = 16 }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto',
      gap, alignItems: 'center', padding: '16px 0',
      borderBottom: '1px solid rgba(255,255,255,.06)',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: (T.textPrimary) }}>{label}</div>
        {hint ? <div style={{ fontSize: 11, color: (T.textMuted), marginTop: 3, lineHeight: 1.5 }}>{hint}</div> : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{children}</div>
    </div>
  );
}

function ToggleSwitch({ on, onChange }) {
  return (
    <button
      onClick={() => onChange?.(!on)}
      style={{
        width: 38, height: 22, borderRadius: 999, position: 'relative',
        background: on ? (T.accent) : T.borderStrong,
        border: `1px solid ${on ? (T.accent) : T.borderStrong}`,
        cursor: 'pointer', transition: 'all .18s ease-out', padding: 0,
      }}>
      <div style={{
        position: 'absolute', top: 2, left: on ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: on ? (T.bg) : (T.textPrimary),
        transition: 'left .18s ease-out',
      }} />
    </button>
  );
}

function Segmented({ value, options, onChange }) {
  return (
    <div style={{
      display: 'inline-flex', background: 'rgba(255,255,255,.04)',
      border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: 3,
    }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange?.(o.value)}
          style={{
            appearance: 'none', cursor: 'pointer',
            background: value === o.value ? (T.accent) : 'transparent',
            color: value === o.value ? (T.bg) : T.textSecondary,
            fontWeight: value === o.value ? 700 : 500,
            padding: '6px 12px', borderRadius: 6, border: 'none',
            fontSize: 11, letterSpacing: 0.3, textTransform: 'uppercase',
            fontFamily: 'Inter, sans-serif',
            transition: 'all .15s ease-out',
          }}>{o.label}</button>
      ))}
    </div>
  );
}

function Slider({ value = 0.5, min = 0, max = 1, step = 0.01, onChange, label, valueLabel }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 220 }}>
      <div style={{ position: 'relative', flex: 1, height: 4, background: T.borderStrong, borderRadius: 999 }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: (T.accent),
          borderRadius: 999, boxShadow: '0 0 6px rgba(255,214,10,.6)',
        }} />
        <div style={{
          position: 'absolute', left: `calc(${pct}% - 7px)`, top: -5,
          width: 14, height: 14, borderRadius: '50%',
          background: (T.accent), boxShadow: '0 2px 8px rgba(255,214,10,.6)',
        }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange?.(parseFloat(e.target.value))}
          style={{ position: 'absolute', inset: 0, width: '100%', height: 18, opacity: 0, cursor: 'pointer' }}/>
      </div>
      <span style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: (T.accent),
        minWidth: 48, textAlign: 'right',
      }}>{valueLabel || (Math.round(value * 100) + '%')}</span>
    </div>
  );
}

function Select({ value, options, onChange, width = 180 }) {
  return (
    <select value={value} onChange={(e) => onChange?.(e.target.value)}
      style={{
        appearance: 'none', cursor: 'pointer',
        background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.10)',
        color: (T.textPrimary), padding: '8px 28px 8px 12px', borderRadius: 8,
        fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 500,
        width, outline: 'none',
        backgroundImage: 'linear-gradient(45deg, transparent 50%, #8E8E93 50%), linear-gradient(135deg, #8E8E93 50%, transparent 50%)',
        backgroundPosition: `calc(100% - 14px) 50%, calc(100% - 10px) 50%`,
        backgroundSize: '4px 4px, 4px 4px',
        backgroundRepeat: 'no-repeat',
      }}>
      {options.map((o) => <option key={o.value} value={o.value} style={{ background: T.bgElevated }}>{o.label}</option>)}
    </select>
  );
}

function HotkeyDisplay({ binding, onRebind }) {
  return (
    <button onClick={onRebind} style={{
      appearance: 'none', cursor: 'pointer',
      background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)',
      color: (T.textPrimary), padding: '6px 12px', borderRadius: 6,
      fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 600,
      letterSpacing: 0.5, minWidth: 90,
    }}>{binding || 'Unbound'}</button>
  );
}

function GroupHeading({ children, sub }) {
  return (
    <div style={{ paddingTop: 32, paddingBottom: 4 }}>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 600,
        letterSpacing: 2, textTransform: 'uppercase', color: (T.accent),
      }}>{children}</div>
      {sub ? <div style={{ fontSize: 11, color: (T.textMuted), marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────────────────────────────────────

function SectionGraphics({ s, set }) {
  return (
    <div>
      <GroupHeading sub="performance, visual fidelity, motion">visuals</GroupHeading>
      <Row label="Quality preset" hint="One-tap performance vs fidelity">
        <Segmented value={s.quality} onChange={(v) => set('quality', v)}
          options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Med' }, { value: 'high', label: 'High' }]} />
      </Row>
      <Row label="Cell glow" hint="Soft bloom around active cells">
        <ToggleSwitch on={s.glowEnabled} onChange={(v) => set('glowEnabled', v)} />
      </Row>
      <Row label="Trails" hint="Show fading trail behind ants">
        <ToggleSwitch on={s.trailsEnabled} onChange={(v) => set('trailsEnabled', v)} />
      </Row>
      <Row label="Particle effects" hint="Captures, deaths, hybrid births">
        <ToggleSwitch on={s.particleEffects} onChange={(v) => set('particleEffects', v)} />
      </Row>
      <Row label="Background simulation in menu" hint="Disable to save battery">
        <ToggleSwitch on={s.backgroundSimulation} onChange={(v) => set('backgroundSimulation', v)} />
      </Row>
      <Row label="FPS limit" hint="Cap frame rate · 60 default">
        <Select value={s.fpsLimit ?? 'unlimited'} onChange={(v) => set('fpsLimit', v === 'unlimited' ? null : Number(v))}
          options={[
            { value: 30, label: '30 fps' }, { value: 60, label: '60 fps' },
            { value: 120, label: '120 fps' }, { value: 144, label: '144 fps' },
            { value: 'unlimited', label: 'Unlimited' },
          ]} width={140}/>
      </Row>
    </div>
  );
}

function SectionAudio({ s, set }) {
  return (
    <div>
      <GroupHeading sub="volume mixers">levels</GroupHeading>
      <Row label="Master volume"><Slider value={s.masterVolume} onChange={(v) => set('masterVolume', v)} /></Row>
      <Row label="Music"><Slider value={s.musicVolume} onChange={(v) => set('musicVolume', v)} /></Row>
      <Row label="Sound effects"><Slider value={s.sfxVolume} onChange={(v) => set('sfxVolume', v)} /></Row>
      <Row label="UI sounds"><Slider value={s.uiVolume} onChange={(v) => set('uiVolume', v)} /></Row>
      <GroupHeading>behaviour</GroupHeading>
      <Row label="Mute when window is hidden" hint="Cuts audio when you tab away">
        <ToggleSwitch on={s.muteWhenInBackground} onChange={(v) => set('muteWhenInBackground', v)} />
      </Row>
    </div>
  );
}

function SectionControls({ s, set }) {
  const hotkeyEntries = Object.entries(s.hotkeys || {});
  return (
    <div>
      <GroupHeading sub="pan, zoom and follow">camera</GroupHeading>
      <Row label="Invert X" hint="Flip horizontal panning">
        <ToggleSwitch on={s.cameraInvertX} onChange={(v) => set('cameraInvertX', v)} />
      </Row>
      <Row label="Invert Y" hint="Flip vertical panning">
        <ToggleSwitch on={s.cameraInvertY} onChange={(v) => set('cameraInvertY', v)} />
      </Row>
      <Row label="Sensitivity" hint="How fast the camera moves">
        <Slider value={s.cameraSensitivity} min={0.5} max={2.0} step={0.05}
          onChange={(v) => set('cameraSensitivity', v)} valueLabel={`×${s.cameraSensitivity.toFixed(2)}`} />
      </Row>
      <Row label="Auto-follow important events" hint="Snaps camera to clashes, lead changes, deaths">
        <ToggleSwitch on={s.autoCameraEnabled} onChange={(v) => set('autoCameraEnabled', v)} />
      </Row>

      <GroupHeading sub="click any key to rebind">hotkeys</GroupHeading>
      {hotkeyEntries.map(([action, key]) => (
        <Row key={action} label={action.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())} hint="">
          <HotkeyDisplay binding={key.replace('Digit', '').replace('Key', '')} />
        </Row>
      ))}
    </div>
  );
}

function SectionGameplay({ s, set }) {
  return (
    <div>
      <GroupHeading>in-match overlay</GroupHeading>
      <Row label="Show damage numbers" hint="Floating −1 above hit ants">
        <ToggleSwitch on={s.showDamageNumbers} onChange={(v) => set('showDamageNumbers', v)} />
      </Row>
      <Row label="Show HP dots" hint="3 dots under each ant for HP">
        <ToggleSwitch on={s.showHpDots} onChange={(v) => set('showHpDots', v)} />
      </Row>
      <Row label="Auto-pan to events" hint="Move camera to where the action is">
        <ToggleSwitch on={s.autoPanToEvents} onChange={(v) => set('autoPanToEvents', v)} />
      </Row>
      <Row label="Quickchat" hint="Allow sending emotes during match">
        <ToggleSwitch on={s.quickChatEnabled} onChange={(v) => set('quickChatEnabled', v)} />
      </Row>
    </div>
  );
}

function SectionAccessibility({ s, set }) {
  const themeCtx = (window.useTheme && window.useTheme()) || null;
  return (
    <div>
      <GroupHeading sub="visibility and motion">readability</GroupHeading>
      <Row label="Theme" hint="Live preview · uses theme tokens from themes.jsx">
        <Segmented value={themeCtx?.theme || 'dark'} onChange={(v) => themeCtx?.set?.(v)}
          options={[
            { value: 'dark',         label: 'Dark' },
            { value: 'light',        label: 'Light' },
            { value: 'highContrast', label: 'A11y' },
          ]}/>
      </Row>
      <Row label="Colorblind mode" hint="Adjusts palette per WCAG">
        <Select value={s.colorblindMode} onChange={(v) => set('colorblindMode', v)} width={180}
          options={[
            { value: 'off',           label: 'Off' },
            { value: 'protanopia',    label: 'Protanopia' },
            { value: 'deuteranopia',  label: 'Deuteranopia' },
            { value: 'tritanopia',    label: 'Tritanopia' },
          ]}/>
      </Row>
      <Row label="High contrast" hint="Switches the active theme to high-contrast">
        <ToggleSwitch on={s.highContrast} onChange={(v) => {
          set('highContrast', v);
          themeCtx?.set?.(v ? 'highContrast' : 'dark');
        }} />
      </Row>
      <Row label="Large text" hint="Bumps font sizes by ~20%">
        <ToggleSwitch on={s.largeText} onChange={(v) => set('largeText', v)} />
      </Row>
      <Row label="Reduced motion" hint="Disables non-essential animations">
        <ToggleSwitch on={s.reducedMotion} onChange={(v) => set('reducedMotion', v)} />
      </Row>
      <Row label="Screen reader hints" hint="Adds aria labels and live regions">
        <ToggleSwitch on={s.screenReader} onChange={(v) => set('screenReader', v)} />
      </Row>
      <Row label="Font size">
        <Segmented value={s.fontSize} onChange={(v) => set('fontSize', v)}
          options={[
            { value: 'small',  label: 'S' },
            { value: 'normal', label: 'M' },
            { value: 'large',  label: 'L' },
            { value: 'xlarge', label: 'XL' },
          ]}/>
      </Row>
    </div>
  );
}

function SectionNotifications({ s, set }) {
  return (
    <div>
      <GroupHeading>in-app notifications</GroupHeading>
      <Row label="Friend comes online" hint="Toast in lower-right corner">
        <ToggleSwitch on={s.showFriendOnline} onChange={(v) => set('showFriendOnline', v)} />
      </Row>
      <Row label="Achievement unlocked" hint="Banner + sound">
        <ToggleSwitch on={s.showAchievements} onChange={(v) => set('showAchievements', v)} />
      </Row>
      <Row label="Rank promotion" hint="Full-screen reveal on rank-up">
        <ToggleSwitch on={s.showRankPromotions} onChange={(v) => set('showRankPromotions', v)} />
      </Row>
    </div>
  );
}

function SectionPrivacy({ s, set }) {
  return (
    <div>
      <GroupHeading>visibility</GroupHeading>
      <Row label="Profile visibility" hint="Who can see your stats">
        <Select value={s.profileVisibility} onChange={(v) => set('profileVisibility', v)} width={140}
          options={[
            { value: 'public',  label: 'Public' },
            { value: 'friends', label: 'Friends only' },
            { value: 'private', label: 'Private' },
          ]}/>
      </Row>
      <Row label="Show online status" hint="Others see when you're playing">
        <ToggleSwitch on={s.showOnlineStatus} onChange={(v) => set('showOnlineStatus', v)} />
      </Row>
      <GroupHeading>social</GroupHeading>
      <Row label="Allow friend requests"><ToggleSwitch on={s.allowFriendRequests} onChange={(v) => set('allowFriendRequests', v)} /></Row>
      <Row label="Allow chat requests"><ToggleSwitch on={s.allowChatRequests} onChange={(v) => set('allowChatRequests', v)} /></Row>
    </div>
  );
}

function SectionAccount({ s, set, user }) {
  return (
    <div>
      <GroupHeading>profile</GroupHeading>
      <Row label="Username" hint={`Changed: ${user?.usernameChangedAt ? new Date(user.usernameChangedAt).toLocaleDateString() : 'never'}`}>
        <div style={{
          padding: '8px 14px', borderRadius: 8,
          background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.10)',
          fontFamily: 'Inter, sans-serif', fontSize: 13, color: (T.textPrimary), minWidth: 200,
        }}>{user?.username || 'unknown'}</div>
        <button style={{
          appearance: 'none', cursor: 'pointer', background: 'transparent',
          border: '1px solid rgba(255,255,255,.18)', color: (T.textPrimary),
          padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: 11, letterSpacing: 0.4,
          textTransform: 'uppercase', fontFamily: 'Inter, sans-serif',
        }}>Change</button>
      </Row>
      <Row label="Email">
        <div style={{
          padding: '8px 14px', borderRadius: 8,
          background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.10)',
          fontFamily: 'Inter, sans-serif', fontSize: 13, color: T.textSecondary, minWidth: 200,
        }}>{user?.email || '—'}</div>
      </Row>

      <GroupHeading>region & locale</GroupHeading>
      <Row label="Language">
        <Select value={s.locale} onChange={(v) => set('locale', v)} width={160}
          options={[
            { value: 'en', label: 'English' },
            { value: 'ru', label: 'Русский' },
            { value: 'uk', label: 'Українська' },
            { value: 'de', label: 'Deutsch' },
            { value: 'es', label: 'Español' },
            { value: 'fr', label: 'Français' },
            { value: 'zh', label: '中文' },
            { value: 'ja', label: '日本語' },
            { value: 'ko', label: '한국어' },
            { value: 'pt', label: 'Português' },
          ]}/>
      </Row>
      <Row label="Server region">
        <Select value={s.region} onChange={(v) => set('region', v)} width={160}
          options={[
            { value: 'eu-west', label: 'Europe · West' },
            { value: 'us-east', label: 'US · East' },
            { value: 'asia',    label: 'Asia' },
          ]}/>
      </Row>
      <Row label="Time format">
        <Segmented value={s.use24hClock ? '24h' : '12h'} onChange={(v) => set('use24hClock', v === '24h')}
          options={[{ value: '12h', label: '12h' }, { value: '24h', label: '24h' }]} />
      </Row>
      <Row label="Timezone">
        <div style={{
          padding: '8px 14px', borderRadius: 8,
          background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.10)',
          fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: T.textSecondary, minWidth: 200,
        }}>{s.timezone}</div>
      </Row>

      <GroupHeading sub="irreversible">danger zone</GroupHeading>
      <div style={{ display: 'flex', gap: 12, paddingTop: 16 }}>
        <button style={{
          appearance: 'none', cursor: 'pointer', background: 'transparent',
          border: '1px solid rgba(255,69,58,.4)', color: T.danger,
          padding: '10px 18px', borderRadius: 8, fontWeight: 700, fontSize: 11, letterSpacing: 0.5,
          textTransform: 'uppercase', fontFamily: 'Inter, sans-serif',
        }}>Log out</button>
        <button style={{
          appearance: 'none', cursor: 'pointer', background: 'transparent',
          border: '1px solid rgba(255,69,58,.4)', color: T.danger,
          padding: '10px 18px', borderRadius: 8, fontWeight: 700, fontSize: 11, letterSpacing: 0.5,
          textTransform: 'uppercase', fontFamily: 'Inter, sans-serif',
        }}>Delete account</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main settings desktop screen
// ─────────────────────────────────────────────────────────────────────────────

// Main settings screen — kept reactive so the language picker in the Account
// section actually changes section labels via useT(). ThemeProvider is provided
// by the parent app (desktop-app / standalone wrapper), not here, so theme
// switches persist when navigating away from Settings.
function SettingsDesktop(props) {
  return React.createElement(SettingsDesktopReactive, props);
}

function SettingsDesktopReactive(props) {
  const initialLocale = props?.data?.settings?.account?.locale || props?.data?.locale?.current || 'en';
  const [locale, setLocale] = React.useState(initialLocale);
  const enhancedProps = { ...props, __setLocale: setLocale };

  // Reactively scope i18n to this subtree. Theme is global (parent ThemeProvider).
  if (window.I18nProvider) {
    return React.createElement(window.I18nProvider, { locale }, React.createElement(SettingsDesktopInner, enhancedProps));
  }
  return React.createElement(SettingsDesktopInner, enhancedProps);
}

function SettingsDesktopInner({ width = 1280, height = 800, data, actions, defaultSection = 'graphics', __setLocale }) {
  const themeCtx = (window.useTheme && window.useTheme()) || null;
  const T = themeCtx?.tokens || window.THEME_TOKENS?.dark || null;
  const t = (window.useT && window.useT()) || ((k) => k);
  const S = data || defaultState();
  const A = actions || defaultActions();
  const settings = S.settings || defaultSettings();
  const [section, setSection] = React.useState(defaultSection);

  const set = (key, value) => {
    A.onSettingsChange?.(section, key, value);
    if (S.settings && S.settings[section]) {
      S.settings[section][key] = value;
      window.dispatchEvent(new CustomEvent('arena-settings-change', { detail: { section, key, value } }));
    }
    // Locale changes propagate to the I18nProvider so labels update live.
    if (section === 'account' && key === 'locale' && __setLocale) __setLocale(value);
  };

  return (
    <div style={{
      width, height, position: 'relative', overflow: 'hidden',
      background: T?.bg || (T.bg), color: T?.textPrimary || (T.textPrimary),
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <GlobalStyle />

      {/* Top bar */}
      <div style={{
        height: 64, padding: '0 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid ${T?.border || (T.border)}`,
        background: T?.bgElevated || 'transparent',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <button onClick={A.onReturnToMenu} style={{
            appearance: 'none', cursor: 'pointer', background: 'transparent',
            border: `1px solid ${T?.border || T.borderStrong}`,
            color: T?.textPrimary || (T.textPrimary),
            width: 38, height: 38, borderRadius: 10, fontSize: 16,
          }}>←</button>
          <Logo size={20} color={T?.textPrimary || (T.textPrimary)} accent={T?.accent || (T.accent)} />
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
            color: T?.textMuted || (T.textMuted), letterSpacing: 2, textTransform: 'uppercase',
          }}>· settings · theme: {themeCtx?.theme || 'dark'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => A.onSettingsReset?.(section)} style={{
            appearance: 'none', cursor: 'pointer', background: 'transparent',
            border: `1px solid ${T?.border || T.borderStrong}`,
            color: T?.textSecondary || T.textSecondary,
            padding: '8px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600,
            letterSpacing: 0.4, textTransform: 'uppercase', fontFamily: 'Inter, sans-serif',
          }}>Reset section</button>
          <PrimaryButton size="md" accent={T?.accent || (T.accent)} onClick={A.onSettingsApply}>Apply</PrimaryButton>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', height: height - 64 }}>
        {/* Sidebar */}
        <div style={{
          padding: '24px 16px',
          borderRight: `1px solid ${T?.border || (T.border)}`,
          background: T?.bgElevated || 'transparent',
          display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto',
        }}>
          <div style={{
            padding: '0 12px 12px', fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10, color: T?.textMuted || '#5A5870', letterSpacing: 2, textTransform: 'uppercase',
          }}>sections</div>
          {SETTINGS_SECTIONS.map((sec) => (
            <button key={sec.id} onClick={() => setSection(sec.id)}
              style={{
                appearance: 'none', cursor: 'pointer', textAlign: 'left',
                background: section === sec.id ? (T?.accentMuted || 'rgba(255,214,10,.10)') : 'transparent',
                border: 'none',
                color: section === sec.id ? (T?.accent || (T.accent)) : (T?.textSecondary || T.textSecondary),
                padding: '10px 12px', borderRadius: 8,
                fontFamily: 'Inter, sans-serif', fontSize: 13,
                fontWeight: section === sec.id ? 600 : 500,
                display: 'flex', alignItems: 'center', gap: 10,
                transition: 'all .12s ease-out',
                borderLeft: `2px solid ${section === sec.id ? (T?.accent || (T.accent)) : 'transparent'}`,
              }}>
              <span style={{
                width: 18, textAlign: 'center', opacity: section === sec.id ? 1 : 0.55,
              }}>{sec.icon}</span>
              {t(`settings.section.${sec.id}`) !== `settings.section.${sec.id}` ? t(`settings.section.${sec.id}`) : sec.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '32px 40px', overflow: 'auto', height: height - 64, background: T?.bg || (T.bg) }}>
          <div style={{ maxWidth: 720 }}>
            <h1 style={{
              margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.6, lineHeight: 1,
              fontFamily: 'Inter, sans-serif', color: T?.textPrimary || (T.textPrimary),
            }}>
              {t(`settings.section.${section}`) !== `settings.section.${section}` ? t(`settings.section.${section}`) : SETTINGS_SECTIONS.find((x) => x.id === section)?.label}
            </h1>
            <div style={{ marginTop: 8, color: T?.textMuted || (T.textMuted), fontSize: 13 }}>
              {{
                graphics: 'Performance and visual fidelity.',
                audio: 'Volume mixers and behaviour.',
                controls: 'Camera and key bindings.',
                gameplay: 'In-match overlays and helpers.',
                accessibility: 'Colorblind, motion, text size.',
                notifications: 'Toasts, banners, sounds.',
                privacy: 'Who sees your profile and activity.',
                account: 'Username, region, locale.',
              }[section]}
            </div>

            <div style={{ marginTop: 8 }}>
              {section === 'graphics'      ? <SectionGraphics      s={settings.graphics}      set={set} /> : null}
              {section === 'audio'         ? <SectionAudio         s={settings.audio}         set={set} /> : null}
              {section === 'controls'      ? <SectionControls      s={settings.controls}      set={set} /> : null}
              {section === 'gameplay'      ? <SectionGameplay      s={settings.gameplay}      set={set} /> : null}
              {section === 'accessibility' ? <SectionAccessibility s={settings.accessibility} set={set} /> : null}
              {section === 'notifications' ? <SectionNotifications s={settings.notifications} set={set} /> : null}
              {section === 'privacy'       ? <SectionPrivacy       s={settings.privacy}       set={set} /> : null}
              {section === 'account'       ? <SectionAccount       s={settings.account}       set={set} user={S.user} /> : null}
            </div>
          </div>
        </div>
      </div>

      <SystemOverlays data={S} actions={A} />
    </div>
  );
}

Object.assign(window, { SettingsDesktop, SETTINGS_SECTIONS });
