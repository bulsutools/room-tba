# Campus profile spike: gist vs R2 vs in-repo JSON

Issue: #2. Question: can a campus fork publish its rebrand surface as one
JSON profile outside the app tree, instead of editing `src/campus.config.ts`
plus seed files by hand? Short answer: yes for values, no for strings baked
into pages. Pick below.

## What the profile would cover

`src/campus.config.ts` is already the single source of truth for rebrandable
values: `campusSite`, `campusMap`, `campusTerrain`, `campusTransit`,
`campusTestFixtures`, `campusCommunity`, `campusFeatures`,
`campusSplashMessages`. `/fork` wizard and `bun run fork:init` generate that
file from `src/lib/fork/campus-config-template.ts`. A profile JSON is the
same object graph serialized. Optional `seed.url` points at a dataset JSON
(colleges, buildings, places) in the `data/sample-campus/campus.json` shape,
consumed by `seed:sample`.

## Options

| Option | Hosting | Update without deploy | Integrity | Verdict |
| --- | --- | --- | --- | --- |
| GitHub Gist JSON | gist.github.com | Yes (edit gist) | Weak: gists are mutable, anonymous API rate limits, revision pinning is awkward | Reject |
| R2 / static object URL | R2 bucket or any static host, e.g. `https://<campus>.example.com/campus.profile.json` | Yes (overwrite object) | Medium: pin `version` field or content hash at fetch time | **Default** |
| In-repo `campus.profile.json` | Checked into the fork | No, needs a commit | Strong: reviewed in git, covered by `fork:check` | Fallback |

Runtime fetch (client-side at boot) is out for now: `bun run build`
prerenders ~650 entity pages and needs every config value at build time.
Fetch once at build, bake the result. Keep `campus.config.ts` as the
checked-in fallback when the fetch fails or `PROFILE_URL` is unset, so a
fork can still build offline.

**Default: static URL (R2 or equivalent), fetched at build time, baked into
the bundle, `campus.config.ts` remains the fallback.** R2 is already in the
stack for uploads (`R2_PUBLIC_URL` in `astro.config.mjs`,
`src/lib/r2-upload.ts`), so a public-read object costs nothing new. Gist
loses on mutability and rate limits; in-repo JSON is the fallback path, not
the primary one, because the point of the spike is onboarding a fork without
a code edit per rebrand.

## Schema sketch

One JSON document mirroring the config exports. Field names match
`campus.config.ts` so the loader is a rename, not a transform:

```jsonc
{
  "version": 1,                    // bump on breaking shape changes
  "site": {
    "url": "https://room-tba.example.edu",
    "name": "Room TBA",
    "placeLabel": "Example State University",
    "title": "Room TBA | Find rooms and buildings at Example State University",
    "description": "...",
    "ogTitle": "Find rooms and buildings at Example State University"
  },
  "map": {
    "maxBounds": [[lng, lat], [lng, lat]],
    "defaultCamera": { "center": [lng, lat], "zoom": 0, "pitch": 0, "bearing": 0 }
  },
  "terrain": {
    "enabled": false,
    "demTilesUrl": "https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=__MAPTILER_KEY__",
    "maxBounds": [[lng, lat], [lng, lat]],
    "camera": { "center": [lng, lat], "zoom": 0, "pitch": 0, "bearing": 0 }
  },
  "transit": {
    "enabled": false,
    "label": "Shuttle routes",
    "routeDataModule": "src/constants/jeepney-routes.ts"
  },
  "community": {
    "orgLabel": "", "orgUrl": "", "githubRepo": "",
    "githubUrl": "", "discordUrl": "", "facebookUrl": "",
    "instagramUrl": "", "osaOrganizationsUrl": "",
    "messengerContributeTarget": "", "messengerMaintainTarget": "",
    "messengerShortContributeUrl": "", "messengerShortMaintainUrl": ""
  },
  "features": { "terrain": false, "trail": false, "jeepney": false },
  "splashLines": ["..."],
  "testFixtures": { "buildingLat": 0, "buildingLon": 0, "dormLat": 0, "dormLon": 0 },
  "seed": { "url": "https://.../campus.json" }   // optional; sample-campus shape
}
```

Trust model: the profile is public, non-secret config. Integrity is a
`version` field plus a pinned fetch at build; log the resolved URL and
version in the build output. Do not sign URLs; there is nothing to protect.
A fork that wants review-gated changes keeps the JSON in-repo instead.

## What `fork:check` still forces to stay in git

`bun run fork:check` (`scripts/fork-check.ts`) scans `git ls-files` for
UPLB markers. A remote profile does not remove any of this:

- **Strings baked into pages and copy**: wiki pages
  (`src/pages/wiki/*`), about/terms copy, OG images, `astro.config.mjs`
  `site:`. Only values routed through `campus.config.ts` move out.
- **UPLB-only assets and data**: `data/acad-orgs.json`,
  `data/uplb-directory.json`, `data/registrar/`, AMIS/SAIS importers
  (`scripts/import-amis-classes.ts`), and the UPLB-specific seed
  (`scripts/seed-bulsu-campus.ts`, `data/bulsu-seed.json`).
- **Config-owned literals the checker guards**: `src/constants/map-terrain.ts`
  must keep reading from `campusTerrain`, sidebar/browse labels from
  `campusTransit.label`, and `scripts/e2e-reset-db.ts` coordinates from
  `campusTestFixtures`. If the profile feeds those exports, the wiring stays
  in-repo and passes; hardcoding them fails the `configOwned` markers.
- **The allow-listed files themselves**: `scripts/fork-check.ts`,
  `src/pages/wiki/fork-for-your-campus.astro`, `docs/fork-data-guide.md`
  still mention UPLB on purpose.

Net: the profile replaces the *values* in `campus.config.ts`, not the
fork's copy, assets, importers, or E2E fixtures. Expect `fork:check` to
still report real hits after a profile-driven rebrand; the spike removes
the config-edit step, not the rebrand checklist.

## Relation to deferred work

Multi-campus runtime routing stays deferred (parent context #1,
`docs/multi-campus-handoff.md` on `docs/multi-campus-exploration`). This
profile is per-fork build-time config, not multi-tenancy: one deployment,
one campus, one JSON.

## Open questions carried forward

- Build-time fetch vs runtime: build-time picked; revisit only if a fork
  needs to change branding without redeploying.
- `seed.url` fetch-and-cache semantics for offline/PGlite builds.
- Whether `campusTestFixtures` should stay repo-side even when the profile
  exists (E2E determinism argues yes).
