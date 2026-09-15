/**
 * Single source of truth for campus-specific config.
 *
 * BulSU Malolos fork (Campus 1 + Campus 2). Multi-campus exploration is
 * deferred — see docs/multi-campus-handoff.md on docs/multi-campus-exploration.
 *
 * Values are plain literals so astro.config.mjs can import this module at
 * config-eval time (no process.env reads at module top level).
 */

export const campusSite = {
  url: "https://room-tba.bulsu.tools",
  name: "Room TBA",
  /** Short place phrase for titles ("Building at BulSU Malolos"). */
  placeLabel: "BulSU Malolos",
  title: "Room TBA | Find rooms and buildings at BulSU Malolos",
  description:
    "Room TBA helps Bulacan State University students find rooms, buildings, and colleges on the Malolos Campus 1 and Campus 2 map.",
  /** Open Graph title without the site name prefix. */
  ogTitle: "Find rooms and buildings at BulSU Malolos",
} as const;

export const campusMap: {
  maxBounds: [[number, number], [number, number]];
  defaultCamera: {
    center: [number, number];
    zoom: number;
    pitch: number;
    bearing: number;
  };
} = {
  /** [lng, lat] — covers Guinhawa Campus 1 + Campus 2 annex (former PIA lot). */
  maxBounds: [
    [120.805, 14.848],
    [120.828, 14.868],
  ],
  /** Default camera on Campus 1 academic core. */
  defaultCamera: {
    center: [120.8141, 14.8578],
    zoom: 16.2,
    pitch: 45,
    bearing: 0,
  },
};

export const campusTerrain: {
  enabled: boolean;
  demTilesUrl: string;
  maxBounds: [[number, number], [number, number]];
  camera: {
    center: [number, number];
    zoom: number;
    pitch: number;
    bearing: number;
  };
} = {
  /** 3D terrain (raster-dem + hillshade). false = flat map, no terrain controls. */
  enabled: true,
  /** TileJSON for the elevation source; __MAPTILER_KEY__ is replaced with PUBLIC_MAPTILER_KEY at runtime. */
  demTilesUrl:
    "https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=__MAPTILER_KEY__",
  /** [lng, lat] corners the terrain view may cover (Mount Makiling and surroundings). */
  maxBounds: [
    [121.168, 14.095],
    [121.34, 14.22],
  ],
  /** Camera the map flies to when terrain mode turns on. */
  camera: { center: [121.218, 14.142], zoom: 13.25, pitch: 68, bearing: 190 },
};

export const campusTransit: {
  enabled: boolean;
  label: string;
  routeDataModule: string;
} = {
  /** Campus transit overlay: map layer, sidebar browse tab, /transit/ links, sitemap entries. */
  enabled: true,
  /** Menu / browse-tab label; title case and singular copy are derived from it. */
  label: "Jeepney routes",
  /** Bundled route/stop data a fork replaces (runtime rows come from the transit tables). */
  routeDataModule: "src/constants/jeepney-routes.ts",
};

/** Reference points inside campus bounds for the E2E suite (seeded by scripts/e2e-reset-db.ts). */
export const campusTestFixtures = {
  buildingLat: 14.1655,
  buildingLon: 121.2412,
  dormLat: 14.166,
  dormLon: 121.242,
} as const;

export const campusCommunity = {
  orgLabel: "bulsutools",
  orgUrl: "https://github.com/bulsutools",
  /** owner/repo for GitHub API (contributors, stars). */
  githubRepo: "bulsutools/room-tba",
  githubUrl: "https://github.com/bulsutools/room-tba",
  /** No Discord yet — point at the repo until a server exists. */
  discordUrl: "https://github.com/bulsutools/room-tba",
  facebookUrl: "https://facebook.com/bulsutools",
  instagramUrl: "https://instagram.com/bulsutools",
  osaOrganizationsUrl: "https://www.bulsu.edu.ph/",
  messengerContributeTarget:
    "https://github.com/bulsutools/room-tba/issues/new/choose",
  messengerMaintainTarget:
    "https://github.com/bulsutools/room-tba/issues/new/choose",
  messengerShortContributeUrl: "",
  messengerShortMaintainUrl: "",
} as const;

/** Feature flags for this fork (Makiling terrain/trail off; jeepney UI kept empty). */
export const campusFeatures = {
  terrain: false,
  trail: false,
  jeepney: true,
} as const;

export const campusSplashMessages = [
  "Finding where you need to be",
  "Crossing to Campus 2 for COE Building 2",
  "Asking which hall is Federizo again",
  "Looking for Mendoza Hall by CCJE",
  "Checking if Valencia is open for orientation",
  "Walking past Alvarado for CIT",
  "Saving you a seat at the e-library",
  "Herding classrooms into place",
] as const;
