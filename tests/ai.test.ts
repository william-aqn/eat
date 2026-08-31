import assert from "node:assert/strict";
import { test } from "node:test";
import { parseKcal } from "../src/ai.ts";
import { decodeSetting, encodeSetting } from "../src/codec.ts";
import type { SettingItem } from "../src/db.ts";
import { mergeEntries } from "../src/merge.ts";

test("parseKcal: bare integer and integer with surrounding text", () => {
  assert.equal(parseKcal("450"), 450);
  assert.equal(parseKcal("Approximately 450 kcal"), 450);
  assert.equal(parseKcal("≈ 450 ккал"), 450);
});

test("parseKcal: thousands separators collapse", () => {
  assert.equal(parseKcal("1,200"), 1200);
  assert.equal(parseKcal("1 200 kcal"), 1200);
});

test("parseKcal: range takes the first number, decimals truncate at the dot", () => {
  assert.equal(parseKcal("450-550 kcal"), 450);
  assert.equal(parseKcal("450.7"), 450);
});

test("parseKcal: no number or out-of-range → null", () => {
  assert.equal(parseKcal("не могу оценить"), null);
  assert.equal(parseKcal("0"), null);
  assert.equal(parseKcal("1000000"), null);
});

test("codec: roundtrip preserves unicode, output hides plaintext", () => {
  const value = "sk-or-v1-секрет 🍕";
  const encoded = encodeSetting(value);
  assert.equal(decodeSetting(encoded), value);
  assert.ok(!encoded.includes("секрет"));
  assert.ok(!encoded.includes("sk-or-v1"));
});

test("codec: broken base64 decodes to empty string, not a crash", () => {
  assert.equal(decodeSetting("!!! not base64 !!!"), "");
});

test("settings merge: per-setting LWW, tombstone clears everywhere", () => {
  const s = (id: string, updatedAt: number, extra: Partial<SettingItem> = {}): SettingItem => ({
    id,
    text: encodeSetting("v" + updatedAt),
    updatedAt,
    deleted: 0,
    ...extra
  });
  // на одном устройстве обновили модель, на другом — стёрли ключ
  const local = [s("aiModel", 200), s("aiKey", 100)];
  const remote = [s("aiModel", 100), s("aiKey", 300, { text: "", deleted: 1 })];
  const r = mergeEntries(local, remote);
  const byId = new Map(r.merged.map((x) => [x.id, x]));
  assert.equal(byId.get("aiModel")!.updatedAt, 200);
  assert.equal(byId.get("aiKey")!.deleted, 1);
  assert.equal(r.pushNeeded, true); // модель новее локально
  assert.deepEqual(r.remoteWins.map((x) => x.id), ["aiKey"]);
});
