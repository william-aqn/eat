import { getAccessToken, invalidateToken } from "../auth";
import type { RemoteStore, SyncFile } from "./types";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(`Drive ${status}: ${message}`);
  }
}

async function driveFetch(url: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const token = getAccessToken();
  if (!token) throw new Error("not_signed_in");
  const r = await fetch(url, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` }
  });
  if (r.status === 401 && retry) {
    invalidateToken();
    return driveFetch(url, init, false);
  }
  if (!r.ok) throw new HttpError(r.status, await r.text().catch(() => r.statusText));
  return r;
}

export const driveAppData: RemoteStore = {
  async findFile(name) {
    const q = encodeURIComponent(`name = '${name}'`);
    const r = await driveFetch(
      `${API}/files?spaces=appDataFolder&q=${q}&fields=files(id,name)&pageSize=10`
    );
    const j = (await r.json()) as { files?: { id: string }[] };
    return j.files?.[0]?.id ?? null;
  },

  async create(name, data) {
    // Drive требует multipart/related (FormData шлёт multipart/form-data — не подходит)
    const boundary = "fd" + crypto.randomUUID();
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name, parents: ["appDataFolder"] }) +
      `\r\n--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      JSON.stringify(data) +
      `\r\n--${boundary}--`;
    const r = await driveFetch(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body
    });
    return ((await r.json()) as { id: string }).id;
  },

  async update(fileId, data) {
    await driveFetch(`${UPLOAD}/files/${fileId}?uploadType=media`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  },

  async download(fileId) {
    const r = await driveFetch(`${API}/files/${fileId}?alt=media`);
    return (await r.json()) as SyncFile;
  }
};
