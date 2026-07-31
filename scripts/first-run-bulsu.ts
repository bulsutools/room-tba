/**
 * First-run setup for the BulSU Malolos fork.
 *
 * Checks DATABASE_URL, pushes schema when tables are missing, seeds Campus 1+2
 * pins, prints next steps.
 *
 * Usage:
 *   bun run setup:bulsu
 *   bun run scripts/first-run-bulsu.ts [--skip-push] [--dry-run]
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import pg from "pg";
import { loadEnv } from "./load-env";

loadEnv();

const skipPush = process.argv.includes("--skip-push");
const dryRun = process.argv.includes("--dry-run");

function fail(message: string): never {
  console.error(`setup:bulsu: ${message}`);
  process.exit(1);
}

function ok(message: string) {
  console.log(`setup:bulsu: ${message}`);
}

if (!existsSync(".env.local") && !existsSync(".env")) {
  fail("missing .env.local — copy .env.example and set DATABASE_URL (Neon).");
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  fail("DATABASE_URL is empty. Put your Neon connection string in .env.local.");
}

if (!process.env.ADMIN_PASSWORD?.trim()) {
  ok(
    "warning: ADMIN_PASSWORD unset — editor login will not bootstrap until set.",
  );
}

if (!process.env.ADMIN_SESSION_SECRET?.trim()) {
  ok(
    "warning: ADMIN_SESSION_SECRET unset — set a random secret before sharing the app.",
  );
}

if (!process.env.PUBLIC_MAPTILER_KEY?.trim()) {
  ok(
    "warning: PUBLIC_MAPTILER_KEY unset — map falls back to flat raster tiles locally.",
  );
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
let needsPush = false;
try {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ exists: boolean }>(
      `SELECT to_regclass('public.buildings') IS NOT NULL AS exists`,
    );
    needsPush = !rows[0]?.exists;
  } finally {
    client.release();
  }
} catch (err) {
  await pool.end();
  fail(`cannot connect to DATABASE_URL: ${(err as Error).message}`);
} finally {
  await pool.end();
}

if (needsPush && skipPush) {
  fail(
    "buildings table missing; re-run without --skip-push to drizzle-kit push.",
  );
}

if (needsPush) {
  ok("schema missing — running bunx drizzle-kit push");
  const push = spawnSync("bunx", ["drizzle-kit", "push"], {
    stdio: "inherit",
    env: process.env,
  });
  if (push.status !== 0) fail("drizzle-kit push failed");
} else {
  ok("schema present (buildings table found)");
}

ok(dryRun ? "dry-run seed" : "seeding BulSU campus data");
const seedArgs = ["run", "scripts/seed-bulsu-campus.ts"];
if (dryRun) seedArgs.push("--dry-run");
const seed = spawnSync("bun", seedArgs, {
  stdio: "inherit",
  env: process.env,
});
if (seed.status !== 0) fail("seed:bulsu failed");

ok("done.");
console.log(`
Next:
  bunx astro dev --port 4331
  Open http://localhost:4331 — map should center on Malolos Campus 1.
  Editor: /?editor=login (username admin + ADMIN_PASSWORD after first login bootstrap).
  Fix pins in map edit mode; edit data/bulsu-seed.json + re-run bun run seed:bulsu for new rows only.
`);
