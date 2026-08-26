import { b64uDecode } from "./crypto";

export const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
// drive.appdata — несенситивный scope: публикация без верификации Google
export const SCOPES = "openid email https://www.googleapis.com/auth/drive.appdata";

export type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

export function buildAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    // Гарантирует refresh_token при каждом входе (иначе Google выдаёт его только в первый раз)
    prompt: "consent",
    state
  });
  return `${AUTH_URL}?${p}`;
}

async function tokenRequest(params: Record<string, string>): Promise<{ status: number; body: TokenResponse }> {
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params)
  });
  const body = (await r.json().catch(() => ({}))) as TokenResponse;
  return { status: r.status, body };
}

export function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
) {
  return tokenRequest({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  });
}

export function refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  return tokenRequest({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token"
  });
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token })
  }).catch(() => {});
}

// id_token получен напрямую от Google по TLS — проверка подписи не требуется
export function emailFromIdToken(idToken: string): string | undefined {
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64uDecode(idToken.split(".")[1])));
    return typeof payload.email === "string" ? payload.email : undefined;
  } catch {
    return undefined;
  }
}
