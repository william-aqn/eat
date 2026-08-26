import assert from "node:assert/strict";
import { test } from "node:test";
import type { Entry } from "../src/db.ts";
import { planImport } from "../src/merge.ts";
import { parseImportFile } from "../src/ui/format.ts";

const e = (id: string, updatedAt: number, extra: Partial<Entry> = {}): Entry => ({
  id,
  text: "food " + id,
  at: 1_000_000,
  updatedAt,
  deleted: 0,
  ...extra
});

test("parse: export file format", () => {
  const text = JSON.stringify({ exportedAt: "2026-08-26", entries: [e("a", 100)] });
  const { entries, skipped } = parseImportFile(text);
  assert.equal(entries.length, 1);
  assert.equal(skipped, 0);
  assert.deepEqual(entries[0], e("a", 100));
});

test("parse: bare array accepted", () => {
  const { entries } = parseImportFile(JSON.stringify([e("a", 100), e("b", 200)]));
  assert.equal(entries.length, 2);
});

test("parse: invalid records skipped, missing updatedAt falls back to at", () => {
  const raw = [
    { id: "ok", text: "x", at: 500 },
    { id: "", text: "no id", at: 1 },
    { text: "no id at all", at: 1 },
    { id: "no-at", text: "x" },
    null
  ];
  const { entries, skipped } = parseImportFile(JSON.stringify(raw));
  assert.equal(entries.length, 1);
  assert.equal(skipped, 4);
  assert.equal(entries[0].updatedAt, 500);
  assert.equal(entries[0].deleted, 0);
});

test("parse: garbage throws", () => {
  assert.throws(() => parseImportFile("not json"));
  assert.throws(() => parseImportFile(JSON.stringify({ foo: "bar" })));
  assert.throws(() => parseImportFile(JSON.stringify({ entries: [{ bad: true }] })));
});

test("import plan: new ids added as-is", () => {
  const { writes } = planImport([], [e("a", 100)], 999);
  assert.deepEqual(writes, [e("a", 100)]);
});

test("import plan: older backup version skipped, newer wins", () => {
  const local = [e("a", 200), e("b", 100)];
  const imported = [e("a", 100, { text: "old" }), e("b", 300, { text: "newer" })];
  const { writes } = planImport(local, imported, 999);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].text, "newer");
});

test("import plan: alive backup entry restores over local tombstone with fresh updatedAt", () => {
  const now = 5_000_000;
  const local = [e("a", 400, { deleted: 1, text: "" })];
  const imported = [e("a", 100, { text: "restored meal" })];
  const { writes } = planImport(local, imported, now);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].deleted, 0);
  assert.equal(writes[0].text, "restored meal");
  assert.equal(writes[0].updatedAt, now);
});

test("import plan: identical backup applies nothing", () => {
  const local = [e("a", 100)];
  const { writes } = planImport(local, [e("a", 100)], 999);
  assert.equal(writes.length, 0);
});
