import * as db from "./db";
import type { Entry } from "./db";
import { planImport } from "./merge";

let snapshot: Entry[] = [];
const listeners = new Set<() => void>();
let onMutate: (() => void) | null = null;

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeEntries(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const getEntriesSnapshot = (): Entry[] => snapshot;

export async function refreshFromDb(): Promise<void> {
  const rows = await db.allEntries();
  rows.sort((a, b) => b.at - a.at);
  snapshot = rows;
  emit();
}

/** Вызывается после каждой правки — сюда подключается debounce-синхронизация */
export function setMutateHook(fn: () => void): void {
  onMutate = fn;
}

async function afterMutate() {
  await db.setMeta("dirty", 1);
  await refreshFromDb();
  onMutate?.();
}

export async function addEntry(text: string, at: number): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await db.putEntry({
    id: crypto.randomUUID(),
    text: trimmed,
    at,
    updatedAt: Date.now(),
    deleted: 0
  });
  await afterMutate();
}

export async function editEntry(id: string, patch: { text?: string; at?: number }): Promise<void> {
  const cur = await db.getEntry(id);
  if (!cur || cur.deleted) return;
  await db.putEntry({ ...cur, ...patch, updatedAt: Date.now() });
  await afterMutate();
}

/** Импорт резервной копии: слияние с локальными данными, см. planImport */
export async function importEntries(imported: Entry[]): Promise<{ applied: number }> {
  const local = await db.allEntries(true);
  const { writes } = planImport(local, imported, Date.now());
  if (writes.length) {
    await db.putEntries(writes);
    await afterMutate();
  }
  return { applied: writes.length };
}

export async function removeEntry(id: string): Promise<void> {
  const cur = await db.getEntry(id);
  if (!cur) return;
  // tombstone: текст затираем (не хранить удалённое содержимое), запись чистится через 30 дней
  await db.putEntry({ ...cur, text: "", deleted: 1, updatedAt: Date.now() });
  await afterMutate();
}
