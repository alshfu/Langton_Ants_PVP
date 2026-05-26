# CLAUDE.md — Langton Arena PvP

Инструкции для Claude Code. Читаются автоматически при каждой сессии.

---

## 🎯 Роль и обязанности

Ты — основной разработчик и DevOps этого проекта. Твоя работа:

1. **Изучать изменения** — `git diff`, `git status`, читать новые файлы
2. **Запускать тесты** — `npm run test` (vitest), TypeScript check, E2E аудит
3. **Исправлять баги** — найденные тестами, TypeScript, или E2E
4. **Коммитить и пушить** — main ветка GitHub
5. **Деплоить** — обновлять ветку `gh-pages` (ручной деплой, см. ниже)
6. **Вести wiki** — обновлять `/tmp/langton-wiki/` и пушить в `master:master`
7. **Обновлять Devlog** — новая запись вверху `/tmp/langton-wiki/Devlog.md`
8. **E2E тест на продакшне** — Playwright на `https://alshfu.github.io/Langton_Ants_PVP/`

**Никогда не спрашивать подтверждения** — делать всё в правильном порядке сразу.

---

## 🔄 Стандартный workflow (выполнять строго в этом порядке)

```
1. git status / git diff  →  изучить изменения
2. npm run test           →  все тесты должны проходить
3. npx tsc --noEmit       →  TypeScript должен быть чистым
4. git add -A && git commit && git push origin main
5. DEPLOY: собрать dist и обновить gh-pages (см. раздел Деплой)
6. E2E аудит на ПРОДАКШН URL: AUDIT_BASE=https://alshfu.github.io/Langton_Ants_PVP node scripts/e2e-audit.mjs
7. Обновить wiki (новые API-страницы, обновить Home/Frontend/Game-Engine/Devlog)
8. git push в wiki: cd /tmp/langton-wiki && git push origin master:master
```

---

## 🚀 Деплой на GitHub Pages (ручной, без Actions)

GitHub Actions заблокированы billing-локом. Деплой делается локально:

```bash
cd /Users/al_sh/WebstormProjects/Langton_Ants_PVP/langton-arena-web

# 1. Сборка (GITHUB_ACTIONS=true обязательно — активирует base path)
GITHUB_ACTIONS=true npm run build

# 2. Переключиться на gh-pages и скопировать сборку
git checkout gh-pages
cp -r dist/. /Users/al_sh/WebstormProjects/Langton_Ants_PVP/

# 3. Закоммитить и запушить
cd /Users/al_sh/WebstormProjects/Langton_Ants_PVP
git add index.html favicon.svg assets/ presets/ .nojekyll
git commit -m "deploy: <краткое описание>"
git push origin gh-pages

# 4. Вернуться на main
git checkout main
cd langton-arena-web
```

**Живой URL:** https://alshfu.github.io/Langton_Ants_PVP/

---

## 🧪 E2E аудит

**ВСЕГДА запускать на задеплоенном сайте, не на localhost:**

```bash
cd /Users/al_sh/WebstormProjects/Langton_Ants_PVP/langton-arena-web
AUDIT_BASE=https://alshfu.github.io/Langton_Ants_PVP node scripts/e2e-audit.mjs
```

Флаги:
- `AUDIT_HEADED=1` — показать браузер (отладка)
- `AUDIT_STRICT=1` — WARN считать ошибкой
- `AUDIT_ONLY=transport,canvas` — только указанные секции

Артефакты: `/tmp/audit-report.json`, `/tmp/audit-report.md`, `/tmp/audit-*.png`

---

## 🔒 КРИТИЧЕСКИЕ ФАЙЛЫ — НЕЛЬЗЯ ТРОГАТЬ ЭТИ СТРОКИ

Три файла часто сбрасываются при изменениях. После каждого обновления проверять и восстанавливать если нужно:

### 1. `langton-arena-web/vitest.config.ts`
Секция `test` ОБЯЗАТЕЛЬНО должна содержать `setupFiles`:
```ts
test: {
  environment: 'jsdom',
  globals: false,
  setupFiles: ['./src/test-setup.ts'],  // ← НЕЛЬЗЯ УДАЛЯТЬ
},
```
Без этого `localStorage.clear is not a function` — 6+ тестов падают.

### 2. `langton-arena-web/vite.config.ts`
ОБЯЗАТЕЛЬНО должен быть `base` перед `plugins`:
```ts
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/Langton_Ants_PVP/' : '/',  // ← НЕЛЬЗЯ УДАЛЯТЬ
  plugins: [react()],
  ...
```
Без этого пресеты и ассеты не грузятся на GitHub Pages.

