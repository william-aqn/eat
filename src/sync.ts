import { getAccessToken, getAuthState } from "./auth";
import * as db from "./db";
import { mergeEntries, purgeOldTombstones, TOMBSTONE_TTL_MS } from "./merge";
import { driveAppData, HttpError } from "./remote/driveAppData";
import type { SyncFile } from "./remote/types";
import { refreshFromDb } from "./store";

const FILE_NAME = "entries.json";

export type SyncStatus =
  | "idle"
  | "syncing"
  | "ok"
  | "error"
  | "offline"
  | "localOnly"
  /** вход выполнялся, но токен протух — нужен клик по «Синхронизировать» */
  | "needsAuth";
export type SyncState = { status: SyncStatus; lastSyncedAt?: number; dirty?: boolean };

let state: SyncState = { status: "idle" };
const listeners = new Set<() => void>();

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

export const getSyncState = (): SyncState => state;

export function subscribeSync(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function loadSyncMeta(): Promise<void> {
  const lastSyncedAt = await db.getMeta<number>("lastSyncedAt");
  if (lastSyncedAt) setState({ lastSyncedAt });
  // правки, не доехавшие до облака в прошлой сессии (например, офлайн)
  if (await db.getMeta<number>("dirty")) setState({ dirty: true });
}

let syncing = false;
let rerun = false;
let timer: ReturnType<typeof setTimeout> | undefined;

export function scheduleSync(delayMs = 4000): void {
  // сюда попадают только правки (и повтор из finally) — есть что отправить
  setState({ dirty: true });
  clearTimeout(timer);
  timer = setTimeout(() => void sync(), delayMs);
}

export async function sync(): Promise<void> {
  if (syncing) {
    rerun = true;
    return;
  }
  if (!navigator.onLine) {
    setState({ status: "offline" });
    return;
  }
  const token = getAccessToken();
  if (!token) {
    // попап здесь не открываем: продление токена — только по клику пользователя
    setState({ status: getAuthState().status === "signedOut" ? "localOnly" : "needsAuth" });
    return;
  }

  syncing = true;
  setState({ status: "syncing" });
  try {
    // Снимаем флаг до чтения данных: правка во время sync снова выставит dirty → повторный проход
    await db.setMeta("dirty", 0);

    let fileId = (await db.getMeta<string>("driveFileId")) ?? null;
    let remote: SyncFile = { version: 1, entries: [] };
    if (!fileId) fileId = await driveAppData.findFile(FILE_NAME);
    if (fileId) {
      try {
        remote = await driveAppData.download(fileId);
      } catch (e) {
        if (e instanceof HttpError && e.status === 404) {
          // файл удалили в облаке — создадим заново
          fileId = null;
          await db.deleteMeta("driveFileId");
        } else {
          throw e;
        }
      }
    }

    const local = await db.allEntries(true);
    const { merged, remoteWins, pushNeeded } = mergeEntries(local, remote.entries ?? []);
    if (remoteWins.length) await db.applyRemoteWins(remoteWins);

    const now = Date.now();
    const { kept, purgedCount } = purgeOldTombstones(merged, now);
    await db.purgeTombstonesBefore(now - TOMBSTONE_TTL_MS);

    if (!fileId) {
      fileId = await driveAppData.create(FILE_NAME, { version: 1, entries: kept });
    } else if (pushNeeded || purgedCount > 0) {
      await driveAppData.update(fileId, { version: 1, entries: kept });
    }

    await db.setMeta("driveFileId", fileId);
    const finishedAt = Date.now();
    await db.setMeta("lastSyncedAt", finishedAt);
    if (remoteWins.length) await refreshFromDb();
    setState({ status: "ok", lastSyncedAt: finishedAt, dirty: false });
  } catch (e) {
    console.warn("sync failed:", e);
    setState({ status: navigator.onLine ? "error" : "offline" });
  } finally {
    syncing = false;
    const dirty = await db.getMeta<number>("dirty").catch(() => 0);
    if (rerun || dirty) {
      rerun = false;
      scheduleSync(1500);
    }
  }
}
