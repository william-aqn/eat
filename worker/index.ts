import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { b64uEncode, seal, unseal } from "./crypto";
import {
  buildAuthUrl,
  emailFromIdToken,
  exchangeCode,
  refreshAccessToken,
  revokeToken
} from "./google";

type Env = {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  COOKIE_KEY: string;
  ASSETS: { fetch: (req: Request) => Promise<Response> };
};

type Session = { rt: string; email?: string };

const SESSION_COOKIE = "session";
const STATE_COOKIE = "oauth_state";
const YEAR = 31536000;

const app = new Hono<{ Bindings: Env }>();

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

// SameSite=Lax: cookie едет с top-level GET-возвратом от Google, но не с cross-site POST (CSRF).
// Path=/auth: cookie не отправляется с запросами статики.
function cookieOpts(url: URL) {
  return {
    httpOnly: true,
    sameSite: "Lax",
    path: "/auth",
    secure: !isLocalHost(url.hostname)
  } as const;
}

app.get("/auth/login", (c) => {
  const url = new URL(c.req.url);
  const state = b64uEncode(crypto.getRandomValues(new Uint8Array(16)));
  setCookie(c, STATE_COOKIE, state, { ...cookieOpts(url), maxAge: 600 });
  return c.redirect(buildAuthUrl(c.env.GOOGLE_CLIENT_ID, url.origin + "/auth/callback", state));
});

app.get("/auth/callback", async (c) => {
  const url = new URL(c.req.url);
  if (url.searchParams.get("error")) return c.redirect("/?auth=denied");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = getCookie(c, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: "/auth" });
  if (!code || !state || !expected || state !== expected) return c.redirect("/?auth=error");

  const { status, body } = await exchangeCode(
    code,
    c.env.GOOGLE_CLIENT_ID,
    c.env.GOOGLE_CLIENT_SECRET,
    url.origin + "/auth/callback"
  );
  if (status !== 200 || !body.refresh_token) return c.redirect("/?auth=error");

  const session: Session = {
    rt: body.refresh_token,
    email: body.id_token ? emailFromIdToken(body.id_token) : undefined
  };
  setCookie(c, SESSION_COOKIE, await seal(session, c.env.COOKIE_KEY), {
    ...cookieOpts(url),
    maxAge: YEAR
  });
  return c.redirect("/");
});

app.post("/auth/token", async (c) => {
  const url = new URL(c.req.url);
  const sealed = getCookie(c, SESSION_COOKIE);
  if (!sealed) return c.json({ error: "no_session" }, 401);

  let session: Session;
  try {
    session = await unseal<Session>(sealed, c.env.COOKIE_KEY);
  } catch {
    deleteCookie(c, SESSION_COOKIE, { path: "/auth" });
    return c.json({ error: "bad_session" }, 401);
  }

  const { status, body } = await refreshAccessToken(
    session.rt,
    c.env.GOOGLE_CLIENT_ID,
    c.env.GOOGLE_CLIENT_SECRET
  );
  if (status !== 200 || !body.access_token) {
    if (body.error === "invalid_grant") {
      // Доступ отозван или токен истёк — сессия больше не годится
      deleteCookie(c, SESSION_COOKIE, { path: "/auth" });
      return c.json({ error: "invalid_grant" }, 401);
    }
    return c.json({ error: "google_error" }, 502);
  }

  // Продлеваем cookie при каждом успешном обновлении
  setCookie(c, SESSION_COOKIE, sealed, { ...cookieOpts(url), maxAge: YEAR });
  return c.json({
    access_token: body.access_token,
    expires_in: body.expires_in ?? 3600,
    email: session.email ?? null
  });
});

app.post("/auth/logout", async (c) => {
  const sealed = getCookie(c, SESSION_COOKIE);
  if (sealed) {
    try {
      const session = await unseal<Session>(sealed, c.env.COOKIE_KEY);
      await revokeToken(session.rt);
    } catch {
      // повреждённая cookie — просто удаляем
    }
  }
  deleteCookie(c, SESSION_COOKIE, { path: "/auth" });
  return c.body(null, 204);
});

// Страховка: всё, что не /auth/*, отдаём как статику (обычно сюда не попадает — run_worker_first)
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
