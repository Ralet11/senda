import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const origin = "http://127.0.0.1:3213";
let server;
before(async () => {
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3213"], {
    env: { ...process.env, DATABASE_URL: "postgresql://senda_demo:senda_demo@127.0.0.1:5432/senda_demo", OPENAI_API_KEY: "", NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Local server start timeout")), 15000);
    server.once("error", reject);
    server.once("exit", code => { clearTimeout(timer); reject(new Error(`Local server exited: ${code}`)); });
    server.stdout.on("data", data => { if (String(data).includes("Ready")) { clearTimeout(timer); resolve(); } });
  });
});
after(() => server?.kill("SIGTERM"));

test("login HTML and protected routes are accessible only through the unauthenticated login", async () => {
  for (const path of ["/login", "/register", "/", "/admin/projects", "/projects/seed-project", "/workspace"]) {
    const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200, path);
    assert.equal(response.url, `${origin}/login`, path);
    assert.match(await response.text(), /Ingresá a tu proyecto/, path);
  }
});

test("malformed login requests are rejected before accessing a database", async () => {
  for (const body of ["invalid-json", "{}", JSON.stringify({ email: 123, password: false })]) {
    const response = await fetch(`${origin}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "Email y contraseña son requeridos");
  }
});

test("logout without an existing session is idempotent", async () => {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(`${origin}/api/auth/logout`, { method: "POST", signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  }
});
