import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeEntries, purgeOldTombstones, TOMBSTONE_TTL_MS } from "../src/merge.ts";
import type { Entry } from "../src/db.ts";

const e = (id: string, updatedAt: number, extra: Partial<Entry> = {}): Entry => ({
  id,
  text: "food " + id,
  at: 1_000_000,
  updatedAt,
  deleted: 0,
  ...extra
});

test("newer local version wins and requires push", () => {
  const local = [e("a", 200, { text: "edited" })];
  const remote = [e("a", 100)];
  const r = mergeEntries(local, remote);
  assert.equal(r.merged[0].text, "edited");
  assert.equal(r.pushNeeded, true);
  assert.equal(r.remoteWins.length, 0);
});

test("newer remote version wins and lands in remoteWins", () => {
  const local = [e("a", 100)];
  const remote = [e("a", 200, { text: "from cloud" })];
  const r = mergeEntries(local, remote);
  assert.equal(r.merged[0].text, "from cloud");
  assert.equal(r.pushNeeded, false);
  assert.deepEqual(r.remoteWins, [remote[0]]);
});

test("tie on updatedAt → deleted wins", () => {
  const local = [e("a", 100)];
  const remote = [e("a", 100, { deleted: 1, text: "" })];
  const r = mergeEntries(local, remote);
  assert.equal(r.merged[0].deleted, 1);
  assert.equal(r.remoteWins.length, 1);
});

test("local-only entry needs push, remote-only entry applies locally", () => {
  const r = mergeEntries([e("mine", 100)], [e("cloud", 100)]);
  assert.equal(r.merged.length, 2);
  assert.equal(r.pushNeeded, true);
  assert.deepEqual(r.remoteWins.map((x) => x.id), ["cloud"]);
});

test("identical states → no push, no local writes", () => {
  const same = [e("a", 100), e("b", 50, { deleted: 1, text: "" })];
  const r = mergeEntries(same, same.map((x) => ({ ...x })));
  assert.equal(r.pushNeeded, false);
  assert.equal(r.remoteWins.length, 0);
});

test("old tombstones purged, fresh ones kept", () => {
  const now = Date.now();
  const entries = [
    e("old", now - TOMBSTONE_TTL_MS - 1000, { deleted: 1 }),
    e("fresh", now - 1000, { deleted: 1 }),
    e("alive", now - TOMBSTONE_TTL_MS - 1000)
  ];
  const { kept, purgedCount } = purgeOldTombstones(entries, now);
  assert.equal(purgedCount, 1);
  assert.deepEqual(kept.map((x) => x.id).sort(), ["alive", "fresh"]);
});
