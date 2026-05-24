// src/screens/SettingsScreen.tsx
//
// Минимальные настройки: тема (3 варианта) и язык (10 локалей).
// Изменения применяются немедленно через провайдеры.

import { useTheme } from '@theme/ThemeProvider';
import { useT, useLocale } from '@i18n/I18nProvider';
import { useAppState } from '@state/AppStateProvider';
import type { ThemeId } from '@theme/tokens';
import type { LocaleCode } from '@i18n/translations';
import { Button } from '@ui/Button';
import { Eyebrow } from '@ui/Eyebrow';

const LOCALE_NAMES: Record<LocaleCode, string> = {
  en: 'English', ru: 'Русский', uk: 'Українська',
  de: 'Deutsch', es: 'Español', fr: 'Français',
  pt: 'Português', ja: '日本語', zh: '中文', ko: '한국어',
};

export function SettingsScreen() {
  const { tokens: T, themeId, setTheme } = useTheme();
  const t = useT();
  const { locale, setLocale } = useLocale();
  const { setScreen } = useAppState();

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: T.bg, color: T.textPrimary,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        height: 56, padding: '0 24px',
        display: 'flex', alignItems: 'center', gap: 14,
        borderBottom: `1px solid ${T.border}`, background: T.bgElevated,
      }}>
        <Button variant="ghost" size="sm" onClick={() => setScreen('menu')}>
          ← {t('common.back', 'Back')}
        </Button>
        <Eyebrow>· {t('settings.title', 'Settings')}</Eyebrow>
      </div>

      <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 600 }}>
        <Section title={t('settings.section.theme', 'Theme')}>
          {(['dark', 'light', 'highContrast'] as ThemeId[]).map((id) => (
            <Row key={id} onClick={() => setTheme(id)} active={themeId === id}>
              {id === 'dark' && t('settings.theme.dark', 'Dark')}
              {id === 'light' && t('settings.theme.light', 'Light')}
              {id === 'highContrast' && t('settings.theme.highContrast', 'High contrast')}
            </Row>
          ))}
        </Section>

        <Section title={t('settings.section.locale', 'Language')}>
          {(Object.keys(LOCALE_NAMES) as LocaleCode[]).map((code) => (
            <Row key={code} onClick={() => setLocale(code)} active={locale === code}>
              {LOCALE_NAMES[code]}
            </Row>
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { tokens: T } = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Eyebrow>{title}</Eyebrow>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6,
        background: T.bgElevated, padding: 12, borderRadius: T.radiusMd,
        border: `1px solid ${T.border}`,
      }}>{children}</div>
    </div>
  );
}

function Row({ onClick, active, children }: { onClick: () => void; active: boolean; children: React.ReactNode }) {
  const { tokens: T } = useTheme();
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 14px', borderRadius: T.radiusSm,
        background: active ? T.accent : 'transparent',
        color: active ? T.bg : T.textPrimary,
        border: `1px solid ${active ? T.accent : T.border}`,
        fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
        cursor: 'pointer', textAlign: 'left',
      }}
    >{children}</button>
  );
}
