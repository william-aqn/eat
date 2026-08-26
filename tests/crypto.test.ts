import assert from "node:assert/strict";
import { test } from "node:test";
import { seal, unseal } from "../worker/crypto.ts";

const key = Buffer.from(new Uint8Array(32).fill(7)).toString("base64");

test("seal/unseal roundtrip", async () => {
  const sealed = await seal({ rt: "refresh-123", email: "a@b.c" }, key);
  const out = await unseal<{ rt: string; email: string }>(sealed, key);
  assert.deepEqual(out, { rt: "refresh-123", email: "a@b.c" });
});

test("sealed values differ between calls (random IV)", async () => {
  const a = await seal({ rt: "x" }, key);
  const b = await seal({ rt: "x" }, key);
  assert.notEqual(a, b);
});

test("tampered payload is rejected", async () => {
  const sealed = await seal({ rt: "refresh-123" }, key);
  const flipped = (sealed.at(-1) === "A" ? "B" : "A") + sealed.slice(1);
  await assert.rejects(unseal(flipped, key));
});

test("wrong key is rejected", async () => {
  const sealed = await seal({ rt: "refresh-123" }, key);
  const otherKey = Buffer.from(new Uint8Array(32).fill(9)).toString("base64");
  await assert.rejects(unseal(sealed, otherKey));
});
