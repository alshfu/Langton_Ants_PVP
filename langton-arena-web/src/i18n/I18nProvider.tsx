// src/i18n/I18nProvider.tsx
//
// Минимальный i18n: словарь en/ru, плюрализация для русского,
// плейсхолдеры через {name}.

import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { TRANSLATIONS, type LocaleCode } from './translations';

type TFn = (key: string, fallback?: string, params?: Record<string, unknown>) => string;

interface I18nContextValue {
  locale: LocaleCode;
  setLocale: (code: LocaleCode) => void;
  t: TFn;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function pluralRu(n: number): 'one' | 'few' | 'many' {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'one';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'few';
  return 'many';
}

function interpolate(tpl: string, params: Record<string, unknown> | undefined, locale: LocaleCode): string {
  if (!params) return tpl;
  // {plural:n|forms}
  tpl = tpl.replace(/\{plural:([^|}]+)\|([^}]+)\}/g, (_m, key, forms: string) => {
    const n = Number(params[key] ?? 0);
    const arr = forms.split('|');
    if (locale === 'ru' || locale === 'uk') {
      const form = pluralRu(n);
      return form === 'one' ? arr[0]! : form === 'few' ? (arr[1] ?? arr[0])! : (arr[2] ?? arr[1] ?? arr[0])!;
    }
    return n === 1 ? arr[0]! : (arr[1] ?? arr[0])!;
  });
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

export function I18nProvider({
  initial = 'en',
  children,
}: {
  initial?: LocaleCode;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<LocaleCode>(initial);
  const setLocale = useCallback((c: LocaleCode) => setLocaleState(c), []);

  const t = useCallback<TFn>((key, fallback, params) => {
    const dict = TRANSLATIONS[locale] ?? TRANSLATIONS.en;
    const fallbackDict = TRANSLATIONS.en;
    const tpl = dict[key] ?? fallbackDict[key] ?? fallback ?? key;
    return interpolate(tpl, params, locale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): TFn {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used inside <I18nProvider>');
  return ctx.t;
}

export function useLocale(): { locale: LocaleCode; setLocale: (c: LocaleCode) => void } {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useLocale must be used inside <I18nProvider>');
  return { locale: ctx.locale, setLocale: ctx.setLocale };
}
