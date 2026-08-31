import * as db from "./db";
import type { ForbiddenItem } from "./db";
import { cleanFood, normalizeFood } from "./food";
import { planImport } from "./merge";
import { notifyMutate } from "./store";

let snapshot: ForbiddenItem[] = [];
let keys: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeForbidden(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const getForbiddenSnapshot = (): ForbiddenItem[] => snapshot;

/** Set нормализованных названий — для подсветки позиций в дневнике */
export const getForbiddenKeys = (): ReadonlySet<string> => keys;

export async function refreshForbiddenFromDb(): Promise<void> {
  const rows = await db.allForbidden();
  rows.sort((a, b) => a.text.localeCompare(b.text));
  snapshot = rows;
  keys = new Set(rows.map((f) => f.id));
  emit();
}

async function afterMutate() {
  await db.setMeta("dirty", 1);
  await refreshForbiddenFromDb();
  notifyMutate();
}

/** Доктор сказал «вот это не кушай» — продукт попадает в запрещённые */
export async function markForbidden(text: string): Promise<void> {
  const id = normalizeFood(text);
  if (!id) return;
  const cur = await db.getForbidden(id);
  if (cur && !cur.deleted) return;
  await db.putForbidden({
    id,
    text: cleanFood(text),
    updatedAt: Date.now(),
    deleted: 0
  });
  await afterMutate();
}

export async function unmarkForbidden(id: string): Promise<void> {
  const cur = await db.getForbidden(id);
  if (!cur || cur.deleted) return;
  // текст не затираем: id и так содержит нормализованное название
  await db.putForbidden({ ...cur, deleted: 1, updatedAt: Date.now() });
  await afterMutate();
}

export async function toggleForbidden(text: string): Promise<void> {
  const id = normalizeFood(text);
  if (!id) return;
  if (keys.has(id)) await unmarkForbidden(id);
  else await markForbidden(text);
}

/** Импорт из резервной копии: та же LWW-логика, что и у записей дневника */
export async function importForbidden(imported: ForbiddenItem[]): Promise<void> {
  if (!imported.length) return;
  const local = await db.allForbidden(true);
  const { writes } = planImport(local, imported, Date.now());
  if (writes.length) {
    await db.putForbiddenMany(writes);
    await afterMutate();
  }
}
