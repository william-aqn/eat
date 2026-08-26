import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type Entry = {
  id: string;
  text: string;
  /** момент приёма пищи, epoch ms */
  at: number;
  /** LWW-часы: время последнего изменения, epoch ms */
  updatedAt: number;
  /** tombstone: запись удалена, text затёрт */
  deleted: 0 | 1;
};

/** Продукт, который доктор запретил; id — нормализованное название (см. normalizeFood) */
export type ForbiddenItem = {
  id: string;
  /** название в исходном написании — для показа в списке */
  text: string;
  updatedAt: number;
  deleted: 0 | 1;
};

interface DiarySchema extends DBSchema {
  entries: { key: string; value: Entry; indexes: { "by-at": number } };
  forbidden: { key: string; value: ForbiddenItem };
  meta: { key: string; value: unknown };
}

/** v2: store «forbidden» — запрещённые продукты */
const DB_VERSION = 2;

let dbp: Promise<IDBPDatabase<DiarySchema>> | null = null;

function db() {
  dbp ??= openDB<DiarySchema>("food-diary", DB_VERSION, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        const store = d.createObjectStore("entries", { keyPath: "id" });
        store.createIndex("by-at", "at");
        d.createObjectStore("meta");
      }
      if (oldVersion < 2) {
        d.createObjectStore("forbidden", { keyPath: "id" });
      }
    }
  });
  return dbp;
}

export async function allEntries(includeDeleted = false): Promise<Entry[]> {
  const rows = await (await db()).getAll("entries");
  return includeDeleted ? rows : rows.filter((e) => !e.deleted);
}

export async function getEntry(id: string): Promise<Entry | undefined> {
  return (await db()).get("entries", id);
}

export async function putEntry(e: Entry): Promise<void> {
  await (await db()).put("entries", e);
}

export async function putEntries(list: Entry[]): Promise<void> {
  const tx = (await db()).transaction("entries", "readwrite");
  for (const e of list) await tx.store.put(e);
  await tx.done;
}

/**
 * Применяет победившие удалённые версии одной транзакцией, перепроверяя updatedAt:
 * правка, сделанная во время синхронизации, не будет затёрта устаревшими данными.
 */
export async function applyRemoteWins(wins: Entry[]): Promise<void> {
  const tx = (await db()).transaction("entries", "readwrite");
  for (const w of wins) {
    const cur = await tx.store.get(w.id);
    if (
      !cur ||
      cur.updatedAt < w.updatedAt ||
      (cur.updatedAt === w.updatedAt && w.deleted && !cur.deleted)
    ) {
      await tx.store.put(w);
    }
  }
  await tx.done;
}

export async function purgeTombstonesBefore(cutoff: number): Promise<void> {
  const tx = (await db()).transaction("entries", "readwrite");
  for (const e of await tx.store.getAll()) {
    if (e.deleted && e.updatedAt < cutoff) await tx.store.delete(e.id);
  }
  await tx.done;
}

export async function allForbidden(includeDeleted = false): Promise<ForbiddenItem[]> {
  const rows = await (await db()).getAll("forbidden");
  return includeDeleted ? rows : rows.filter((f) => !f.deleted);
}

export async function getForbidden(id: string): Promise<ForbiddenItem | undefined> {
  return (await db()).get("forbidden", id);
}

export async function putForbidden(f: ForbiddenItem): Promise<void> {
  await (await db()).put("forbidden", f);
}

export async function putForbiddenMany(list: ForbiddenItem[]): Promise<void> {
  const tx = (await db()).transaction("forbidden", "readwrite");
  for (const f of list) await tx.store.put(f);
  await tx.done;
}

/** Как applyRemoteWins, но для запрещённых продуктов */
export async function applyForbiddenWins(wins: ForbiddenItem[]): Promise<void> {
  const tx = (await db()).transaction("forbidden", "readwrite");
  for (const w of wins) {
    const cur = await tx.store.get(w.id);
    if (
      !cur ||
      cur.updatedAt < w.updatedAt ||
      (cur.updatedAt === w.updatedAt && w.deleted && !cur.deleted)
    ) {
      await tx.store.put(w);
    }
  }
  await tx.done;
}

export async function purgeForbiddenTombstonesBefore(cutoff: number): Promise<void> {
  const tx = (await db()).transaction("forbidden", "readwrite");
  for (const f of await tx.store.getAll()) {
    if (f.deleted && f.updatedAt < cutoff) await tx.store.delete(f.id);
  }
  await tx.done;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get("meta", key)) as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await db()).put("meta", value, key);
}

export async function deleteMeta(key: string): Promise<void> {
  await (await db()).delete("meta", key);
}
