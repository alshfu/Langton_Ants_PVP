// i18n.jsx — localization per contract §8.
// Flat key registry, namespaced. Supports {placeholder} interpolation
// and {plural:n|one|few|many} markers (CLDR en/ru/uk).
//
// To override or extend at runtime: window.ARENA_I18N = { en: {...}, ru: {...} };
// Locale fallback: any missing key falls back to en, then to the raw key.

const I18N_KEYS = [
  // Menu
  'menu.button.play', 'menu.button.training', 'menu.button.private',
  'menu.button.profile', 'menu.button.settings',
  'menu.cta.continueMatch', 'menu.cta.playMatch',
  'menu.footer.online', 'menu.footer.activeMatches',

  // Matchmaking
  'finding.title', 'finding.subtitle', 'finding.cancel',
  'finding.searching', 'finding.found', 'finding.estimated',

  // Lobby
  'lobby.title', 'lobby.countdown.label', 'lobby.squad.title',
  'lobby.squad.changeRule', 'lobby.player.ready', 'lobby.player.picking',
  'lobby.button.ready', 'lobby.button.unready', 'lobby.button.leave',

  // Match
  'match.timer.label', 'match.timer.remaining',
  'match.event.capture', 'match.event.death', 'match.event.wild',
  'match.event.cellsCount', 'match.event.clash', 'match.event.lead',
  'match.button.pause', 'match.button.forfeit', 'match.button.quit',
  'match.leaderboard.title', 'match.combo.label',

  // Result
  'result.title.victory', 'result.title.defeat', 'result.title.placed',
  'result.button.rematch', 'result.button.newMatch', 'result.button.menu',
  'result.button.openReward', 'result.label.duration', 'result.label.placement',
  'result.label.territory', 'result.label.cells', 'result.label.kills',

  // Tutorial
  'tutorial.button.next', 'tutorial.button.replay', 'tutorial.button.skip',
  'tutorial.label.step',

  // Reward
  'reward.title', 'reward.button.equip', 'reward.button.close', 'reward.label.rarity',

  // Profile
  'profile.tab.overview', 'profile.tab.history', 'profile.tab.heatmaps',
  'profile.tab.achievements', 'profile.label.rank', 'profile.label.matches',
  'profile.label.winRate', 'profile.label.streak', 'profile.label.playstyle',

  // Settings
  'settings.section.graphics', 'settings.section.audio', 'settings.section.controls',
  'settings.section.gameplay', 'settings.section.accessibility',
  'settings.section.notifications', 'settings.section.privacy', 'settings.section.account',
  'settings.button.apply', 'settings.button.reset',

  // Sandbox
  'sandbox.title', 'sandbox.label.tick', 'sandbox.label.tps', 'sandbox.label.ants',
  'sandbox.button.play', 'sandbox.button.pause', 'sandbox.button.step', 'sandbox.button.reset',
  'sandbox.section.world', 'sandbox.section.birth', 'sandbox.section.combat',

  // Errors
  'errors.network.timeout', 'errors.network.disconnected', 'errors.match.fullArena',

  // Common
  'common.back', 'common.next', 'common.cancel', 'common.confirm', 'common.save',
  'common.loading', 'common.empty', 'common.tryAgain',
];

