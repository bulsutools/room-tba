# BulSU Malolos transit dataset

`routes.json` is the repo-side source for campus transit routes (jeepney,
bus, tricycle). It is intentionally **empty**: real Malolos route, stop, and
fare data is being field-collected under
[bulsutools/room-tba#7](https://github.com/bulsutools/room-tba/issues/7).
Do not invent fares or stops — an unverified guess is worse than no route.

When #7 lands, edit `routes.json` via PR, then seed:

```sh
bun run scripts/seed-bulsu-transit.ts --dry-run
DATABASE_URL=... bun run scripts/seed-bulsu-transit.ts
```

The seed is idempotent: a route id already in `jeepney_routes` is skipped
whole, so rerunning after edits requires deleting the row first (or updating
via the admin stop API).

## Shape

Top level is an array of routes:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | lowercase kebab-case, stable forever (it is the URL slug under `/transit/`) |
| `name` | yes | rider-facing name, e.g. `Guinhawa Gate — Campus 2 Annex` |
| `number` | no | signboard text riders look for (`BACO`, `C1`); not always numeric |
| `operator` | no | `jeepney` (default), `bus`, or `tricycle` |
| `description` | yes | one or two sentences; shown in the route panel and modal |
| `directionNote` | no | how to read stop order for loops/two terminals |
| `color` | yes | `#rrggbb`; used for the map line, chips, and stop markers |
| `fare` | yes | flat fare `{ "regular": PHP, "discounted": PHP }`; discounted = student/senior/PWD |
| `stops` | yes | ordered array, minimum 2 |

Each stop:

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | e.g. `Guinhawa Gate`, `COE Building 2` |
| `description` | yes | what the stop serves; shown in the stop panel |
| `lat` / `lon` | yes | WGS84; anchor to existing campus pins (gates, terminals, landmark buildings) rather than guessing road positions |
| `sortOrder` | no | defaults to array order |
| `fare` | no | per-segment fare `{ "regular", "discounted" }` = cost from the **previous** stop to this one; omit to use the route's flat fare. Not allowed on the first stop |

## Conventions

- Stops should snap to places already on the map (gates, terminals, college
  buildings) so routes read as campus coverage, not floating lines.
- Keep `description` factual: what the stop serves and any transfer note.
  No marketing copy.
- Fares are approximate until the LTFRB/operator matrix confirms them; say so
  in `description` when unsure.
- `bun run lint` and `bun test scripts/lib` validate the file format; the
  seed script validates again before touching the DB.
