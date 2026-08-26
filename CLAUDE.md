# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Команды

```bash
npm run dev        # Vite dev-сервер, http://localhost:5173 (HMR; service worker НЕ активен)
npm run preview    # прод-сборка на http://localhost:4173 — здесь проверять SW, офлайн и PWA
npm test           # node --test "tests/*.test.ts" (Node type stripping — импорты с явным .ts)
node --test tests/merge.test.ts                       # один файл
node --test --test-name-pattern="tie" tests/*.test.ts # один тест по имени
npm run typecheck
npm run build      # dist/ (клиент + sw.js + manifest); VITE_BASE задаёт base для GitHub Pages
npm run icons      # перегенерировать PNG из SVG-шаблона в scripts/icons.mjs; PNG коммитятся
```

`.env` (в репозитории, **не** секрет) хранит `VITE_GOOGLE_CLIENT_ID` — он нужен и в CI на этапе сборки.

## Архитектура

**Чисто фронтовое приложение, бэкенда нет.** Статика на GitHub Pages, авторизация — Google Identity Services прямо в браузере, синхронизация — прямые запросы к Google Drive REST API. Источник истины — IndexedDB; Drive лишь реплика. Приложение полноценно работает без сети и без входа.

> Раньше проект жил на Cloudflare Worker (OAuth code flow, refresh token в шифрованной cookie). Воркер удалён; при вопросах про `wrangler`/`hono` — их больше нет.

### Поток данных (запись)

компоненты → `src/store.ts` (снапшот + подписчики, чтение через `useSyncExternalStore`) → `src/db.ts` (idb: store `entries` keyPath id, store `meta`) → `meta.dirty=1` → hook из `main.tsx` → `scheduleSync()` (debounce 4 с) → `src/sync.ts`.

Все триггеры синхронизации собраны в `main.tsx`: правка, `online`, `visibilitychange`, интервал 5 мин.

### Синхронизация (`sync.ts` + `merge.ts`)

Один проход: pull `entries.json` → `mergeEntries()` (чистая функция, покрыта тестами) → `applyRemoteWins()` → purge tombstones → push если нужно.

- **LWW по каждой записи**: побеждает больший `updatedAt`; при равенстве — удалённая версия.
- **Удаление = tombstone** (`deleted:1`, `text:""`), физическое удаление через 30 дней (`TOMBSTONE_TTL_MS`).
- `applyRemoteWins` пишет одной IDB-транзакцией с перепроверкой `updatedAt` — правка во время sync не затирается.
- `meta.dirty` снимается **до** чтения данных: правка во время sync выставит его снова → повторный проход в `finally`. Мьютекс `syncing` + флаг `rerun`.
- `remote/types.ts` (`RemoteStore`) — точка замены облака (видимый файл Drive = `parents:["root"]` + scope `drive.file`; Sheets — другой адаптер).
- `driveAppData.ts`: multipart/related **собирается вручную** (FormData шлёт form-data, Drive его не примет); 401 → invalidate + один retry; 404 по fileId → сброс `meta.driveFileId`.

### Auth (`src/auth.ts`) — GIS token flow, без сервера

Нет client_secret и нет refresh token: access token живёт ~1 час, продлевается повторным `requestAccessToken`.

- Скрипт GIS грузится лениво (`loadGis`), при первом обращении.
- `login()` вызывается **только из обработчика клика** — попап Google требует пользовательского жеста; при первом входе `prompt: "consent"`, дальше `""` (тихо).
- `getAccessToken()` неинтерактивен и пробует тихое продление **один раз за загрузку страницы** (`silentTried`) — иначе таймеры синхронизации спамили бы попапами. Неудача → статус `needsReauth` → в меню «Войти заново».
- `localStorage`: `fd.syncEnabled` — пользователь включал синхронизацию (по нему решаем, пробовать ли тихое продление), `fd.email` — для офлайн-UI.
- Статусы: `signedOut` (локальный режим) / `signedIn` / `needsReauth` (нужен клик). В `sync.ts` `needsReauth` → статус `error`, `signedOut` → `localOnly`.

### Инварианты, которые легко сломать

- **Base path**: на GitHub Pages сайт живёт в `/<репозиторий>/`. Ссылки в `index.html` и пути в манифесте (`start_url`/`scope`/иконки) — **относительные**; VITE_BASE подставляется в workflow. Абсолютные пути с ведущим `/` сломают подкаталог.
- Google Console: нужны **Authorized JavaScript origins** (не redirect URI!) — по одному на каждый origin: `http://localhost:5173`, `http://localhost:4173`, боевой `https://<user>.github.io`.
- Service worker активен только в прод-сборке → офлайн и PWA проверять через `npm run preview`, не `npm run dev`. После изменения SW нужно **два** reload (новый SW активируется со второй загрузки).
- `Entry.at` — epoch ms; группировка по дням только по **локальному** времени при рендере (`ui/format.ts`).
- Печать: `@media print` в `style.css` скрывает форму/меню/кнопки; `.screen-only` vs `.print-only` в `DayGroup.tsx` подменяют «Сегодня/Вчера» полными датами. Цвета в печати заданы явно, иначе тёмная тема уедет на бумагу.
- i18n: `src/i18n/en.ts` — источник типа `Dict`, `ru.ts` обязан `satisfies Dict`. Новый язык = файл словаря + строка в `dicts`. `t()` работает вне React; подписка компонентов — `useLocale()`.
- `entries.json` ограничен 5 МБ (простой multipart-upload Drive).
- Тесты исполняются Node напрямую: в `tests/` импорты только с расширением `.ts` и только модулей без браузерных API (`merge.ts`, `ui/format.ts` — чистые).

### Деплой

Push в `main` → `.github/workflows/deploy.yml`: test → build (с `VITE_BASE`) → `configure-pages@v6` → `upload-pages-artifact@v3` → `deploy-pages@v4`. В репозитории нужно один раз выставить Settings → Pages → Source: **GitHub Actions**. Секретов в CI нет.

Реальный вход Google локально проверить нельзя (нужны учётные данные пользователя) — только вручную на `npm run preview` с настроенным `.env` или на боевом адресе.
