// src/App.tsx
//
// Корневой компонент. Оборачивает всё в provider'ы в правильном порядке:
//   AppStateProvider → ThemeProvider → I18nProvider → Router

import { ThemeProvider } from '@theme/ThemeProvider';
import { I18nProvider } from '@i18n/I18nProvider';
import { AppStateProvider } from '@state/AppStateProvider';
import { Router } from '@router/Router';

export function App() {
  // Дефолты можно потом тянуть из localStorage или из URL params
  const initialTheme = (import.meta.env.VITE_DEFAULT_THEME as 'dark' | 'light' | 'highContrast') ?? 'dark';
  const initialLocale = (import.meta.env.VITE_DEFAULT_LOCALE as 'en' | 'ru') ?? 'en';

  return (
    <AppStateProvider>
      <ThemeProvider initial={initialTheme}>
        <I18nProvider initial={initialLocale}>
          <Router />
        </I18nProvider>
      </ThemeProvider>
    </AppStateProvider>
  );
}
