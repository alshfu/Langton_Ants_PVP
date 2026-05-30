// src/i18n.ts
//
// Server-side localized error messages.
// 10 locales × все коды из messages.ts ERROR_CODES.
//
// Источник переводов: Web Claude (черновики), команда правит ru/uk вручную.
// Reference: stage8-pvp-mvp-spec.md §6.7, Q5 ответ A.
//
// Fallback chain: locale[code] → en[code] → code (raw string).

import type { ErrorCode } from './messages';

export type Locale = 'en' | 'ru' | 'uk' | 'de' | 'es' | 'fr' | 'zh' | 'ja' | 'ko' | 'pt';

export const SUPPORTED_LOCALES: ReadonlyArray<Locale> = [
  'en', 'ru', 'uk', 'de', 'es', 'fr', 'zh', 'ja', 'ko', 'pt',
];

export const DEFAULT_LOCALE: Locale = 'en';

type MessagesByLocale = Record<Locale, Partial<Record<ErrorCode, string>>>;

export const MESSAGES: MessagesByLocale = {
  en: {
    MALFORMED_MESSAGE:       'Malformed message — invalid JSON or missing type',
    UNKNOWN_MESSAGE_TYPE:    'Unknown message type',
    RATE_LIMIT_EXCEEDED:     'Too many actions — slow down',
    ROOM_FULL:               'Room is full',
    ROOM_TIMEOUT:            'Room closed — opponent did not join in time',
    ROOM_NOT_FOUND:          'Room not found',
    NOT_IN_ROOM:             'You must join a room first',
    MATCH_NOT_ACTIVE:        'Match is not active yet',
    INVALID_DEPLOY:          'Cannot deploy ant here',
    INPUT_TOO_OLD:           'Input arrived too late — ignored',
    FIELD_TOO_LARGE_FOR_PVP: 'PvP supports up to 200×200 fields, full-size sandbox available offline',
    ENGINE_VERSION_MISMATCH: 'Client engine version differs from server — please refresh',
    RESUME_TOKEN_EXPIRED:    'Reconnect window expired — match was forfeited',
    NOT_HOST:                'Only room host can change settings',
    INVALID_CONFIG:          'Invalid configuration value',
  },
  ru: {
    MALFORMED_MESSAGE:       'Некорректное сообщение — невалидный JSON или нет поля type',
    UNKNOWN_MESSAGE_TYPE:    'Неизвестный тип сообщения',
    RATE_LIMIT_EXCEEDED:     'Слишком много действий — притормози',
    ROOM_FULL:               'Комната переполнена',
    ROOM_TIMEOUT:            'Комната закрыта — соперник не подключился',
    ROOM_NOT_FOUND:          'Комната не найдена',
    NOT_IN_ROOM:             'Сначала войди в комнату',
    MATCH_NOT_ACTIVE:        'Матч ещё не начался',
    INVALID_DEPLOY:          'Сюда нельзя выпустить муравья',
    INPUT_TOO_OLD:           'Действие пришло слишком поздно — игнорируется',
    FIELD_TOO_LARGE_FOR_PVP: 'PvP поддерживает поля до 200×200, полный размер доступен в офлайн-песочнице',
    ENGINE_VERSION_MISMATCH: 'Версия клиента отличается от сервера — обнови страницу',
    RESUME_TOKEN_EXPIRED:    'Окно для переподключения истекло — матч засчитан как поражение',
    NOT_HOST:                'Only room host can change settings',
    INVALID_CONFIG:          'Invalid configuration value',
  },
  uk: {
    MALFORMED_MESSAGE:       'Некоректне повідомлення — невалідний JSON або немає поля type',
    UNKNOWN_MESSAGE_TYPE:    'Невідомий тип повідомлення',
    RATE_LIMIT_EXCEEDED:     'Забагато дій — пригальмуй',
    ROOM_FULL:               'Кімната переповнена',
    ROOM_TIMEOUT:            'Кімната закрита — суперник не підключився',
    ROOM_NOT_FOUND:          'Кімната не знайдена',
    NOT_IN_ROOM:             'Спочатку увійди до кімнати',
    MATCH_NOT_ACTIVE:        'Матч ще не почався',
    INVALID_DEPLOY:          'Сюди не можна випустити мурашку',
    INPUT_TOO_OLD:           'Дія прийшла надто пізно — ігнорується',
    FIELD_TOO_LARGE_FOR_PVP: 'PvP підтримує поля до 200×200, повний розмір доступний у офлайн-пісочниці',
    ENGINE_VERSION_MISMATCH: 'Версія клієнта відрізняється від сервера — онови сторінку',
    RESUME_TOKEN_EXPIRED:    'Вікно для перепідключення вичерпано — матч зараховано як поразку',
    NOT_HOST:                'Only room host can change settings',
    INVALID_CONFIG:          'Invalid configuration value',
  },
  de: {
    MALFORMED_MESSAGE:       'Fehlerhafte Nachricht — ungültiges JSON oder fehlendes type-Feld',
    UNKNOWN_MESSAGE_TYPE:    'Unbekannter Nachrichtentyp',
    RATE_LIMIT_EXCEEDED:     'Zu viele Aktionen — langsamer',
    ROOM_FULL:               'Raum ist voll',
    ROOM_TIMEOUT:            'Raum geschlossen — Gegner nicht rechtzeitig beigetreten',
    ROOM_NOT_FOUND:          'Raum nicht gefunden',
    NOT_IN_ROOM:             'Bitte zuerst einem Raum beitreten',
    MATCH_NOT_ACTIVE:        'Match noch nicht aktiv',
    INVALID_DEPLOY:          'Ameise kann hier nicht eingesetzt werden',
    INPUT_TOO_OLD:           'Eingabe kam zu spät — ignoriert',
    FIELD_TOO_LARGE_FOR_PVP: 'PvP unterstützt Felder bis 200×200, volle Größe nur im Offline-Sandbox',
    ENGINE_VERSION_MISMATCH: 'Client-Engine unterscheidet sich vom Server — bitte aktualisieren',
    RESUME_TOKEN_EXPIRED:    'Wiederverbindungs-Zeitfenster abgelaufen — Match verloren',
    NOT_HOST:                'Only room host can change settings',
    INVALID_CONFIG:          'Invalid configuration value',
  },
  es: {
    MALFORMED_MESSAGE:       'Mensaje mal formado — JSON inválido o falta campo type',
    UNKNOWN_MESSAGE_TYPE:    'Tipo de mensaje desconocido',
    RATE_LIMIT_EXCEEDED:     'Demasiadas acciones — más despacio',
    ROOM_FULL:               'Sala llena',
    ROOM_TIMEOUT:            'Sala cerrada — el oponente no se unió a tiempo',
    ROOM_NOT_FOUND:          'Sala no encontrada',
    NOT_IN_ROOM:             'Primero únete a una sala',
    MATCH_NOT_ACTIVE:        'La partida aún no está activa',
    INVALID_DEPLOY:          'No se puede desplegar hormiga aquí',
    INPUT_TOO_OLD:           'Acción demasiado tardía — ignorada',
    FIELD_TOO_LARGE_FOR_PVP: 'PvP soporta campos hasta 200×200, tamaño completo en sandbox offline',
    ENGINE_VERSION_MISMATCH: 'Versión del cliente difiere del servidor — actualiza la página',
    RESUME_TOKEN_EXPIRED:    'Ventana de reconexión expirada — partida perdida',
    NOT_HOST:                'Only room host can change settings',
    INVALID_CONFIG:          'Invalid configuration value',
  },
  fr: {
    MALFORMED_MESSAGE:       'Message malformé — JSON invalide ou champ type manquant',
    UNKNOWN_MESSAGE_TYPE:    'Type de message inconnu',
    RATE_LIMIT_EXCEEDED:     'Trop d’actions — ralentis',
    ROOM_FULL:               'Salle pleine',
    ROOM_TIMEOUT:            'Salle fermée — adversaire n’a pas rejoint à temps',
    ROOM_NOT_FOUND:          'Salle introuvable',
    NOT_IN_ROOM:             'Rejoins d’abord une salle',
    MATCH_NOT_ACTIVE:        'Le match n’est pas encore actif',
    INVALID_DEPLOY:          'Impossible de déployer une fourmi ici',
    INPUT_TOO_OLD:           'Action arrivée trop tard — ignorée',
    FIELD_TOO_LARGE_FOR_PVP: 'PvP supporte des champs jusqu’à 200×200, taille complète en sandbox hors-ligne',
    ENGINE_VERSION_MISMATCH: 'Version du client diffère du serveur — rafraîchis la page',
    RESUME_TOKEN_EXPIRED:    'Fenêtre de reconnexion expirée — match perdu',
    NOT_HOST:                'Only room host can change settings',
    INVALID_CONFIG:          'Invalid configuration value',
  },
  zh: {
    MALFORMED_MESSAGE:       '消息格式错误 — JSON 无效或缺少 type 字段',
    UNKNOWN_MESSAGE_TYPE:    '未知消息类型',
    RATE_LIMIT_EXCEEDED:     '操作过于频繁 — 请减慢',
    ROOM_FULL:               '房间已满',
    ROOM_TIMEOUT:            '房间已关闭 — 对手未及时加入',
    ROOM_NOT_FOUND:          '未找到房间',
    NOT_IN_ROOM:             '请先加入房间',
    MATCH_NOT_ACTIVE:        '比赛尚未开始',
    INVALID_DEPLOY:          '无法在此处部署蚂蚁',
    INPUT_TOO_OLD:           '操作过于延迟 — 已忽略',
    FIELD_TOO_LARGE_FOR_PVP: 'PvP 支持最大 200×200 的场地，完整尺寸仅离线沙盒可用',
    ENGINE_VERSION_MISMATCH: '客户端引擎与服务器版本不同 — 请刷新页面',
    RESUME_TOKEN_EXPIRED:    '重连窗口已过期 — 比赛已判负',
    NOT_HOST:                'Only room host can change settings',
    INVALID_CONFIG:          'Invalid configuration value',
  },
  ja: {
    MALFORMED_MESSAGE:       'メッセージ形式エラー — JSON が不正または type フィールドがありません',
    UNKNOWN_MESSAGE_TYPE:    '未知のメッセージタイプ',
    RATE_LIMIT_EXCEEDED:     '操作が多すぎます — ペースを落としてください',
    ROOM_FULL:               'ルームが満員です',
    ROOM_TIMEOUT:            'ルームを閉じました — 対戦相手が時間内に参加しませんでした',
    ROOM_NOT_FOUND:          'ルームが見つかりません',
    NOT_IN_ROOM:             'まずルームに参加してください',
    MATCH_NOT_ACTIVE:        '試合がまだ開始されていません',
    INVALID_DEPLOY:          'ここにアリを配置できません',
    INPUT_TOO_OLD:           '入力が遅すぎます — 無視されました',
    FIELD_TOO_LARGE_FOR_PVP: 'PvP は最大 200×200 のフィールドをサポート、フルサイズはオフラインサンドボックスのみ',
    ENGINE_VERSION_MISMATCH: 'クライアントとサーバーのバージョンが異なります — ページを更新してください',
    RESUME_TOKEN_EXPIRED:    '再接続ウィンドウが期限切れ — 試合が負け扱いに',
    NOT_HOST:                'Only room host can change settings',
    INVALID_CONFIG:          'Invalid configuration value',
  },
  ko: {
    MALFORMED_MESSAGE:       '메시지 형식 오류 — JSON이 잘못되었거나 type 필드가 없습니다',
    UNKNOWN_MESSAGE_TYPE:    '알 수 없는 메시지 유형',
    RATE_LIMIT_EXCEEDED:     '동작이 너무 많음 — 천천히',
    ROOM_FULL:               '방이 가득 찼습니다',
    ROOM_TIMEOUT:            '방이 닫혔습니다 — 상대방이 제시간에 참여하지 않음',
    ROOM_NOT_FOUND:          '방을 찾을 수 없음',
    NOT_IN_ROOM:             '먼저 방에 참여하세요',
    MATCH_NOT_ACTIVE:        '경기가 아직 활성화되지 않음',
    INVALID_DEPLOY:          '여기에 개미를 배치할 수 없음',
    INPUT_TOO_OLD:           '입력이 너무 늦음 — 무시됨',
    FIELD_TOO_LARGE_FOR_PVP: 'PvP는 최대 200×200 필드 지원, 전체 크기는 오프라인 샌드박스에서만',
    ENGINE_VERSION_MISMATCH: '클라이언트 엔진 버전이 서버와 다름 — 페이지를 새로고침하세요',
    RESUME_TOKEN_EXPIRED:    '재연결 시간이 만료됨 — 경기 패배 처리',
    NOT_HOST:                'Only room host can change settings',
    INVALID_CONFIG:          'Invalid configuration value',
  },
  pt: {
    MALFORMED_MESSAGE:       'Mensagem malformada — JSON inválido ou campo type ausente',
    UNKNOWN_MESSAGE_TYPE:    'Tipo de mensagem desconhecido',
    RATE_LIMIT_EXCEEDED:     'Demasiadas ações — vá mais devagar',
    ROOM_FULL:               'Sala cheia',
    ROOM_TIMEOUT:            'Sala fechada — adversário não entrou a tempo',
    ROOM_NOT_FOUND:          'Sala não encontrada',
    NOT_IN_ROOM:             'Entre numa sala primeiro',
    MATCH_NOT_ACTIVE:        'A partida ainda não está ativa',
    INVALID_DEPLOY:          'Não é possível posicionar a formiga aqui',
    INPUT_TOO_OLD:           'Ação chegou tarde demais — ignorada',
    FIELD_TOO_LARGE_FOR_PVP: 'PvP suporta campos até 200×200, tamanho total disponível no sandbox offline',
    ENGINE_VERSION_MISMATCH: 'Versão do cliente difere do servidor — atualiza a página',
    RESUME_TOKEN_EXPIRED:    'Janela de reconexão expirada — partida perdida',
    NOT_HOST:                'Only room host can change settings',
    INVALID_CONFIG:          'Invalid configuration value',
  },
};

/**
 * Lookup localized message по error code и locale.
 * Fallback: locale[code] → en[code] → raw code string.
 */
export function t(locale: string, code: ErrorCode): string {
  const safeLocale = (SUPPORTED_LOCALES as ReadonlyArray<string>).includes(locale)
    ? (locale as Locale)
    : DEFAULT_LOCALE;
  return MESSAGES[safeLocale][code]
      ?? MESSAGES[DEFAULT_LOCALE][code]
      ?? code;
}

/** Нормализация локали — для приёма из join_room (защита от мусора). */
export function normalizeLocale(input: string): Locale {
  return (SUPPORTED_LOCALES as ReadonlyArray<string>).includes(input)
    ? (input as Locale)
    : DEFAULT_LOCALE;
}
