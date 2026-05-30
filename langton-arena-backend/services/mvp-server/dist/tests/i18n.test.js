// tests/i18n.test.ts
//
// Stage 8 Day 2 — i18n lookup/fallback логика.
import { describe, it, expect } from 'vitest';
import { t, normalizeLocale, MESSAGES, SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../src/i18n';
import { ERROR_CODES } from '../src/messages';
describe('i18n', () => {
    it('покрывает все 10 локалей', () => {
        expect(SUPPORTED_LOCALES.length).toBe(10);
        expect(SUPPORTED_LOCALES).toEqual(['en', 'ru', 'uk', 'de', 'es', 'fr', 'zh', 'ja', 'ko', 'pt']);
    });
    it('каждый ERROR_CODE имеет перевод во ВСЕХ локалях', () => {
        const missing = [];
        for (const locale of SUPPORTED_LOCALES) {
            for (const code of Object.values(ERROR_CODES)) {
                if (!MESSAGES[locale][code]) {
                    missing.push(`${locale}.${code}`);
                }
            }
        }
        expect(missing).toEqual([]);
    });
    it('t() возвращает перевод для известного locale + code', () => {
        expect(t('en', ERROR_CODES.ROOM_FULL)).toBe('Room is full');
        expect(t('ru', ERROR_CODES.ROOM_FULL)).toBe('Комната переполнена');
        expect(t('zh', ERROR_CODES.ROOM_FULL)).toBe('房间已满');
    });
    it('t() fallback на en для unsupported locale', () => {
        expect(t('klingon', ERROR_CODES.ROOM_FULL)).toBe('Room is full');
        expect(t('', ERROR_CODES.MALFORMED_MESSAGE)).toBe(MESSAGES.en.MALFORMED_MESSAGE);
    });
    it('normalizeLocale возвращает default для невалидной строки', () => {
        expect(normalizeLocale('en')).toBe('en');
        expect(normalizeLocale('ru')).toBe('ru');
        expect(normalizeLocale('klingon')).toBe(DEFAULT_LOCALE);
        expect(normalizeLocale('')).toBe(DEFAULT_LOCALE);
        expect(normalizeLocale('EN')).toBe(DEFAULT_LOCALE); // case-sensitive
    });
});
//# sourceMappingURL=i18n.test.js.map