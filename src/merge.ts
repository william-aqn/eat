import type { Entry } from "./db";

export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sameVersion(a: Entry, b: Entry): boolean {
  return (
    a.updatedAt === b.updatedAt && a.deleted === b.deleted && a.text === b.text && a.at === b.at
  );
}

export type MergeResult = {
  /** победители по каждому id */
  merged: Entry[];
  /** версии, которые нужно записать в локальную базу */
  remoteWins: Entry[];
  /** файл в облаке отличается от результата — нужен push */
  pushNeeded: boolean;
};

/**
 * Last-write-wins по каждой записи: побеждает больший updatedAt;
 * при равенстве — удалённая (tombstone) версия, иначе локальная.
 */
export function mergeEntries(local: Entry[], remote: Entry[]): MergeResult {
  const pairs = new Map<string, { l?: Entry; r?: Entry }>();
  for (const e of local) pairs.set(e.id, { l: e });
  for (const e of remote) pairs.set(e.id, { ...pairs.get(e.id), r: e });

  const merged: Entry[] = [];
  const remoteWins: Entry[] = [];
  let pushNeeded = false;

  for (const { l, r } of pairs.values()) {
    let winner: Entry;
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

export function purgeOldTombstones(
  entries: Entry[],
  now: number
): { kept: Entry[]; purgedCount: number } {
  const kept = entries.filter((e) => !(e.deleted && now - e.updatedAt > TOMBSTONE_TTL_MS));
  return { kept, purgedCount: entries.length - kept.length };
}
