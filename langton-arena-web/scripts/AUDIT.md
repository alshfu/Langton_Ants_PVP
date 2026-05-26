# E2E Audit Script

`scripts/e2e-audit.mjs` — автоматизированный аудит UI Langton Arena Sandbox.
Запускает реальный Chromium через Playwright и кликает по каждой кнопке,
каждому слайдеру, каждому тоглу, каждому табу. Логирует всё что нашёл.

## Когда запускать

- **Перед каждым релизом** — обязательно. Если падает — релиз откладывается
- **После изменений в UI** — даже если думаешь "ничего не сломал"
- **После апгрейда зависимостей** — Playwright/React могли поменять поведение

## Установка (один раз)

```bash
npm install
npx playwright install chromium  # ~150MB, скачается один раз
```

## Запуск

```bash
# В одном терминале
npm run dev

# В другом терминале
npm run audit            # headless, для CI и локально
npm run audit:headed     # с открытым окном для отладки
npm run audit:strict     # exit code != 0 даже на WARN
```

## CLI-флаги через env vars

| Переменная | Значения | Эффект |
|---|---|---|
| `AUDIT_HEADED` | `1` / `true` | Показать окно браузера |
| `AUDIT_STRICT` | `1` | WARN превращает exit code в 1 |
| `AUDIT_BASE` | URL | Тестировать другой адрес (default `http://localhost:5173`) |
| `AUDIT_ONLY` | comma-list | Только указанные секции (см. ниже) |

### Примеры

```bash
# Только Transport и Canvas
AUDIT_ONLY=transport,canvas npm run audit

# Только новые фичи Этапа 4
AUDIT_ONLY=events,heatmaps,highlights npm run audit:headed

# Тестировать production preview
AUDIT_BASE=http://localhost:4173 npm run audit
```

## Доступные секции

| Секция | Что проверяет |
|---|---|
| `boot` | Главная страница загружается, нет console errors |
| `nav` | Переход в Sandbox |
| `tabs` | Все 9 табов открываются без ошибок |
| `presets` | Загрузка встроенных пресетов |
| `players` | Конфигурация игроков, селекты |
| `ants` | Tab открывается |
| `field` | Слайдеры размера, топологии, тоглы |
| `combat` | HP toggle, damage cap, cooldown slider |
| `birth` | Birth toggles + sliders |
| `visual` | Skins, day/night, эффекты |
| `stats` | Live статистика после 3 сек симуляции |
| `events` | Stage 4: фильтр-чипы (6 типов), event cards |
| `heatmaps` | Stage 4: dropdown deaths/captures/contested + opacity |
| `highlights` | Stage 4: 5 типов highlights рендерятся |
| `transport` | Run / Pause / Step ±1/±5/±N / Speed × / TPS / Reset |
| `canvas` | LMB / Shift+LMB / RMB / wheel в edit mode |
| `stress` | 5 сек симуляции на ×8, измерение FPS |
| `memory` | Heap size после теста (через performance.memory) |

## Артефакты

После запуска создаются:

- `/tmp/audit-report.json` — машинно-читаемый отчёт для CI
- `/tmp/audit-report.md` — человеко-читаемый отчёт (можно копировать в DEVLOG)
- `/tmp/audit-*.png` — скриншоты каждой секции (~20 файлов)

## Exit codes

| Code | Что значит |
|---|---|
| `0` | Все PASS (или `WARN` без `STRICT`) |
| `1` | Есть `FAIL` (или `WARN` с `AUDIT_STRICT=1`) |
| `2` | Неперехваченное исключение / setup failure |

## CI-интеграция (пример GitHub Actions)

```yaml
- name: Install Playwright
  run: npx playwright install chromium

- name: Start dev server
  run: npm run dev &

- name: Wait for server
  run: npx wait-on http://localhost:5173

- name: Run audit
  run: npm run audit

- name: Upload audit artifacts
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: audit-${{ github.sha }}
    path: /tmp/audit-*
```

## Что делать с FAIL'ами

1. Смотреть `/tmp/audit-report.md` — там список всех проблем
2. Открыть соответствующий `/tmp/audit-{section}.png` чтобы увидеть состояние UI
3. Перезапустить с `--audit:headed` чтобы видеть что происходит в реальном времени
4. Если что-то изменилось в UI (новая кнопка, переименование) — обновить селекторы в `scripts/e2e-audit.mjs`

## Версионирование

Файл начинается с константы `AUDIT_VERSION`. **При каждом изменении скрипта**:

1. Bump версию (3.0 → 3.1 для мелких, 3.0 → 4.0 для больших)
2. Записать в шапку файла что изменилось
3. Зафиксировать в DEVLOG какой версией прогонялся последний этап

Текущая версия: **3.0** (после Stage 4 — добавлены Events / Heatmaps / Highlights).