const I18N_DEFAULT = {
  en: {
    'menu.button.play': 'Play', 'menu.button.training': 'Training',
    'menu.button.private': 'Private match', 'menu.button.profile': 'Profile',
    'menu.button.settings': 'Settings',
    'menu.cta.continueMatch': 'Continue match', 'menu.cta.playMatch': 'Play match',
    'menu.footer.online': '{n} online', 'menu.footer.activeMatches': '{n} active matches',

    'finding.title': 'Finding match', 'finding.subtitle': 'searching for players',
    'finding.cancel': 'Cancel', 'finding.searching': 'searching',
    'finding.found': '{n} of {total}', 'finding.estimated': 'est. {time}',

    'lobby.title': 'Lobby', 'lobby.countdown.label': 'starts in',
    'lobby.squad.title': 'Your squad', 'lobby.squad.changeRule': 'Change rule',
    'lobby.player.ready': 'Ready', 'lobby.player.picking': 'Picking',
    'lobby.button.ready': 'Ready', 'lobby.button.unready': 'Unready',
    'lobby.button.leave': 'Leave',

    'match.timer.label': 'remaining', 'match.timer.remaining': '{time} remaining',
    'match.event.capture': '{playerName} captured {n} cells',
    'match.event.death': '{playerName} lost an ant', 'match.event.wild': '⚠ WILD APPEARS',
    'match.event.cellsCount': '{plural:n|cell|cells} ({n})',
    'match.event.clash': '{playerName} clashed', 'match.event.lead': '{playerName} took the lead',
    'match.button.pause': 'Pause', 'match.button.forfeit': 'Forfeit',
    'match.button.quit': 'Quit', 'match.leaderboard.title': 'Standings',
    'match.combo.label': 'Combo',

    'result.title.victory': 'Victory', 'result.title.defeat': 'Defeat',
    'result.title.placed': '{place} of {total}',
    'result.button.rematch': 'Rematch', 'result.button.newMatch': 'New match',
    'result.button.menu': 'Menu', 'result.button.openReward': 'Open reward',
    'result.label.duration': 'Duration', 'result.label.placement': 'Placement',
    'result.label.territory': 'Territory', 'result.label.cells': 'Cells',
    'result.label.kills': 'Kills',

    'tutorial.button.next': 'Next', 'tutorial.button.replay': 'Replay',
    'tutorial.button.skip': 'Skip tutorial', 'tutorial.label.step': 'Step {n} of {total}',

    'reward.title': 'New reward', 'reward.button.equip': 'Equip',
    'reward.button.close': 'Close', 'reward.label.rarity': 'Rarity',

    'profile.tab.overview': 'Overview', 'profile.tab.history': 'History',
    'profile.tab.heatmaps': 'Heatmaps', 'profile.tab.achievements': 'Achievements',
    'profile.label.rank': 'Rank', 'profile.label.matches': 'Matches',
    'profile.label.winRate': 'Win rate', 'profile.label.streak': 'Streak',
    'profile.label.playstyle': 'Playstyle',

    'settings.section.graphics': 'Graphics', 'settings.section.audio': 'Audio',
    'settings.section.controls': 'Controls', 'settings.section.gameplay': 'Gameplay',
    'settings.section.accessibility': 'Accessibility', 'settings.section.notifications': 'Notifications',
    'settings.section.privacy': 'Privacy', 'settings.section.account': 'Account',
    'settings.button.apply': 'Apply', 'settings.button.reset': 'Reset section',

    'sandbox.title': 'Laboratory', 'sandbox.label.tick': 'tick', 'sandbox.label.tps': 'tps',
    'sandbox.label.ants': 'ants', 'sandbox.button.play': 'Play', 'sandbox.button.pause': 'Pause',
    'sandbox.button.step': 'Step', 'sandbox.button.reset': 'Reset',
    'sandbox.section.world': 'world', 'sandbox.section.birth': 'birth', 'sandbox.section.combat': 'combat',

    'errors.network.timeout': 'Connection timed out',
    'errors.network.disconnected': 'Lost connection',
    'errors.match.fullArena': 'No free arena right now',

    'common.back': 'Back', 'common.next': 'Next', 'common.cancel': 'Cancel',
    'common.confirm': 'Confirm', 'common.save': 'Save', 'common.loading': 'Loading…',
    'common.empty': 'Nothing here yet', 'common.tryAgain': 'Try again',
    'match.label.yourColony': 'your colony', 'match.label.yourAnts': 'your ants',
    'match.label.standings': 'standings', 'match.label.minimap': 'minimap',
    'match.label.events': 'events', 'match.label.swapRule': 'swap rule',
    'match.label.territoryTotal': 'territory · total',
    'profile.title': 'profile', 'leaderboard.title': 'leaderboard', 'meta.title': 'meta',
    'profile.tab.overview': 'overview', 'profile.tab.history': 'history',
    'profile.tab.heatmaps': 'heatmaps', 'profile.tab.achievements': 'achievements',
  },

  ru: {
    'menu.button.play': 'Играть', 'menu.button.training': 'Тренировка',
    'menu.button.private': 'Приватный матч', 'menu.button.profile': 'Профиль',
    'menu.button.settings': 'Настройки',
    'menu.cta.continueMatch': 'Продолжить матч', 'menu.cta.playMatch': 'Начать матч',
    'menu.footer.online': '{n} онлайн', 'menu.footer.activeMatches': '{n} активных матчей',

    'finding.title': 'Поиск матча', 'finding.subtitle': 'ищем игроков',
    'finding.cancel': 'Отмена', 'finding.searching': 'поиск',
    'finding.found': '{n} из {total}', 'finding.estimated': 'ожидание {time}',

    'lobby.title': 'Лобби', 'lobby.countdown.label': 'до начала',
    'lobby.squad.title': 'Твой отряд', 'lobby.squad.changeRule': 'Сменить правило',
    'lobby.player.ready': 'Готов', 'lobby.player.picking': 'Выбирает',
    'lobby.button.ready': 'Готов', 'lobby.button.unready': 'Не готов',
    'lobby.button.leave': 'Выйти',

    'match.timer.label': 'осталось', 'match.timer.remaining': 'осталось {time}',
    'match.event.capture': '{playerName} захватил {n} клеток',
    'match.event.death': '{playerName} потерял муравья', 'match.event.wild': '⚠ ДИКИЙ',
    'match.event.cellsCount': '{plural:n|клетка|клетки|клеток} ({n})',
    'match.event.clash': '{playerName} столкнулся', 'match.event.lead': '{playerName} вышел в лидеры',
    'match.button.pause': 'Пауза', 'match.button.forfeit': 'Сдаться',
    'match.button.quit': 'Выйти', 'match.leaderboard.title': 'Лидерборд',
    'match.combo.label': 'Комбо',

    'result.title.victory': 'Победа', 'result.title.defeat': 'Поражение',
    'result.title.placed': '{place} из {total}',
    'result.button.rematch': 'Реванш', 'result.button.newMatch': 'Новый матч',
    'result.button.menu': 'Меню', 'result.button.openReward': 'Открыть награду',
    'result.label.duration': 'Длительность', 'result.label.placement': 'Место',
    'result.label.territory': 'Территория', 'result.label.cells': 'Клетки',
    'result.label.kills': 'Убийства',

    'tutorial.button.next': 'Дальше', 'tutorial.button.replay': 'Повторить',
    'tutorial.button.skip': 'Пропустить', 'tutorial.label.step': 'Шаг {n} из {total}',

    'reward.title': 'Новая награда', 'reward.button.equip': 'Экипировать',
    'reward.button.close': 'Закрыть', 'reward.label.rarity': 'Редкость',

    'profile.tab.overview': 'Обзор', 'profile.tab.history': 'История',
    'profile.tab.heatmaps': 'Карты', 'profile.tab.achievements': 'Достижения',
    'profile.label.rank': 'Ранг', 'profile.label.matches': 'Матчей',
    'profile.label.winRate': 'Винрейт', 'profile.label.streak': 'Серия',
    'profile.label.playstyle': 'Стиль',

    'settings.section.graphics': 'Графика', 'settings.section.audio': 'Звук',
    'settings.section.controls': 'Управление', 'settings.section.gameplay': 'Игровой процесс',
    'settings.section.accessibility': 'Доступность', 'settings.section.notifications': 'Уведомления',
    'settings.section.privacy': 'Приватность', 'settings.section.account': 'Аккаунт',
    'settings.button.apply': 'Применить', 'settings.button.reset': 'Сбросить раздел',

    'sandbox.title': 'Лаборатория', 'sandbox.label.tick': 'тик', 'sandbox.label.tps': 'тпс',
    'sandbox.label.ants': 'муравьёв', 'sandbox.button.play': 'Старт', 'sandbox.button.pause': 'Пауза',
    'sandbox.button.step': 'Шаг', 'sandbox.button.reset': 'Сброс',
    'sandbox.section.world': 'мир', 'sandbox.section.birth': 'рождение', 'sandbox.section.combat': 'бой',

    'errors.network.timeout': 'Превышено время ожидания',
    'errors.network.disconnected': 'Связь потеряна',
    'errors.match.fullArena': 'Все арены сейчас заняты',

    'common.back': 'Назад', 'common.next': 'Далее', 'common.cancel': 'Отмена',
    'common.confirm': 'Подтвердить', 'common.save': 'Сохранить', 'common.loading': 'Загрузка…',
    'common.empty': 'Пока пусто', 'common.tryAgain': 'Повторить',
    'match.label.yourColony': 'твоя колония', 'match.label.yourAnts': 'твои муравьи',
    'match.label.standings': 'таблица', 'match.label.minimap': 'миникарта',
    'match.label.events': 'события', 'match.label.swapRule': 'сменить правило',
    'match.label.territoryTotal': 'территория · всего',
    'profile.title': 'профиль', 'leaderboard.title': 'таблица лидеров', 'meta.title': 'мета',
    'profile.tab.overview': 'обзор', 'profile.tab.history': 'история',
    'profile.tab.heatmaps': 'тепловые карты', 'profile.tab.achievements': 'достижения',
  },

  uk: {
    'menu.button.play': 'Грати', 'menu.button.training': 'Тренування',
    'menu.button.private': 'Приватний матч', 'menu.button.profile': 'Профіль',
    'menu.button.settings': 'Налаштування',
    'lobby.title': 'Лобі', 'lobby.button.ready': 'Готовий', 'lobby.button.leave': 'Вийти',
    'match.timer.label': 'залишилось', 'match.button.forfeit': 'Здатися',
    'result.title.victory': 'Перемога', 'result.title.defeat': 'Поразка',
    'result.button.rematch': 'Реванш', 'result.button.menu': 'Меню',
    'settings.section.graphics': 'Графіка', 'settings.section.audio': 'Звук',
    'settings.section.controls': 'Керування', 'settings.section.gameplay': 'Геймплей',
    'settings.section.accessibility': 'Доступність', 'settings.section.notifications': 'Сповіщення',
    'settings.section.privacy': 'Приватність', 'settings.section.account': 'Акаунт',
    'common.back': 'Назад', 'common.cancel': 'Скасувати', 'common.save': 'Зберегти',
    'profile.title': 'профіль', 'leaderboard.title': 'таблиця лідерів', 'meta.title': 'мета',
    'profile.tab.overview': 'огляд', 'profile.tab.history': 'історія',
    'profile.tab.heatmaps': 'теплові карти', 'profile.tab.achievements': 'досягнення',
    'match.label.yourColony': 'твоя колонія', 'match.label.yourAnts': 'твої мурахи',
    'match.label.standings': 'таблиця', 'match.label.minimap': 'мінікарта',
    'match.label.events': 'події', 'match.label.swapRule': 'змінити правило',
    'match.label.territoryTotal': 'територія · всього',
    'result.button.newMatch': 'Нова гра', 'result.label.xp': 'XP', 'result.label.sr': 'SR',
    'result.label.cells': 'клітинок', 'result.label.kills': 'убивств',
    'sandbox.title': 'Лабораторія', 'sandbox.button.play': 'Старт', 'sandbox.button.pause': 'Пауза',
    'sandbox.button.step': 'Крок', 'sandbox.button.reset': 'Скинути',
    'credits.title': 'автори', 'changelog.title': 'історія змін',
  },
  de: {
    'menu.button.play': 'Spielen', 'menu.button.training': 'Training',
    'menu.button.private': 'Privates Match', 'menu.button.profile': 'Profil',
    'menu.button.settings': 'Einstellungen',
    'lobby.title': 'Lobby', 'lobby.button.ready': 'Bereit', 'lobby.button.leave': 'Verlassen',
    'match.timer.label': 'verbleibend', 'match.button.forfeit': 'Aufgeben',
    'result.title.victory': 'Sieg', 'result.title.defeat': 'Niederlage',
    'result.button.rematch': 'Revanche', 'result.button.menu': 'Menü',
    'settings.section.graphics': 'Grafik', 'settings.section.audio': 'Audio',
    'settings.section.controls': 'Steuerung', 'settings.section.gameplay': 'Gameplay',
    'settings.section.accessibility': 'Barrierefreiheit', 'settings.section.notifications': 'Benachrichtigungen',
    'settings.section.privacy': 'Datenschutz', 'settings.section.account': 'Konto',
    'common.back': 'Zurück', 'common.cancel': 'Abbrechen', 'common.save': 'Speichern',
    'profile.title': 'Profil', 'leaderboard.title': 'Rangliste', 'meta.title': 'Meta',
    'profile.tab.overview': 'Übersicht', 'profile.tab.history': 'Verlauf',
    'profile.tab.heatmaps': 'Heatmaps', 'profile.tab.achievements': 'Erfolge',
    'match.label.yourColony': 'deine Kolonie', 'match.label.yourAnts': 'deine Ameisen',
    'match.label.standings': 'Wertung', 'match.label.minimap': 'Minikarte',
    'match.label.events': 'Ereignisse', 'match.label.swapRule': 'Regel wechseln',
    'match.label.territoryTotal': 'Gebiet · gesamt',
    'result.button.newMatch': 'Neue Partie', 'result.label.xp': 'XP', 'result.label.sr': 'SR',
    'result.label.cells': 'Zellen', 'result.label.kills': 'Eliminierungen',
    'sandbox.title': 'Labor', 'sandbox.button.play': 'Start', 'sandbox.button.pause': 'Pause',
    'sandbox.button.step': 'Schritt', 'sandbox.button.reset': 'Zurücksetzen',
    'credits.title': 'Mitwirkende', 'changelog.title': 'Änderungsprotokoll',
  },
  es: {
    'menu.button.play': 'Jugar', 'menu.button.training': 'Entrenamiento',
    'menu.button.private': 'Partida privada', 'menu.button.profile': 'Perfil',
    'menu.button.settings': 'Ajustes',
    'lobby.title': 'Sala', 'lobby.button.ready': 'Listo', 'lobby.button.leave': 'Salir',
    'match.timer.label': 'restante', 'match.button.forfeit': 'Rendirse',
    'result.title.victory': 'Victoria', 'result.title.defeat': 'Derrota',
    'result.button.rematch': 'Revancha', 'result.button.menu': 'Menú',
    'settings.section.graphics': 'Gráficos', 'settings.section.audio': 'Audio',
    'settings.section.controls': 'Controles', 'settings.section.gameplay': 'Juego',
    'settings.section.accessibility': 'Accesibilidad', 'settings.section.notifications': 'Notificaciones',
    'settings.section.privacy': 'Privacidad', 'settings.section.account': 'Cuenta',
    'common.back': 'Atrás', 'common.cancel': 'Cancelar', 'common.save': 'Guardar',
    'profile.title': 'perfil', 'leaderboard.title': 'clasificación', 'meta.title': 'meta',
    'profile.tab.overview': 'resumen', 'profile.tab.history': 'historial',
    'profile.tab.heatmaps': 'mapas de calor', 'profile.tab.achievements': 'logros',
    'match.label.yourColony': 'tu colonia', 'match.label.yourAnts': 'tus hormigas',
    'match.label.standings': 'clasificación', 'match.label.minimap': 'minimapa',
    'match.label.events': 'eventos', 'match.label.swapRule': 'cambiar regla',
    'match.label.territoryTotal': 'territorio · total',
    'result.button.newMatch': 'Nueva partida', 'result.label.xp': 'XP', 'result.label.sr': 'SR',
    'result.label.cells': 'celdas', 'result.label.kills': 'bajas',
    'sandbox.title': 'Laboratorio', 'sandbox.button.play': 'Reproducir', 'sandbox.button.pause': 'Pausar',
    'sandbox.button.step': 'Paso', 'sandbox.button.reset': 'Reiniciar',
    'credits.title': 'créditos', 'changelog.title': 'cambios',
  },
  fr: {
    'menu.button.play': 'Jouer', 'menu.button.training': 'Entraînement',
    'menu.button.private': 'Partie privée', 'menu.button.profile': 'Profil',
    'menu.button.settings': 'Paramètres',
    'lobby.title': 'Salon', 'lobby.button.ready': 'Prêt', 'lobby.button.leave': 'Quitter',
    'match.timer.label': 'restant', 'match.button.forfeit': 'Abandonner',
    'result.title.victory': 'Victoire', 'result.title.defeat': 'Défaite',
    'result.button.rematch': 'Revanche', 'result.button.menu': 'Menu',
    'settings.section.graphics': 'Graphismes', 'settings.section.audio': 'Audio',
    'settings.section.controls': 'Contrôles', 'settings.section.gameplay': 'Gameplay',
    'settings.section.accessibility': 'Accessibilité', 'settings.section.notifications': 'Notifications',
    'settings.section.privacy': 'Confidentialité', 'settings.section.account': 'Compte',
    'common.back': 'Retour', 'common.cancel': 'Annuler', 'common.save': 'Enregistrer',
    'profile.title': 'profil', 'leaderboard.title': 'classement', 'meta.title': 'méta',
    'profile.tab.overview': 'aperçu', 'profile.tab.history': 'historique',
    'profile.tab.heatmaps': 'cartes thermiques', 'profile.tab.achievements': 'succès',
    'match.label.yourColony': 'votre colonie', 'match.label.yourAnts': 'vos fourmis',
    'match.label.standings': 'classement', 'match.label.minimap': 'mini-carte',
    'match.label.events': 'événements', 'match.label.swapRule': 'changer la règle',
    'match.label.territoryTotal': 'territoire · total',
    'result.button.newMatch': 'Nouvelle partie', 'result.label.xp': 'XP', 'result.label.sr': 'SR',
    'result.label.cells': 'cases', 'result.label.kills': 'éliminations',
    'sandbox.title': 'Laboratoire', 'sandbox.button.play': 'Lancer', 'sandbox.button.pause': 'Pause',
    'sandbox.button.step': 'Étape', 'sandbox.button.reset': 'Réinitialiser',
    'credits.title': 'crédits', 'changelog.title': 'historique',
  },
  pt: {
    'menu.button.play': 'Jogar', 'menu.button.training': 'Treino',
    'menu.button.private': 'Partida privada', 'menu.button.profile': 'Perfil',
    'menu.button.settings': 'Configurações',
    'lobby.title': 'Sala', 'lobby.button.ready': 'Pronto', 'lobby.button.leave': 'Sair',
    'match.timer.label': 'restante', 'match.button.forfeit': 'Desistir',
    'result.title.victory': 'Vitória', 'result.title.defeat': 'Derrota',
    'result.button.rematch': 'Revanche', 'result.button.menu': 'Menu',
    'settings.section.graphics': 'Gráficos', 'settings.section.audio': 'Áudio',
    'settings.section.controls': 'Controles', 'settings.section.gameplay': 'Jogabilidade',
    'settings.section.accessibility': 'Acessibilidade', 'settings.section.notifications': 'Notificações',
    'settings.section.privacy': 'Privacidade', 'settings.section.account': 'Conta',
    'common.back': 'Voltar', 'common.cancel': 'Cancelar', 'common.save': 'Salvar',
    'profile.title': 'perfil', 'leaderboard.title': 'placar', 'meta.title': 'meta',
    'profile.tab.overview': 'visão geral', 'profile.tab.history': 'histórico',
    'profile.tab.heatmaps': 'mapas de calor', 'profile.tab.achievements': 'conquistas',
    'match.label.yourColony': 'sua colônia', 'match.label.yourAnts': 'suas formigas',
    'match.label.standings': 'classificação', 'match.label.minimap': 'minimapa',
    'match.label.events': 'eventos', 'match.label.swapRule': 'mudar regra',
    'match.label.territoryTotal': 'território · total',
    'result.button.newMatch': 'Nova partida', 'result.label.xp': 'XP', 'result.label.sr': 'SR',
    'result.label.cells': 'células', 'result.label.kills': 'eliminações',
    'sandbox.title': 'Laboratório', 'sandbox.button.play': 'Iniciar', 'sandbox.button.pause': 'Pausar',
    'sandbox.button.step': 'Passo', 'sandbox.button.reset': 'Reiniciar',
    'credits.title': 'créditos', 'changelog.title': 'mudanças',
  },
  ja: {
    'menu.button.play': 'プレイ', 'menu.button.training': 'チュートリアル',
    'menu.button.private': 'プライベート', 'menu.button.profile': 'プロフィール',
    'menu.button.settings': '設定',
    'lobby.title': 'ロビー', 'lobby.button.ready': '準備完了', 'lobby.button.leave': '退出',
    'match.timer.label': '残り', 'match.button.forfeit': '降参',
    'result.title.victory': '勝利', 'result.title.defeat': '敗北',
    'result.button.rematch': '再戦', 'result.button.menu': 'メニュー',
    'settings.section.graphics': 'グラフィック', 'settings.section.audio': 'オーディオ',
    'settings.section.controls': '操作', 'settings.section.gameplay': 'ゲームプレイ',
    'settings.section.accessibility': 'アクセシビリティ', 'settings.section.notifications': '通知',
    'settings.section.privacy': 'プライバシー', 'settings.section.account': 'アカウント',
    'common.back': '戻る', 'common.cancel': 'キャンセル', 'common.save': '保存',
    'profile.title': 'プロフィール', 'leaderboard.title': 'ランキング', 'meta.title': 'メタ',
    'profile.tab.overview': '概要', 'profile.tab.history': '履歴',
    'profile.tab.heatmaps': 'ヒートマップ', 'profile.tab.achievements': '実績',
    'match.label.yourColony': 'コロニー', 'match.label.yourAnts': 'アリ部隊',
    'match.label.standings': '順位', 'match.label.minimap': 'ミニマップ',
    'match.label.events': 'イベント', 'match.label.swapRule': 'ルール変更',
    'match.label.territoryTotal': '領地 · 合計',
    'result.button.newMatch': '新しい試合', 'result.label.xp': 'XP', 'result.label.sr': 'SR',
    'result.label.cells': 'マス', 'result.label.kills': '撃破',
    'sandbox.title': 'ラボ', 'sandbox.button.play': '再生', 'sandbox.button.pause': '一時停止',
    'sandbox.button.step': 'ステップ', 'sandbox.button.reset': 'リセット',
    'credits.title': 'クレジット', 'changelog.title': '更新履歴',
  },
  zh: {
    'menu.button.play': '开始', 'menu.button.training': '教程',
    'menu.button.private': '私人房', 'menu.button.profile': '档案',
    'menu.button.settings': '设置',
    'lobby.title': '大厅', 'lobby.button.ready': '准备', 'lobby.button.leave': '离开',
    'match.timer.label': '剩余', 'match.button.forfeit': '认输',
    'result.title.victory': '胜利', 'result.title.defeat': '失败',
    'result.button.rematch': '再战', 'result.button.menu': '菜单',
    'settings.section.graphics': '画面', 'settings.section.audio': '音频',
    'settings.section.controls': '控制', 'settings.section.gameplay': '游戏',
    'settings.section.accessibility': '辅助', 'settings.section.notifications': '通知',
    'settings.section.privacy': '隐私', 'settings.section.account': '账户',
    'common.back': '返回', 'common.cancel': '取消', 'common.save': '保存',
    'profile.title': '档案', 'leaderboard.title': '排行榜', 'meta.title': '元数据',
    'profile.tab.overview': '概览', 'profile.tab.history': '历史',
    'profile.tab.heatmaps': '热力图', 'profile.tab.achievements': '成就',
    'match.label.yourColony': '你的殖民地', 'match.label.yourAnts': '你的蚂蚁',
    'match.label.standings': '排名', 'match.label.minimap': '小地图',
    'match.label.events': '事件', 'match.label.swapRule': '更换规则',
    'match.label.territoryTotal': '领地 · 总',
    'result.button.newMatch': '新对局', 'result.label.xp': '经验', 'result.label.sr': 'SR',
    'result.label.cells': '格子', 'result.label.kills': '击杀',
    'sandbox.title': '实验室', 'sandbox.button.play': '播放', 'sandbox.button.pause': '暂停',
    'sandbox.button.step': '单步', 'sandbox.button.reset': '重置',
    'credits.title': '制作', 'changelog.title': '更新日志',
  },
  ko: {
    'menu.button.play': '플레이', 'menu.button.training': '튜토리얼',
    'menu.button.private': '비공개 매치', 'menu.button.profile': '프로필',
    'menu.button.settings': '설정',
    'lobby.title': '로비', 'lobby.button.ready': '준비', 'lobby.button.leave': '나가기',
    'match.timer.label': '남은 시간', 'match.button.forfeit': '항복',
    'result.title.victory': '승리', 'result.title.defeat': '패배',
    'result.button.rematch': '재경기', 'result.button.menu': '메뉴',
    'settings.section.graphics': '그래픽', 'settings.section.audio': '오디오',
    'settings.section.controls': '조작', 'settings.section.gameplay': '게임플레이',
    'settings.section.accessibility': '접근성', 'settings.section.notifications': '알림',
    'settings.section.privacy': '개인정보', 'settings.section.account': '계정',
    'common.back': '뒤로', 'common.cancel': '취소', 'common.save': '저장',
    'profile.title': '프로필', 'leaderboard.title': '리더보드', 'meta.title': '메타',
    'profile.tab.overview': '개요', 'profile.tab.history': '기록',
    'profile.tab.heatmaps': '히트맵', 'profile.tab.achievements': '업적',
    'match.label.yourColony': '내 군집', 'match.label.yourAnts': '내 개미들',
    'match.label.standings': '순위', 'match.label.minimap': '미니맵',
    'match.label.events': '이벤트', 'match.label.swapRule': '규칙 변경',
    'match.label.territoryTotal': '영역 · 전체',
    'result.button.newMatch': '새 경기', 'result.label.xp': '경험치', 'result.label.sr': 'SR',
    'result.label.cells': '셀', 'result.label.kills': '처치',
    'sandbox.title': '실험실', 'sandbox.button.play': '재생', 'sandbox.button.pause': '일시정지',
    'sandbox.button.step': '단계', 'sandbox.button.reset': '재설정',
    'credits.title': '크레딧', 'changelog.title': '업데이트 내역',
  },
};

