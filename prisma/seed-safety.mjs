/** Demo data must never be applied to a shared or production database. */
export function assertSafeDemoSeed(env) {
  if (env.NODE_ENV === "production") throw new Error("Demo seed is disabled in production.");
  if (env.SENDA_ALLOW_DEMO_SEED !== "true") {
    throw new Error("Set SENDA_ALLOW_DEMO_SEED=true explicitly for a disposable local database.");
  }
  let url;
  try { url = new URL(env.DATABASE_URL ?? ""); }
  catch { throw new Error("A valid local DATABASE_URL is required for demo seed."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Demo seed only accepts a loopback PostgreSQL database.");
  }
}
