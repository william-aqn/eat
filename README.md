# Дневник питания

Минималистичный дневник питания: время + что съели, свободным текстом.

- **Local-first / офлайн**: все данные в IndexedDB браузера, приложение полностью работает без сети и без входа. Service worker кэширует оболочку — сайт открывается офлайн.
- **PWA**: устанавливается как отдельное приложение (значок на рабочем столе / домашнем экране).
- **Синхронизация в ваш Google-аккаунт**: после входа записи периодически выгружаются в скрытую папку приложения на Google Диске (`appDataFolder`, файл `entries.json`). Данные лежат только у вас; сервер (Cloudflare Worker) — stateless, без БД, хранит только зашифрованный refresh token в вашей же cookie.
- **Мультиязычность**: ru / en, автоопределение, переключатель в шапке. Новый язык = один файл словаря в `src/i18n/`.
- **Экспорт JSON** — кнопка внизу страницы.

Стек: React 19 + TypeScript + Vite 8, vite-plugin-pwa, idb; Cloudflare Worker (Hono) + static assets; деплой — GitHub Actions + wrangler.

## Как работает синхронизация

Источник истины — локальная база. Раз в 5 минут (и после каждой правки, при выходе в онлайн, при возврате на вкладку) выполняется merge с файлом на Диске: по каждой записи побеждает более поздняя версия (last-write-wins), удаления переносятся tombstone-ами и вычищаются через 30 дней.

Ограничения (осознанные, для личного дневника): при одновременной правке одной записи на двух устройствах побеждает более поздняя целиком; устройство, бывшее офлайн дольше 30 дней, может «воскресить» удалённую запись.

## Локальная разработка

```bash
npm install
npm run dev        # vite build --watch + wrangler dev → http://localhost:8787
npm test           # юнит-тесты merge и шифрования cookie
npm run typecheck
npm run icons      # перегенерировать PNG-иконки из SVG-шаблона (scripts/icons.mjs)
```

Без настройки Google приложение работает в локальном режиме (кнопка «Войти» будет вести на ошибку Google — это ожидаемо). Для локальной проверки входа создайте `.dev.vars` по образцу `.dev.vars.example`.

## Настройка (один раз, ~20 минут)

### A. Cloudflare

1. Аккаунт на [dash.cloudflare.com](https://dash.cloudflare.com) (бесплатного тарифа достаточно).
2. **Account ID**: Workers & Pages → правая колонка.
3. **API token**: [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) → Create Token → шаблон **Edit Cloudflare Workers**.

### B. Первый деплой (узнаём URL для redirect URI)

```bash
npx wrangler login
npm run deploy
```

Wrangler напечатает URL вида `https://eat-diary.<ваш-сабдомен>.workers.dev`. Вход через Google пока не работает — это нормально, идём дальше.

### C. Google Cloud Console

1. [console.cloud.google.com](https://console.cloud.google.com) → создать проект (например, `food-diary`).
2. **APIs & Services → Library → Google Drive API → Enable** (без этого все вызовы вернут 403).
3. **Google Auth Platform** ([console.cloud.google.com/auth](https://console.cloud.google.com/auth)) → Get started: имя приложения, support email, Audience: **External**.
4. **Data Access → Add scopes**: `.../auth/drive.appdata`, `.../auth/userinfo.email`, `openid` (все несенситивные).
5. **Clients → Create client → Web application** → Authorized redirect URIs (точное совпадение, без завершающего `/`):
   - `http://localhost:8787/auth/callback`
   - `https://eat-diary.<ваш-сабдомен>.workers.dev/auth/callback`

   Скопируйте **Client ID** и **Client Secret**.
6. **Audience → Publish App** (статус «In production»). Верификация не требуется — scopes несенситивные. В статусе «Testing» refresh tokens умирают каждые 7 дней — не оставляйте его.

### D. Секреты воркера

1. Client ID вставьте в `wrangler.jsonc` → `vars.GOOGLE_CLIENT_ID` (это не секрет).
2. ```bash
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   ```
3. Сгенерируйте ключ шифрования cookie и сохраните его:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   ```bash
   npx wrangler secret put COOKIE_KEY
   ```
4. ```bash
   npm run deploy
   ```
   После этого вход и синхронизация работают на проде.

### E. GitHub Actions (автодеплой при push в main)

1. Создайте пустой репозиторий на GitHub.
2. Repo → Settings → Secrets and variables → Actions → добавьте:
   - `CLOUDFLARE_API_TOKEN` (из шага A3)
   - `CLOUDFLARE_ACCOUNT_ID` (из шага A2)
3. ```bash
   git remote add origin https://github.com/<вы>/<репозиторий>.git
   git push -u origin main
   ```

Каждый push в `main` запускает тесты, сборку и деплой (`.github/workflows/deploy.yml`).

## Безопасность

- Refresh token шифруется AES-GCM ключом, известным только воркеру, и живёт в HttpOnly/Secure/SameSite=Lax cookie с `Path=/auth` — JS-код страницы его не видит, со статикой он не передаётся.
- Access token живёт в памяти вкладки ~1 час; браузер обращается к Google Drive API напрямую.
- Отозвать доступ можно в любой момент: [myaccount.google.com/permissions](https://myaccount.google.com/permissions) — приложение покажет «Войти заново», локальные данные не пострадают.
