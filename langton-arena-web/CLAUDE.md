# CLAUDE.md — langton-arena-web

Дополнение к корневому `../CLAUDE.md`. Читается когда рабочая директория — `langton-arena-web/`.

---

## ⚠️ КРИТИЧЕСКИЕ ФАЙЛЫ — ПРОВЕРЯТЬ ПЕРВЫМИ

### vitest.config.ts
```ts
test: {
  environment: 'jsdom',
  globals: false,
  setupFiles: ['./src/test-setup.ts'],  // ← ОБЯЗАТЕЛЬНО, не удалять
},
```

### vite.config.ts
```ts
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/Langton_Ants_PVP/' : '/',  // ← ОБЯЗАТЕЛЬНО
  plugins: [react()],
```

### src/state/presets.ts
```ts
fetch(`${import.meta.env.BASE_URL}presets/index.json`)    // ← не /presets/
fetch(`${import.meta.env.BASE_URL}presets/${entry.file}`) // ← не /presets/
```

---

## 🧪 Команды

```bash
npm run test                    # vitest (65 тестов)
npx tsc --noEmit                # TypeScript check
npm run build                   # локальная сборка (base='/')
GITHUB_ACTIONS=true npm run build  # сборка для GH Pages

# E2E — ВСЕГДА на задеплоенном сайте:
AUDIT_BASE=https://alshfu.github.io/Langton_Ants_PVP node scripts/e2e-audit.mjs
AUDIT_HEADED=1 AUDIT_BASE=https://alshfu.github.io/Langton_Ants_PVP node scripts/e2e-audit.mjs
```

---

## 🚀 Деплой

```bash
GITHUB_ACTIONS=true npm run build
git checkout gh-pages
cp -r dist/. /Users/al_sh/WebstormProjects/Langton_Ants_PVP/
cd /Users/al_sh/WebstormProjects/Langton_Ants_PVP
git add index.html favicon.svg assets/ presets/ .nojekyll
git commit -m "deploy: ..."
git push origin gh-pages
git checkout main
cd langton-arena-web
```

---

## 📁 Ключевые файлы

| Файл | Назначение |
|------|-----------|
| `src/core/langton/engine.ts` | Симуляция: детерминированная, без Math.random() в цикле |
| `src/core/contract/state.ts` | Все TypeScript типы проекта |
| `src/components/LangtonField.tsx` | Canvas + imperative API через forwardRef |
| `src/screens/SandboxScreen.tsx` | Главный экран: координирует всё |
| `src/screens/sandbox/TabStrip.tsx` | 10 табов (Players/Ants/Stats/Events/Field/Combat/Birth/Mutations/Visual/Presets) |
| `src/lib/computeHighlights.ts` | 5 highlight алгоритмов |
| `src/lib/computeMatchResult.ts` | 5 win conditions |
| `src/lib/simSnapshot.ts` | Step back: snapshot/restore/SnapshotHistory |
| `src/state/presets.ts` | ⚠️ Загрузка пресетов (BASE_URL критичен) |
| `scripts/e2e-audit.mjs` | E2E аудит v3.0 (Playwright) |
| `vitest.config.ts` | ⚠️ setupFiles критичен |
| `vite.config.ts` | ⚠️ base path критичен |

---

## 📊 Текущее состояние

- **Stage 5**: мутации (halo/mirror/path) + win conditions + MatchBanner
- **65 тестов**: engine, engine-stage2, engine-stage5, spawnPatterns, storage, computeHighlights, computeMatchResult
- **13 пресетов**: public/presets/
- **E2E**: 99 PASS / 0 FAIL на https://alshfu.github.io/Langton_Ants_PVP/
