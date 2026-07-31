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
  url: "https://bulsu-room-tba.vercel.app",
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

export const campusCommunity = {
  orgLabel: "bulsutools",
  orgUrl: "https://github.com/bulsutools",
  /** owner/repo for GitHub API (contributors, stars). */
  githubRepo: "bulsutools/room-tba",
  githubUrl: "https://github.com/bulsutools/room-tba",
  /** No Discord yet — point at the repo until a server exists. */
  discordUrl: "https://github.com/bulsutools/room-tba",
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
