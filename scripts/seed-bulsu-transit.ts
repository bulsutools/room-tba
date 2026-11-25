/**
 * Seed BulSU Malolos transit routes from data/transit/routes.json into
 * jeepney_routes + jeepney_stops. Idempotent: a route whose id already exists
 * is skipped whole (no partial re-insert), so this is safe to rerun — but it
 * also means edits to an existing route need a delete-then-seed or the admin
 * stop API.
 *
 * The dataset ships empty until #7 field collection lands; with `[]` this
 * script is a no-op that still validates the file.
 *
 * Usage:
 *   bun run scripts/seed-bulsu-transit.ts --dry-run
 *   DATABASE_URL=... bun run scripts/seed-bulsu-transit.ts
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { loadEnv } from "./load-env";
import { parseTransitDataset } from "./lib/transit-dataset";

loadEnv();

const DRY_RUN = process.argv.includes("--dry-run");
const DATASET_PATH = join(import.meta.dir, "..", "data", "transit", "routes.json");

const connectionString = process.env.DATABASE_URL;
if (!DRY_RUN && !connectionString) {
  console.error("DATABASE_URL is required (or pass --dry-run)");
  process.exit(1);
}

let json: unknown;
try {
  json = JSON.parse(readFileSync(DATASET_PATH, "utf8"));
} catch (error) {
  console.error(`Could not read ${DATASET_PATH}: ${(error as Error).message}`);
  process.exit(1);
}

const parsed = parseTransitDataset(json);
if (!parsed.ok) {
  console.error("data/transit/routes.json failed validation:");
  for (const error of parsed.errors) console.error(`  - ${error}`);
  process.exit(1);
}

if (parsed.routes.length === 0) {
  console.log("data/transit/routes.json is empty — nothing to seed (#7 pending).");
  process.exit(0);
}

const client = new pg.Client({
  connectionString: connectionString ?? "postgres://invalid",
});
if (!DRY_RUN) await client.connect();

let added = 0;
for (const route of parsed.routes) {
  if (!DRY_RUN) {
    const existing = await client.query(
      "SELECT id FROM jeepney_routes WHERE id = $1",
      [route.id],
    );
    if (existing.rows.length > 0) {
      console.log(`keep  ${route.id} (already present)`);
      continue;
    }
  }
  console.log(
    `${DRY_RUN ? "would add" : "add"} ${route.id} (${route.operator ?? "jeepney"}, ${route.stops.length} stops, ₱${route.fare.regular}/${route.fare.discounted})`,
  );
  if (DRY_RUN) {
    added++;
    continue;
  }
  await client.query(
    `INSERT INTO jeepney_routes (id, name, route_number, description, direction_note, color, operator, fare_regular, fare_discounted, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)`,
    [
      route.id,
      route.name,
      route.number ?? null,
      route.description,
      route.directionNote ?? null,
      route.color,
      route.operator ?? "jeepney",
      route.fare.regular,
      route.fare.discounted,
    ],
  );
  for (const [index, stop] of route.stops.entries()) {
    await client.query(
      `INSERT INTO jeepney_stops (route_id, name, description, lat, lon, sort_order, segment_fare_regular, segment_fare_discounted, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)`,
      [
        route.id,
        stop.name,
        stop.description,
        stop.lat,
        stop.lon,
        stop.sortOrder ?? index + 1,
        stop.fare?.regular ?? null,
        stop.fare?.discounted ?? null,
      ],
    );
  }
  added++;
}

if (!DRY_RUN && added > 0) {
  for (const table of ["jeepney_routes", "jeepney_stops"]) {
    await client.query(
      `UPDATE "update" SET sync_key = $2 WHERE table_name = $1`,
      [table, randomUUID()],
    );
  }
}

console.log(
  `${DRY_RUN ? "[dry-run] would add" : "Added"} ${added} route(s)`,
);
if (!DRY_RUN) await client.end();
