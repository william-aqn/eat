/** Общая форма синхронизируемой записи: дневник и запрещённые продукты */
export type Syncable = {
  id: string;
  text: string;
  /** LWW-часы: время последнего изменения, epoch ms */
  updatedAt: number;
  /** tombstone: запись удалена */
  deleted: 0 | 1;
  /** момент приёма пищи — есть у записей дневника, нет у запрещённых продуктов */
  at?: number;
};

export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sameVersion<T extends Syncable>(a: T, b: T): boolean {
  return (
    a.updatedAt === b.updatedAt && a.deleted === b.deleted && a.text === b.text && a.at === b.at
  );
}

export type MergeResult<T extends Syncable> = {
  /** победители по каждому id */
  merged: T[];
  /** версии, которые нужно записать в локальную базу */
  remoteWins: T[];
  /** файл в облаке отличается от результата — нужен push */
  pushNeeded: boolean;
};

/**
 * Last-write-wins по каждой записи: побеждает больший updatedAt;
 * при равенстве — удалённая (tombstone) версия, иначе локальная.
 */
export function mergeEntries<T extends Syncable>(local: T[], remote: T[]): MergeResult<T> {
  const pairs = new Map<string, { l?: T; r?: T }>();
  for (const e of local) pairs.set(e.id, { l: e });
  for (const e of remote) pairs.set(e.id, { ...pairs.get(e.id), r: e });

  const merged: T[] = [];
  const remoteWins: T[] = [];
  let pushNeeded = false;

  for (const { l, r } of pairs.values()) {
    let winner: T;
    if (l && r) {
      if (l.updatedAt > r.updatedAt) winner = l;
      else if (r.updatedAt > l.updatedAt) winner = r;
      else winner = l.deleted ? l : r.deleted ? r : l;
    } else {
      winner = (l ?? r)!;
    }
    merged.push(winner);
    if (!r || !sameVersion(winner, r)) pushNeeded = true;
    if (!l || !sameVersion(winner, l)) remoteWins.push(winner);
  }

  return { merged, remoteWins, pushNeeded };
}

/**
 * План импорта резервной копии поверх локальных данных:
 * новые id добавляются как есть, более свежие импортированные версии побеждают (LWW),
 * а живая запись из бэкапа поверх локального tombstone ВОССТАНАВЛИВАЕТСЯ
 * со свежим updatedAt (импорт — явное намерение вернуть данные; свежий
 * updatedAt разнесёт восстановление по остальным устройствам через sync).
 */
export function planImport<T extends Syncable>(
  local: T[],
  imported: T[],
  now: number
): { writes: T[] } {
  const byId = new Map(local.map((e) => [e.id, e]));
  const writes: T[] = [];
  for (const e of imported) {
    const cur = byId.get(e.id);
    if (!cur || e.updatedAt > cur.updatedAt) writes.push(e);
    else if (cur.deleted && !e.deleted) writes.push({ ...e, deleted: 0, updatedAt: now });
  }
  return { writes };
}

export function purgeOldTombstones<T extends Syncable>(
  entries: T[],
  now: number
): { kept: T[]; purgedCount: number } {
  const kept = entries.filter((e) => !(e.deleted && now - e.updatedAt > TOMBSTONE_TTL_MS));
  return { kept, purgedCount: entries.length - kept.length };
}