// Russian plural form per CLDR: one (1, 21, 31), few (2-4, 22-24), many (rest).
function pluralRu(n) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'one';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'few';
  return 'many';
}
function pluralEn(n) { return n === 1 ? 'one' : 'many'; }

function getPluralForm(locale, n) {
  switch (locale) {
    case 'ru':
    case 'uk':  return pluralRu(n);
    default:    return pluralEn(n);
  }
}

function interpolate(template, params, locale) {
  if (!template) return '';
  template = template.replace(/\{plural:([^|}]+)\|([^}]+)\}/g, (_, key, forms) => {
    const n = Number(params?.[key] ?? 0);
    const formArr = forms.split('|');
    const form = getPluralForm(locale, n);
    if (locale === 'ru' || locale === 'uk') {
      return form === 'one' ? formArr[0] : form === 'few' ? formArr[1] : formArr[2] ?? formArr[1] ?? formArr[0];
    }
    return form === 'one' ? formArr[0] : formArr[1] ?? formArr[0];
  });
  template = template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = params?.[key];
    return v == null ? '{' + key + '}' : String(v);
  });
  return template;
}

function makeT(locale = 'en') {
  const override = window.ARENA_I18N || {};
  const dict = { ...(I18N_DEFAULT[locale] || {}), ...(override[locale] || {}) };
  const fallback = { ...(I18N_DEFAULT.en || {}), ...(override.en || {}) };
  return function t(key, params) {
    const template = dict[key] ?? fallback[key] ?? key;
    return interpolate(template, params, locale);
  };
}

