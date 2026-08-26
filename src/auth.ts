export type AuthStatus = "signedOut" | "signedIn" | "needsReauth";
export type AuthState = { status: AuthStatus; email: string | null };

const EMAIL_KEY = "fd.email";

let state: AuthState = (() => {
  const email = localStorage.getItem(EMAIL_KEY);
  return email ? { status: "signedIn", email } : { status: "signedOut", email: null };
})();

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

/**
 * Access token для Drive API. Кэшируется в памяти до истечения (с запасом 60 с),
 * дальше воркер обновляет его из refresh token в HttpOnly-cookie.
 * null — нет пригодной сессии (не залогинен / offline / сессия истекла).
 */
export async function getAccessToken(): Promise<string | null> {
  if (cached && Date.now() < cached.exp - 60_000) return cached.token;

  let r: Response;
  try {
    r = await fetch("/auth/token", { method: "POST" });
  } catch {
    return null; // сеть недоступна — состояние не меняем
  }

  if (r.status === 401) {
    cached = null;
    // Считали себя залогиненными, а сессии нет — предложим войти заново
    if (state.email) set({ status: "needsReauth", email: state.email });
    else set({ status: "signedOut", email: null });
    return null;
  }
  if (!r.ok) return null; // временная ошибка на стороне Google/воркера

  const j = (await r.json()) as { access_token: string; expires_in: number; email: string | null };
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  const email = j.email ?? state.email;
  if (email) localStorage.setItem(EMAIL_KEY, email);
  set({ status: "signedIn", email });
  return cached.token;
}

export function invalidateToken(): void {
  cached = null;
}

export function login(): void {
  location.href = "/auth/login";
}

export async function logout(): Promise<void> {
  try {
    await fetch("/auth/logout", { method: "POST" });
  } catch {
    // офлайн — cookie удалится при следующей попытке
  }
  cached = null;
  localStorage.removeItem(EMAIL_KEY);
  set({ status: "signedOut", email: null });
}
