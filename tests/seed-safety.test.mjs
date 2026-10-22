import test from "node:test";
import assert from "node:assert/strict";
import { assertSafeDemoSeed } from "../prisma/seed-safety.mjs";
const local = { DATABASE_URL: "postgresql://demo:demo@127.0.0.1:5432/senda_demo", SENDA_ALLOW_DEMO_SEED: "true" };
test("explicit local demo seed is accepted", () => assert.doesNotThrow(() => assertSafeDemoSeed(local)));
test("production is refused even with opt-in", () => assert.throws(() => assertSafeDemoSeed({ ...local, NODE_ENV: "production" }), /production/));
test("missing opt-in is refused", () => assert.throws(() => assertSafeDemoSeed({ ...local, SENDA_ALLOW_DEMO_SEED: undefined }), /explicitly/));
test("remote database is refused", () => assert.throws(() => assertSafeDemoSeed({ ...local, DATABASE_URL: "postgresql://demo:demo@db.example.com:5432/demo" }), /loopback/));
test("invalid or missing URL is refused", () => {
  for (const DATABASE_URL of [undefined, "", "not-a-url"]) assert.throws(() => assertSafeDemoSeed({ ...local, DATABASE_URL }), /valid local/);
});
test("other database protocols are refused", () => assert.throws(() => assertSafeDemoSeed({ ...local, DATABASE_URL: "https://localhost/demo" }), /loopback/));
test("IPv6 and localhost are accepted", () => {
  for (const host of ["localhost", "[::1]"]) assert.doesNotThrow(() => assertSafeDemoSeed({ ...local, DATABASE_URL: `postgresql://demo:demo@${host}:5432/demo` }));
});
