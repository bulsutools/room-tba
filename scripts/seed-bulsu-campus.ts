/**
 * Seed BulSU Malolos Campus 1 + Campus 2 colleges, buildings, and places.
 * Idempotent by normalized name. Approximate coords — fix in the map editor.
 *
 * Usage:
 *   bun run seed:bulsu
 *   bun run scripts/seed-bulsu-campus.ts [--dry-run]
 */

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  buildingsTable,
  collegesTable,
  placesTable,
  updateTable,
} from "@drizzle/schema";
import { normalizeAlias } from "../src/lib/site";
import { loadEnv } from "./load-env";
import seed from "../data/bulsu-seed.json";

loadEnv();

const dryRun = process.argv.includes("--dry-run");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required (set in .env.local)");
  process.exit(1);
}

type CollegeRow = (typeof seed.colleges)[number];
type BuildingRow = (typeof seed.buildings)[number];
type PlaceRow = (typeof seed.places)[number];

const pool = new pg.Pool({
  connectionString,
  // Neon / poolers: avoid prepare issues on serverless-ish URLs.
  max: 2,
});
const db = drizzle(pool);

const SYNC_TABLES = [
  "announcements",
  "buildings",
  "colleges",
  "divisions",
  "dorms",
  "rooms",
  "classes",
  "final_exams",
  "events",
  "organizations",
  "places",
  "event_locations",
  "event_routes",
  "event_route_stops",
  "jeepney_routes",
] as const;

async function ensureSyncKey(tableName: string) {
  await db
    .insert(updateTable)
    .values({ tableName })
    .onConflictDoUpdate({
      target: updateTable.tableName,
      set: { syncKey: sql`gen_random_uuid()` },
    });
}

function nameKey(name: string) {
  return normalizeAlias(name);
}

async function seedColleges() {
  const existing = await db
    .select({ name: collegesTable.collegeName })
    .from(collegesTable);
  const have = new Set(existing.map((r) => nameKey(r.name)).filter(Boolean));
  let inserted = 0;
  let skipped = 0;

  for (const row of seed.colleges as CollegeRow[]) {
    const key = nameKey(row.collegeName);
    if (!key || have.has(key)) {
      skipped++;
      continue;
    }
    if (!dryRun) {
      await db.insert(collegesTable).values({
        collegeName: row.collegeName.trim(),
        websiteLink: row.websiteLink ?? null,
      });
    }
    have.add(key);
    inserted++;
  }
  return { inserted, skipped };
}

async function seedBuildings() {
  const existing = await db
    .select({ name: buildingsTable.buildingName })
    .from(buildingsTable);
  const have = new Set(existing.map((r) => nameKey(r.name)).filter(Boolean));
  let inserted = 0;
  let skipped = 0;

  for (const row of seed.buildings as BuildingRow[]) {
    const key = nameKey(row.buildingName);
    if (!key || have.has(key)) {
      skipped++;
      continue;
    }
    if (!dryRun) {
      await db.insert(buildingsTable).values({
        buildingName: row.buildingName.trim(),
        lat: row.lat,
        lon: row.lon,
        buildingType: row.buildingType === "admin" ? "admin" : "non-admin",
        directions: row.directions?.trim() ?? "",
      });
    }
    have.add(key);
    inserted++;
  }
  return { inserted, skipped };
}

async function seedPlaces() {
  const existing = await db
    .select({ name: placesTable.name })
    .from(placesTable);
  const have = new Set(existing.map((r) => nameKey(r.name)).filter(Boolean));
  let inserted = 0;
  let skipped = 0;

  for (const row of seed.places as PlaceRow[]) {
    const key = nameKey(row.name);
    if (!key || have.has(key)) {
      skipped++;
      continue;
    }
    if (!dryRun) {
      await db.insert(placesTable).values({
        name: row.name.trim(),
        category: row.category,
        lat: row.lat,
        lon: row.lon,
        description: row.description ?? null,
      });
    }
    have.add(key);
    inserted++;
  }
  return { inserted, skipped };
}

try {
  const colleges = await seedColleges();
  const buildings = await seedBuildings();
  const places = await seedPlaces();

  if (!dryRun) {
    for (const tableName of SYNC_TABLES) {
      await ensureSyncKey(tableName);
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        campus: seed.meta.campus,
        colleges,
        buildings,
        places,
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
