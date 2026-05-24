// src/screens/MatchScreen.tsx
//
// Заглушка экрана. Реальная реализация — TODO.
// Используется для навигации; рисует "coming soon" + кнопку назад.

import { useTheme } from '@theme/ThemeProvider';
import { useT } from '@i18n/I18nProvider';
import { useAppState } from '@state/AppStateProvider';
import { Button } from '@ui/Button';
import { Eyebrow } from '@ui/Eyebrow';

export function MatchScreen() {
  const { tokens: T } = useTheme();
  const t = useT();
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
        <Eyebrow>· match</Eyebrow>
      </div>
      <div style={{
        flex: 1, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 12,
      }}>
        <h2 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: T.textPrimary }}>
          Match
        </h2>
        <div style={{ color: T.textMuted, fontSize: 13 }}>
          {t('common.comingSoon', 'Coming soon')}
        </div>
        <Button size="md" onClick={() => setScreen('menu')} style={{ marginTop: 16 }}>
          {t('common.back', 'Back to menu')}
        </Button>
      </div>
    </div>
  );
}
