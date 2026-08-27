import assert from "node:assert/strict";
import { test } from "node:test";
import type { Entry } from "../src/db.ts";
import { fromDateInput, groupForPrint, toDateInput } from "../src/ui/format.ts";

const entry = (id: string, at: number): Entry => ({
  id,
  text: "food " + id,
  at,
  updatedAt: at,
  deleted: 0
});

// время строим через локальный Date — тесты не зависят от часового пояса раннера
const at = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();

test("print groups: days ascending, items within a day ascending", () => {
  const entries = [
    entry("b", at(2026, 8, 20, 19)),
    entry("a", at(2026, 8, 20, 8)),
    entry("c", at(2026, 8, 22, 9)),
    entry("d", at(2026, 8, 18, 13))
  ];
  const groups = groupForPrint(entries, null);
  assert.deepEqual(
    groups.map((g) => g.day),
    [day(2026, 8, 18), day(2026, 8, 20), day(2026, 8, 22)]
  );
  assert.deepEqual(
    groups[1].items.map((e) => e.id),
    ["a", "b"]
  );
});

test("print groups: range bounds are inclusive", () => {
  const entries = [
    entry("before", at(2026, 8, 17)),
    entry("from", at(2026, 8, 18, 0, 0)),
    entry("mid", at(2026, 8, 20)),
    entry("to", at(2026, 8, 22, 23, 59)),
    entry("after", at(2026, 8, 23))
  ];
  const groups = groupForPrint(entries, { from: day(2026, 8, 18), to: day(2026, 8, 22) });
  assert.deepEqual(
    groups.flatMap((g) => g.items.map((e) => e.id)),
    ["from", "mid", "to"]
  );
});

test("date input: converts both ways in local time", () => {
  assert.equal(fromDateInput("2026-08-27"), new Date(2026, 7, 27).getTime());
  assert.equal(toDateInput(new Date(2026, 7, 5, 23, 59).getTime()), "2026-08-05");
  assert.equal(toDateInput(fromDateInput("2024-02-29")), "2024-02-29");
});