const I18nContext = React.createContext({ locale: 'en', t: makeT('en') });

function I18nProvider({ locale = 'en', children }) {
  const value = React.useMemo(() => ({ locale, t: makeT(locale) }), [locale]);
  // Mirror onto window for non-hook callers.
  React.useEffect(() => {
    window.__ARENA_LOCALE = locale;
    window.__ARENA_T_FN = value.t;
    window.dispatchEvent(new CustomEvent('arena-locale-change', { detail: { locale } }));
  }, [locale, value.t]);
  return React.createElement(I18nContext.Provider, { value }, children);
}

function useT() { return React.useContext(I18nContext).t; }
function useLocale() { return React.useContext(I18nContext).locale; }

// Global accessor — safe fallback when used outside I18nProvider.
function getActiveT() {
  return window.__ARENA_T_FN || makeT(window.__ARENA_LOCALE || 'en');
}

// Pre-populate global so module-level reads work before provider mounts.
if (typeof window !== 'undefined' && !window.__ARENA_T_FN) {
  window.__ARENA_T_FN = makeT('en');
  window.__ARENA_LOCALE = 'en';
}

Object.assign(window, {
  I18N_DEFAULT, I18N_KEYS, makeT, I18nProvider, I18nContext, useT, useLocale, getActiveT,
});
