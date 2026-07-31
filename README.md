<div align="center">

# Room TBA

**Saan sa BulSU Malolos ang \___?**

[![Live app](https://img.shields.io/badge/open-bulsu--room--tba.vercel.app-maroon?style=for-the-badge)](https://bulsu-room-tba.vercel.app)
[![MIT](https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square)](LICENSE)
[![Bun](https://img.shields.io/badge/bun-1.3+-black?style=flat-square&logo=bun)](https://bun.sh)
[![Astro](https://img.shields.io/badge/Astro-7-BC52EE?style=flat-square&logo=astro)](https://astro.build)

_Buildings, colleges, and "where is Federizo?" on the BulSU Malolos Campus 1 + Campus 2 map._

[Open the map](https://room-tba.vercel.app) · [Report wrong data](https://github.com/bulsutools/room-tba/issues/new/choose) · [Upstream Room TBA](https://github.com/uplbtools/room-tba)

</div>

---

## What this is

**Room TBA** for [Bulacan State University](https://www.bulsu.edu.ph/) (Malolos **Campus 1** Guinhawa + **Campus 2** annex). Fork of [uplbtools/room-tba](https://github.com/uplbtools/room-tba). Search a building or college; the map flies to an approximate pin you can correct in the editor.

No account needed to browse. Editors fix pins in the same app (`/?editor=login`).

> **Data note:** Seed file keeps **colleges only**. Building/place pins start empty — add them in the map editor. Room schedules need a registrar importer later (AMIS/UPLB scripts do not apply). Wrong data? [Open an issue](https://github.com/bulsutools/room-tba/issues/new/choose).

---

## What you can do

| Goal | How |
| ----------------------------- | ---------------------------------------------------------------- |
| Find **Federizo**, **COE Building 2**, **Mendoza** | Search + map pins |
| Building location | Map, pins, directions, Google Maps |
| Landmarks (gates, under-construction hospital) | Places directory + map pins |
| Jeepney / campus transit | UI ready; routes empty until contributors add Malolos data |
| Offline / bad signal | PWA + local cache; tiles if already loaded |
| Suggest edits | **Suggest an edit** → review queue (when configured) |

<details>
<summary><strong>Editor / contributor mode</strong> (password from the team)</summary>

| Power | Where |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Move building pins | Map edit mode (pencil) |
| Add landmarks / services | **Add something to the map** or side-panel editor |
| Fix building/college copy | Side panel → Edit |
| Add jeepney routes | `src/constants/jeepney-routes.ts` + DB seed, or editor when wired |

Login: **`/?editor=login`**. First login with `ADMIN_PASSWORD` bootstraps user `admin`.

</details>

---

## Stack

- [Astro 7](https://astro.build) + [Svelte 5](https://svelte.dev)
- [Bun](https://bun.sh)
- [Neon](https://neon.tech) Postgres (free tier) + [Drizzle](https://orm.drizzle.team) (`drizzle/`) via `DATABASE_URL`
- [PGlite](https://pglite.dev) in the browser for offline data
- [MapLibre GL](https://maplibre.org), OSM / MapTiler tiles
- [Vercel](https://vercel.com) Hobby for SSR and API routes

Campus branding + map center: [`src/campus.config.ts`](src/campus.config.ts)

---

## Run it locally

### You need

- [Bun](https://bun.sh) 1.3+
- A **Neon** (or any Postgres) URL in `DATABASE_URL`
- `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET` for editor login
- `PUBLIC_MAPTILER_KEY` for vector/3D tiles (optional locally; flat raster fallback without it)
- `ISR_BYPASS_TOKEN` on Vercel for on-demand revalidation after editor publishes

### Setup

```sh
git clone https://github.com/bulsutools/room-tba.git
cd room-tba
cp .env.example .env.local
# Fill DATABASE_URL (Neon), ADMIN_PASSWORD, ADMIN_SESSION_SECRET, PUBLIC_MAPTILER_KEY

bun install
bun run setup:bulsu   # schema push if needed + seed colleges (pins empty)
bunx astro dev --port 4331
```

Open **http://localhost:4331**. Map should center near Guinhawa Campus 1 (`campus.config.ts`). Without `DATABASE_URL`, pages that hit the DB will 500.

Re-seed only (idempotent by name): `bun run seed:bulsu`  
Dry-run: `bun run seed:bulsu -- --dry-run`

### Contrib surfaces (open for volunteers)

| Surface | Where |
| --- | --- |
| Building / place pins | Map editor (seed file leaves these empty on purpose) |
| Jeepney routes | `src/constants/jeepney-routes.ts` (empty today) |
| College / building copy | Side panel editor |
| Photos | Event/image upload when R2 is configured |
| Class schedules | Future registrar importer (not AMIS) |

### Commands worth knowing

| Command | Does what |
| --- | --- |
| `bun run setup:bulsu` | First-run: env check, schema push if needed, seed |
| `bun run seed:bulsu` | Upsert from `data/bulsu-seed.json` (colleges today; buildings/places when filled) |
| `bunx astro dev --port 4331` | Dev server (4321 often taken by other projects) |
| `bun run build` | Production build (**needs** `DATABASE_URL`) |
| `bun test src/lib src/constants` | Unit tests |
| `bun run test:components` | Vitest component tests |
| `bun run lint` | Biome check |
| `bunx drizzle-kit push` | Apply schema to empty Neon DB |
| `bunx drizzle-kit studio` | Browse Postgres |

Optional env vars: [`.env.example`](.env.example). Set `PUBLIC_APP_ENV=staging` locally and on Vercel Preview.

---

## Repo map

```
room-tba/
  src/campus.config.ts     BulSU site + map bounds
  data/bulsu-seed.json     Colleges (+ empty buildings/places)
  scripts/seed-bulsu-campus.ts
  scripts/first-run-bulsu.ts
  drizzle/                 schema + migrations
  src/pages/               routes + /api
  src/components/          Svelte UI
```

Multi-campus / multi-tenant exploration (deferred): [docs/multi-campus-handoff.md](docs/multi-campus-handoff.md) on branch `docs/multi-campus-exploration`.

---

## Credits

Fork of [uplbtools/room-tba](https://github.com/uplbtools/room-tba) by [Simonee Ezekiel Mariquit](https://stimmie.dev) and contributors.

This fork: [bulsutools](https://github.com/bulsutools) — campus tool, not an official BulSU product.

Upstream license: [MIT](LICENSE).
