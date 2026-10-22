import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { consumeRateLimit } from "../src/lib/rate-limit.ts";
import { validateImageUpload, persistChatImage, readChatImage, removeChatImage } from "../src/lib/chat-attachments.ts";
import { hashPassword, verifyPassword } from "../src/lib/password.ts";

test("rate limit allows the budget, rejects excess and isolates keys", () => {
  const input = { key: "test-budget", limit: 2, windowMs: 60000 };
  assert.equal(consumeRateLimit(input).allowed, true);
  assert.equal(consumeRateLimit(input).allowed, true);
  const excess = consumeRateLimit(input);
  assert.equal(excess.allowed, false);
  assert.ok(excess.retryAfterSeconds > 0);
  assert.equal(consumeRateLimit({ ...input, key: "another-user" }).allowed, true);
});

test("rate limit resets after its window", () => {
  const input = { key: "test-expired-window", limit: 1, windowMs: 0 };
  assert.equal(consumeRateLimit(input).allowed, true);
  assert.equal(consumeRateLimit(input).allowed, true);
});

test("passwords are hashed and incorrect passwords are rejected", async () => {
  const hash = await hashPassword("fictional-local-test-password");
  assert.notEqual(hash, "fictional-local-test-password");
  assert.equal(await verifyPassword("fictional-local-test-password", hash), true);
  assert.equal(await verifyPassword("incorrect", hash), false);
});

test("image upload rejects unsupported, empty and oversized files", () => {
  assert.throws(() => validateImageUpload(new File(["text"], "file.txt", { type: "text/plain" })), /UNSUPPORTED_IMAGE_TYPE/);
  assert.throws(() => validateImageUpload(new File([], "empty.png", { type: "image/png" })), /INVALID_IMAGE_SIZE/);
  assert.throws(() => validateImageUpload(new File([new Uint8Array(8 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })), /INVALID_IMAGE_SIZE/);
});

test("image persistence validates signatures and confines storage keys", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "senda-uploads-test-"));
  const previous = process.env.SENDA_UPLOADS_ROOT;
  process.env.SENDA_UPLOADS_ROOT = root;
  try {
    await assert.rejects(persistChatImage(new File(["not an image"], "fake.png", { type: "image/png" })), /INVALID_IMAGE_CONTENT/);
    const content = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYZkAAAAASUVORK5CYII=", "base64");
    const key = await persistChatImage(new File([content], "pixel.png", { type: "image/png" }));
    assert.deepEqual(await readChatImage(key), content);
    assert.equal(await readChatImage("../../README.md"), null);
    await removeChatImage(key);
    assert.equal(await readChatImage(key), null);
  } finally {
    if (previous === undefined) delete process.env.SENDA_UPLOADS_ROOT;
    else process.env.SENDA_UPLOADS_ROOT = previous;
    await rm(root, { recursive: true, force: true });
  }
});
