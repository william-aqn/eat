// Авторизация без бэкенда: Google Identity Services (token flow) прямо в браузере.
// Секрета нет, refresh token'а нет: access token живёт ~1 час, продление — повторный
// requestAccessToken. Тихое продление возможно при живой сессии Google, но попап
// может быть заблокирован вне пользовательского жеста → статус needsReauth (нужен клик).

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";
const SCOPES = "openid email https://www.googleapis.com/auth/drive.appdata";
const EMAIL_KEY = "fd.email";
const ENABLED_KEY = "fd.syncEnabled";

export type AuthStatus = "signedOut" | "signedIn" | "needsReauth";
export type AuthState = { status: AuthStatus; email: string | null };

let state: AuthState = localStorage.getItem(ENABLED_KEY)
  ? { status: "signedIn", email: localStorage.getItem(EMAIL_KEY) }
  : { status: "signedOut", email: null };

const listeners = new Set<() => void>();

function set(next: AuthState) {
  state = next;
  listeners.forEach((fn) => fn());
}

export const getAuthState = (): AuthState => state;

export function subscribeAuth(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

let cached: { token: string; exp: number } | null = null;
// одна тихая попытка на загрузку страницы — таймеры не должны спамить попапами
let silentTried = false;

let gisLoading: Promise<void> | null = null;

function loadGis(): Promise<void> {
  gisLoading ??= new Promise((resolve, reject) => {
    if (typeof google !== "undefined" && google.accounts?.oauth2) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisLoading = null;
      reject(new Error("gis_load_failed"));
    };
    document.head.appendChild(s);
  });
  return gisLoading;
}

function requestToken(prompt: "" | "consent"): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        prompt,
        callback: (resp) => {
          if (resp.error !== undefined || !resp.access_token) {
            resolve(null);
            return;
          }
          cached = { token: resp.access_token, exp: Date.now() + Number(resp.expires_in) * 1000 };
          resolve(resp.access_token);
        },
        // попап заблокирован или закрыт пользователем
        error_callback: () => resolve(null)
      });
      client.requestAccessToken();
    } catch {
      resolve(null);
    }
  });
}

async function fetchEmail(token: string): Promise<string | null> {
  if (state.email) return state.email;
  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { email?: string };
    if (j.email) localStorage.setItem(EMAIL_KEY, j.email);
    return j.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Access token для Drive API (без взаимодействия с пользователем).
 * null — синхронизация не включена, офлайн или нужен клик (needsReauth).
 */
export async function getAccessToken(): Promise<string | null> {
  if (cached && Date.now() < cached.exp - 60_000) return cached.token;
  if (!localStorage.getItem(ENABLED_KEY)) return null;
  if (silentTried) return null;
  silentTried = true;
  try {
    await loadGis();
  } catch {
    return null;
  }
  const token = await requestToken("");
  if (token) {
    const email = await fetchEmail(token);
    set({ status: "signedIn", email: email ?? state.email });
  } else {
    set({ status: "needsReauth", email: state.email });
  }
  return token;
}

export function invalidateToken(): void {
  cached = null;
  silentTried = false;
}

/** Интерактивный вход (по клику): при первом входе — экран согласия Google */
export async function login(): Promise<boolean> {
  try {
    await loadGis();
  } catch {
    return false;
  }
  const first = !localStorage.getItem(ENABLED_KEY);
  const token = await requestToken(first ? "consent" : "");
  if (!token) {
    if (state.status !== "signedOut") set({ ...state, status: "needsReauth" });
    return false;
  }
  localStorage.setItem(ENABLED_KEY, "1");
  silentTried = false;
  const email = await fetchEmail(token);
  set({ status: "signedIn", email: email ?? state.email });
  return true;
}

export async function logout(): Promise<void> {
  const token = cached?.token;
  if (token) {
    try {
      await loadGis();
      google.accounts.oauth2.revoke(token, () => {});
    } catch {
      // токен и так протухнет через час
    }
  }
  cached = null;
  silentTried = false;
  localStorage.removeItem(EMAIL_KEY);
  localStorage.removeItem(ENABLED_KEY);
  set({ status: "signedOut", email: null });
}
