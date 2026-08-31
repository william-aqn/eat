import { decodeSetting, encodeSetting } from "./codec";
import * as db from "./db";
import { notifyMutate } from "./store";

/** id настроек в store «settings» */
export const AI_KEY = "aiKey";
export const AI_MODEL = "aiModel";

let snapshot: ReadonlyMap<string, string> = new Map();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Расшифрованные значения настроек (id → значение); удалённых здесь нет */
export const getSettingsSnapshot = (): ReadonlyMap<string, string> => snapshot;

export async function refreshSettingsFromDb(): Promise<void> {
  const rows = await db.allSettings();
  snapshot = new Map(rows.map((s) => [s.id, decodeSetting(s.text)]));
  emit();
}

async function afterMutate() {
  await db.setMeta("dirty", 1);
  await refreshSettingsFromDb();
  notifyMutate();
}

/** Пустое значение = tombstone: настройка стирается и на остальных устройствах */
export async function setSetting(id: string, value: string): Promise<void> {
  const trimmed = value.trim();
  if ((snapshot.get(id) ?? "") === trimmed) return;
  await db.putSetting(
    trimmed
      ? { id, text: encodeSetting(trimmed), updatedAt: Date.now(), deleted: 0 }
      : { id, text: "", updatedAt: Date.now(), deleted: 1 }
  );
  await afterMutate();
}
