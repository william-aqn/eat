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
- `getAccessToken()` **синхронный и берёт токен только из кэша** — ни сети, ни попапа. Тихого продления в GIS token flow не существует: `requestAccessToken()` открывает окно даже при `prompt:""`, а окно при запуске ломает офлайн-приложение. Продление — только по клику (`login()` из «Войти» / «Синхронизировать»), поэтому `loadGis()` вызывается лишь оттуда и скрипт GIS на старте не грузится вовсе. Сам токен кэшируется в `localStorage` (`fd.token`/`fd.tokenExp`) и переживает перезагрузку — F5 внутри часа не просит вход; `invalidateToken()`/`logout()` его чистят.
- `localStorage`: `fd.syncEnabled` — пользователь включал синхронизацию (по нему решаем, пробовать ли тихое продление), `fd.email` — для офлайн-UI.
- Статусы auth: `signedOut` (локальный режим) / `signedIn` / `needsReauth` (нужен клик). В `sync.ts` при пустом токене: `signedOut` → `localOnly`, иначе → `needsAuth` («нажмите «Синхронизировать»»). Автотриггеры при протухшем токене молча ничего не делают — это и есть офлайн-режим по умолчанию. При несинхронизированных правках точка в шапке жёлтая: `SyncState.dirty` ставится в `scheduleSync`, снимается при успешном проходе, между сессиями восстанавливается из `meta.dirty`.

### Инварианты, которые легко сломать

- **Base path**: сайт живёт на кастомном домене `eat.x-crm.in` в корне, поэтому base = `/` (значение по умолчанию в `vite.config.ts`, workflow `VITE_BASE` не задаёт). Ссылки в `index.html` и пути в манифесте (`start_url`/`scope`/иконки) всё равно держим **относительными** — они переживут переезд на подкаталог.
- Google Console: нужны **Authorized JavaScript origins** (не redirect URI!) — по одному на каждый origin: `http://localhost:5173`, `http://localhost:4173`, боевой `https://eat.x-crm.in`.
- Service worker активен только в прод-сборке → офлайн и PWA проверять через `npm run preview`, не `npm run dev`. После изменения SW нужно **два** reload (новый SW активируется со второй загрузки).
- `Entry.at` — epoch ms; группировка по дням только по **локальному** времени при рендере (`ui/format.ts`).
- Печать: пункт меню открывает `PrintDialog` (диапазон дат), на бумагу идёт только отдельный `PrintSheet` (`.psheet`) — экранный DOM в `@media print` скрыт целиком. Порядок хронологический (старые дни первыми), чтобы листы можно было **допечатывать**; колонки заданы `column-width` и сами подстраиваются под ориентацию A4 (11pt → портрет 2 колонки, альбом 3). Два правила там несущие: `#root` в `@media print` обязан быть `display: block` — флекс-колонка экранной вёрстки ломает фрагментацию мультиколонки, и Chrome печатает **пустые листы** между заполненными; первая колонка `.pentry` задана фиксированной шириной, а не `max-content` — иначе каждая запись считает её сама и текст начинается на разном отступе. `fd.printedTo` в localStorage — последний напечатанный день, следующая печать предлагает продолжить со следующего; Ctrl+P без диалога печатает весь дневник (диапазон сбрасывается в `afterprint`). Цвета печати заданы явно (тёмная тема не для бумаги), шрифт на бумаге обычный, не моно.
- i18n: `src/i18n/en.ts` — источник типа `Dict`, `ru.ts` обязан `satisfies Dict`. Новый язык = файл словаря + строка в `dicts`. `t()` работает вне React; подписка компонентов — `useLocale()`.
- `entries.json` ограничен 5 МБ (простой multipart-upload Drive).
- Запрещённые продукты: store `forbidden` в IDB (версия БД 2), модуль `forbidden.ts`. id = нормализованное название (`normalizeFood` из `food.ts`: trim+lowercase+схлопнутые пробелы) — один продукт с разных устройств сливается сам. Удаление = tombstone, текст НЕ затирается (id и так содержит название). В `entries.json` — необязательное поле `forbidden`; merge/planImport в `merge.ts` — дженерики, общие с записями. Подсветка позиций — `getForbiddenKeys()` (Set нормализованных названий).
- Тема **только тёмная**, палитра повторяет блог x-crm.in (`pages-themes/hacker` + акцент `#e4c49f`): переменные в `:root` файла `style.css`, там же `color-scheme: dark`. `--card` полупрозрачный — непрозрачный фон (выпадающее меню) берёт `--bg`. Те же цвета продублированы в `index.html` (`theme-color`), `vite.config.ts` (манифест) и `scripts/icons.mjs` (`BG`/`ACCENT`) — менять надо во всех четырёх местах.
- Автоподсказка еды: `food.ts` — чистый модуль (нормализация названия, словарь съеденного `collectFoods`, ранжирование `suggestFoods`, работа со строкой под курсором), UI — `components/FoodInput.tsx` (общая textarea формы добавления и режима правки). Подсказки строятся по **строке под курсором** (строка = позиция приёма пищи) и только когда курсор в её конце без выделения — иначе подстановка целой строки была бы неожиданной. Ранг: совпадение с начала названия → с начала слова → любое вхождение, внутри — по частоте и свежести; уже набранное целиком и позиции из соседних строк не предлагаются. ↑↓ выбирают, Enter подставляет **только после явного** выбора стрелками (иначе Enter — обычный перевод строки, то есть новая позиция), Tab подставляет первую, Esc прячет. Запрещённые продукты в списке помечены красным и ⊘.
- ИИ-оценка калорий: OpenRouter **прямо из браузера** (CORS у них открыт, бэкенд не нужен). `ai.ts` — чистый модуль (запрос, `parseKcal`, публичный список моделей); ключ и модель — записи store `settings` в IDB (версия БД 3) через `settings.ts`, синхронизируются тем же LWW-дженериком в необязательном поле `settings` файла `entries.json`. Значения настроек в base64 (`codec.ts`) — это **кодирование от случайного взгляда, не шифрование** (осознанное решение). Пустое значение настройки = tombstone. Оценка пишется в необязательное `Entry.kcal` (едет через merge без правок — LWW заменяет запись целиком) и **затирается при изменении текста** записи; кнопка «≈» в записи видна только при заданном ключе, запрос — только по явному клику (офлайн-философия: никаких фоновых обращений).
- Тесты исполняются Node напрямую: в `tests/` импорты только с расширением `.ts` и только модулей без браузерных API (`merge.ts`, `food.ts`, `ui/format.ts`, `ai.ts`, `codec.ts` — чистые; `btoa`/`atob` в Node есть).

### Деплой

Push в `main` → `.github/workflows/deploy.yml`: test → build → `configure-pages@v6` → `upload-pages-artifact@v3` → `deploy-pages@v4`. В репозитории нужно один раз выставить Settings → Pages → Source: **GitHub Actions** и Custom domain `eat.x-crm.in`. Секретов в CI нет.

`public/CNAME` обязателен: артефакт перезаписывает содержимое Pages целиком, без файла кастомный домен слетает на каждом деплое.

Реальный вход Google локально проверить нельзя (нужны учётные данные пользователя) — только вручную на `npm run preview` с настроенным `.env` или на боевом адресе.
