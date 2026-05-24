// src/i18n/translations.ts
//
// Словари переводов. Полный набор для en/ru, частичный для остальных.
// Расширяй ключи по мере локализации UI.

export type LocaleCode = 'en' | 'ru' | 'uk' | 'de' | 'es' | 'fr' | 'zh' | 'ja' | 'ko' | 'pt';

export const TRANSLATIONS: Readonly<Record<LocaleCode, Readonly<Record<string, string>>>> = {
  en: {
    'menu.title':                'Langton Arena',
    'menu.subtitle':             'PvP cellular automata',
    'menu.button.play':          'Play',
    'menu.button.sandbox':       'Sandbox',
    'menu.button.training':      'Training',
    'menu.button.settings':      'Settings',
    'menu.button.profile':       'Profile',

    'sandbox.title':             'Sandbox',
    'sandbox.section.field':     'Field',
    'sandbox.section.players':   'Players',
    'sandbox.section.birth':     'Birth',
    'sandbox.section.combat':    'Combat',
    'sandbox.section.visual':    'Visual',
    'sandbox.button.play':       'Play',
    'sandbox.button.pause':      'Pause',
    'sandbox.button.step':       'Step',
    'sandbox.button.reset':      'Reset',
    'sandbox.label.tick':        'tick',
    'sandbox.label.tps':         'TPS',
    'sandbox.label.ants':        'ants',

    'settings.title':            'Settings',
    'settings.section.theme':    'Theme',
    'settings.section.locale':   'Language',
    'settings.theme.dark':       'Dark',
    'settings.theme.light':      'Light',
    'settings.theme.highContrast': 'High contrast',

    'common.back':               'Back',
    'common.cancel':             'Cancel',
    'common.save':               'Save',
    'common.loading':            'Loading…',
    'common.comingSoon':         'Coming soon',
  },
  ru: {
    'menu.title':                'Лэнгтон Арена',
    'menu.subtitle':             'PvP клеточные автоматы',
    'menu.button.play':          'Играть',
    'menu.button.sandbox':       'Песочница',
    'menu.button.training':      'Тренировка',
    'menu.button.settings':      'Настройки',
    'menu.button.profile':       'Профиль',

    'sandbox.title':             'Песочница',
    'sandbox.section.field':     'Поле',
    'sandbox.section.players':   'Игроки',
    'sandbox.section.birth':     'Рождение',
    'sandbox.section.combat':    'Бой',
    'sandbox.section.visual':    'Визуал',
    'sandbox.button.play':       'Старт',
    'sandbox.button.pause':      'Пауза',
    'sandbox.button.step':       'Шаг',
    'sandbox.button.reset':      'Сброс',
    'sandbox.label.tick':        'тик',
    'sandbox.label.tps':         'TPS',
    'sandbox.label.ants':        'муравьёв',

    'settings.title':            'Настройки',
    'settings.section.theme':    'Тема',
    'settings.section.locale':   'Язык',
    'settings.theme.dark':       'Тёмная',
    'settings.theme.light':      'Светлая',
    'settings.theme.highContrast': 'Контрастная',

    'common.back':               'Назад',
    'common.cancel':             'Отмена',
    'common.save':               'Сохранить',
    'common.loading':            'Загрузка…',
    'common.comingSoon':         'Скоро',
  },
  uk: { 'menu.button.play': 'Грати', 'sandbox.title': 'Пісочниця', 'settings.title': 'Налаштування', 'common.back': 'Назад' },
  de: { 'menu.button.play': 'Spielen', 'sandbox.title': 'Sandbox',   'settings.title': 'Einstellungen', 'common.back': 'Zurück' },
  es: { 'menu.button.play': 'Jugar',   'sandbox.title': 'Sandbox',   'settings.title': 'Ajustes',       'common.back': 'Atrás' },
  fr: { 'menu.button.play': 'Jouer',   'sandbox.title': 'Bac à sable','settings.title': 'Paramètres',   'common.back': 'Retour' },
  pt: { 'menu.button.play': 'Jogar',   'sandbox.title': 'Sandbox',   'settings.title': 'Configurações', 'common.back': 'Voltar' },
  ja: { 'menu.button.play': 'プレイ',  'sandbox.title': 'サンドボックス', 'settings.title': '設定',     'common.back': '戻る' },
  zh: { 'menu.button.play': '开始',    'sandbox.title': '沙盒',      'settings.title': '设置',         'common.back': '返回' },
  ko: { 'menu.button.play': '플레이',  'sandbox.title': '샌드박스',  'settings.title': '설정',         'common.back': '뒤로' },
};
