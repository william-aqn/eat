// AES-GCM-шифрование сессии для HttpOnly-cookie. Формат: base64url(iv(12) ‖ ciphertext).
// Воркер stateless: refresh token существует только внутри cookie пользователя.

const te = new TextEncoder();
const td = new TextDecoder();

export function b64uEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function b64uDecode(s: string): Uint8Array<ArrayBuffer> {
  const norm = s.replaceAll("-", "+").replaceAll("_", "/");
  const pad = norm + "=".repeat((4 - (norm.length % 4)) % 4);
  return Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));
}

function b64Decode(s: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function importKey(keyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", b64Decode(keyB64), "AES-GCM", false, [
    "encrypt",
    "decrypt"
  ]);
}

export async function seal(obj: unknown, keyB64: string): Promise<string> {
  const key = await importKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, te.encode(JSON.stringify(obj)))
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return b64uEncode(out);
}

export async function unseal<T>(sealed: string, keyB64: string): Promise<T> {
  const key = await importKey(keyB64);
  const buf = b64uDecode(sealed);
  const iv = buf.slice(0, 12);
  const ct = buf.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(td.decode(new Uint8Array(pt))) as T;
}
