# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Команды

```bash
npm run dev        # vite build --watch + wrangler dev → http://localhost:8787 (HMR нет — обновлять страницу)
npm test           # node --test "tests/*.test.ts" (Node type stripping — импорты в тестах с явным .ts)
node --test tests/merge.test.ts                      # один файл
node --test --test-name-pattern="tie" tests/*.test.ts # один тест по имени
npm run typecheck  # два tsconfig: src (DOM, react-jsx) и worker (lib WebWorker, без DOM)
npm run build      # vite → dist/ (клиент + sw.js + manifest)
npm run icons      # перегенерировать PNG из SVG-шаблона в scripts/icons.mjs; PNG коммитятся, CI без sharp
npm run deploy     # build + wrangler deploy (нужен wrangler login или CLOUDFLARE_API_TOKEN)
```

Локальные секреты воркера — `.dev.vars` (см. `.dev.vars.example`). Плейсхолдер `GOOGLE_CLIENT_ID` — в `wrangler.jsonc` (это var, не секрет).

## Архитектура

Local-first PWA «Дневник питания». **Источник истины — IndexedDB в браузере**; Google Drive — реплика для бэкапа/синхронизации между устройствами. Приложение полноценно работает без сети и без входа. Воркер Cloudflare **stateless** (без KV/D1) и нужен только для статики и четырёх `/auth/*`-роутов.

### Поток данных (запись)

компоненты → `src/store.ts` (снапшот + подписчики, компоненты читают через `useSyncExternalStore`) → `src/db.ts` (idb: store `entries` keyPath id, store `meta`) → `meta.dirty=1` → hook из `main.tsx` → `scheduleSync()` (debounce 4 с) → `src/sync.ts`.

Все триггеры синхронизации собраны в `main.tsx`: правка, событие `online`, `visibilitychange`, интервал 5 мин.

### Синхронизация (`sync.ts` + `merge.ts`)

Один проход: pull `entries.json` → `mergeEntries()` (чистая функция в `merge.ts`, покрыта тестами) → `applyRemoteWins()` → purge tombstones → push если нужно.

- **LWW по каждой записи**: побеждает больший `updatedAt`; при равенстве — удалённая (tombstone) версия.
- **Удаление = tombstone**: `deleted:1`, `text:""` (затирается), физическое удаление через 30 дней (`TOMBSTONE_TTL_MS`) после успешного sync.
- `applyRemoteWins` пишет одной IDB-транзакцией с перепроверкой `updatedAt` — правка, сделанная во время sync, не затирается.
- `meta.dirty` снимается **до** чтения данных: правка во время sync выставит его снова → повторный проход в `finally`. Мьютекс `syncing` + флаг `rerun`.
- `remote/types.ts` (`RemoteStore`) — точка замены облака: видимый файл = `parents:["root"]` + scope `drive.file`; Google Sheets — другой адаптер.
- `driveAppData.ts`: multipart/related для создания файла **собирается вручную** (FormData шлёт form-data — Drive его не примет); 401 → invalidate token + один retry; 404 по fileId → сброс `meta.driveFileId`, файл пересоздаётся.

### Auth (worker/ + src/auth.ts)

OAuth code flow целиком в воркере; браузер ходит в Drive API **напрямую** (fetch + Bearer, CORS поддержан Google).

- `/auth/callback` кладёт refresh token в cookie `session`, зашифрованную AES-GCM (`worker/crypto.ts`, ключ — секрет `COOKIE_KEY`). Формат: base64url(iv ‖ ciphertext).
- Cookie: HttpOnly, **SameSite=Lax** (обязана пережить top-level GET-возврат от Google; Strict сломает вход), **Path=/auth** (не ездит со статикой), Secure везде кроме localhost.
- `POST /auth/token` меняет refresh token на часовой access token; клиент (`src/auth.ts`) кэширует его в памяти (обновление за 60 с до истечения).
- 401 от `/auth/token`: был сохранён email (`localStorage fd.email`) → статус `needsReauth` (кнопка «Войти заново»), иначе `signedOut`. Локальные данные при этом не трогаются.
- В auth-URL обязателен `prompt=consent` — без него Google выдаёт `refresh_token` только при самой первой авторизации.

### Инварианты, которые легко сломать

- `workbox.navigateFallbackDenylist: [/^\/auth\//]` в `vite.config.ts` — service worker перехватывает навигацию **раньше** воркера; без этого OAuth-callback получит кэшированный index.html и вход молча сломается. Парная настройка — `run_worker_first: ["/auth/*"]` в `wrangler.jsonc`.
- `compatibility_date` в `wrangler.jsonc` не может быть новее workerd, встроенного в установленный wrangler (иначе `wrangler dev` падает).
- `Entry.at` — epoch ms; группировка по дням — только по **локальному** времени при рендере (`ui/format.ts`), в данных дни не фиксируются.
- `entries.json` ограничен 5 МБ (простой multipart-upload Drive).
- i18n: `src/i18n/en.ts` — источник типа `Dict`; `ru.ts` обязан `satisfies Dict`. Новый язык = файл словаря + строка в `dicts` (`src/i18n/index.ts`). `t()` работает вне React; подписка компонентов — `useLocale()`.
- Тесты исполняются Node напрямую (type stripping): в `tests/` импорты только с расширением `.ts` и только модулей без браузерных зависимостей (`merge.ts`, `worker/crypto.ts` — чистые).

### Деплой и ручная настройка

Push в `main` → `.github/workflows/deploy.yml`: test → build → `cloudflare/wrangler-action@v4` (секреты `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`). Разовая настройка Google Cloud Console / секретов воркера / GitHub — пошаговый чеклист в README.md. Важно: OAuth-приложение должно быть опубликовано «In production» — в статусе «Testing» refresh tokens умирают каждые 7 дней.

Реальный вход Google и e2e-синхронизацию локально проверить нельзя (нужны учётные данные пользователя) — только вручную на localhost:8787 c заполненным `.dev.vars` или на проде.