### 3. `langton-arena-web/src/state/presets.ts`
Пути fetch ОБЯЗАТЕЛЬНО через `import.meta.env.BASE_URL`:
```ts
fetch(`${import.meta.env.BASE_URL}presets/index.json`)   // ← не /presets/index.json
fetch(`${import.meta.env.BASE_URL}presets/${entry.file}`) // ← не /presets/${entry.file}
```
Без этого пресеты не грузятся на GitHub Pages (абсолютный путь игнорирует base).

**При каждом обновлении файлов — первым делом проверять эти три файла.**

---

## 📚 Wiki

Wiki репозиторий: `https://github.com/alshfu/Langton_Ants_PVP.wiki.git`
Локальный клон: `/tmp/langton-wiki/` (может быть удалён между сессиями — тогда клонировать заново)

```bash
# Если /tmp/langton-wiki не существует:
git clone https://github.com/alshfu/Langton_Ants_PVP.wiki.git /tmp/langton-wiki

# Пуш всегда так:
cd /tmp/langton-wiki && git push origin master:master
```

### Страницы которые обновляются при каждом Stage:
- `Devlog.md` — новая запись **вверху** (после заголовка и `---`)
- `Home.md` — новые API-страницы в таблице
- `Frontend.md` — список табов, количество тестов, новые lib/components
- `Game-Engine.md` — новые механики движка

### Существующие API-страницы:
`API-engine`, `API-state`, `API-antShapes`, `API-skins`, `API-spriteLoader`,
`API-spawnPatterns`, `API-storage`, `API-computeStats`, `API-simSnapshot`,
`API-LiveStatsContext`, `API-StatsTab`, `API-TerritoryChart`, `API-Sparkline`,
`API-EventsTab`, `API-HeatmapLegend`, `API-computeHighlights`, `API-heatmapColors`,
`API-computeMatchResult`, `API-MutationsTab`

---

## 📋 Структура репозитория

```
/Users/al_sh/WebstormProjects/Langton_Ants_PVP/   ← корень git-репо
├── CLAUDE.md                                       ← этот файл
├── .github/workflows/deploy.yml                   ← GH Actions (заблокирован billing)
├── langton-arena-web/                              ← АКТУАЛЬНЫЙ ФРОНТЕНД (Vite + React)
│   ├── src/
│   │   ├── core/langton/engine.ts                 ← симуляция, детерминированная
│   │   ├── core/contract/state.ts                 ← все TypeScript типы
│   │   ├── components/                            ← LangtonField, HeatmapLegend, MatchBanner
│   │   ├── screens/sandbox/                       ← 10 вкладок Sandbox
│   │   ├── lib/                                   ← утилиты (computeHighlights, computeMatchResult, ...)
│   │   └── state/                                 ← AppState, LiveStatsContext
│   ├── public/presets/                            ← 13 встроенных пресетов
│   ├── scripts/                                   ← e2e-audit.mjs, smoke-tests
│   ├── vitest.config.ts                           ← ⚠️ критический файл
│   └── vite.config.ts                             ← ⚠️ критический файл
├── langton-arena-backend/                          ← бэкенд (5 микросервисов, не деплоится)
└── ux-prototype/                                   ← ванильный прототип v1 (референс)
```

---

## 🐛 Известные recurring баги

| Файл | Симптом | Фикс |
|------|---------|------|
| `vitest.config.ts` | `localStorage.clear is not a function` | Добавить `setupFiles: ['./src/test-setup.ts']` |
| `vite.config.ts` | Пресеты 404 на GH Pages | Добавить `base: process.env.GITHUB_ACTIONS ? '/Langton_Ants_PVP/' : '/'` |
| `presets.ts` | Пресеты 404 на GH Pages | Заменить `/presets/` на `${import.meta.env.BASE_URL}presets/` |
| `TabStrip.tsx` | React style warning в консоли | `border:'none'` → явные `borderTop/Right/Bottom/Left:'none'` |
| `EventCard.tsx` | React style warning в консоли | То же самое |
| `PresetsTab.tsx` | React style warning в консоли | `style.borderColor` → `style.border` в mouse handlers |

---

## ✅ Текущий статус проекта

| Параметр | Значение |
|----------|---------|
| Стадия | Stage 5 (мутации, win conditions) |
| Тесты | 65/65 |
| E2E на продакшне | 99 PASS / 0 FAIL |
| Деплой | https://alshfu.github.io/Langton_Ants_PVP/ |
| Пресеты | 13 штук |
| Вкладок Sandbox | 10 |
