// src/constants/jeepney-routes.ts

import type { LineString } from "geojson";

/** Vehicle class running a route; absent rows predate the column and mean jeepney. */
export type TransitOperator = "jeepney" | "bus" | "tricycle";

export const TRANSIT_OPERATOR_LABELS: Record<TransitOperator, string> = {
  jeepney: "Jeepney",
  bus: "Bus",
  tricycle: "Tricycle",
};

/** Display label for a route's operator; defaults to jeepney for legacy rows. */
export function transitOperatorLabel(
  operator: TransitOperator | undefined,
): string {
  return TRANSIT_OPERATOR_LABELS[operator ?? "jeepney"];
}

export type JeepneyStop = {
  /** Database id; absent only in the bundled offline fallback. */
  id?: number;
  name: string;
  description: string;
  lat: number;
  lon: number;
  sortOrder?: number;
  version?: number;
  updatedAt?: string;
  /**
   * Optional per-segment fare: what it costs to ride from the previous stop
   * to this one. Only meaningful on stops after the first; when absent the
   * route's flat `fare` applies.
   */
  fare?: JeepneyFare;
};

export type JeepneyFare = {
  /** Cash fare in PHP. */
  regular: number;
  /** Student / senior / PWD fare in PHP. */
  discounted: number;
};

export type JeepneyRoute = {
  id: string;
  name: string;
  /** Operator-side route number/signboard text (e.g. "BACO"); not always numeric. */
  number?: string;
  description: string;
  /** How to read the stop order, e.g. Kaliwa vs Kanan running the loop in
   * opposite directions. Shown prominently in the route modal. */
  directionNote?: string;
  color: string;
  /** Vehicle class; absent means jeepney (pre-migration rows and old caches). */
  operator?: TransitOperator;
  fare: JeepneyFare;
  stops: JeepneyStop[];
};

/**
 * No BulSU route fares are verified yet. Quotes stay generic ("ask the
 * driver") until a maintainer confirms prices on the ground; add entries to
 * the maps below keyed by BulSU route id when that happens.
 */
export const FARES_VERIFIED_ON = "";
export const FARES_VERIFIED_NOTE =
  "Fares are not verified yet; confirm with the driver.";

/** Generic jeepney fare guidance while no BulSU fares are verified. */
export const JEEPNEY_FARE_NOTE =
  "Pay the driver as you ride; the fare is not verified yet.";

/**
 * Town jeeps charge by distance: a minimum fare plus a per-kilometre amount.
 * BulSU has no verified minimum yet, so this stays null and town routes fall
 * back to the unverified fare note.
 */
export const TOWN_JEEPNEY_MINIMUM_FARE: JeepneyFare | null = null;

/** Whole-route fares a maintainer has confirmed, by route id. Empty until
 *  BulSU fares are verified on the ground. */
export const VERIFIED_END_TO_END_FARES: Readonly<Record<string, JeepneyFare>> =
  {};

/** Routes sold as advance tickets instead of cash on board. */
export type RouteTicketing = {
  operator: string;
  url: string;
  /** Seat price in PHP, as the operator's booking site listed it. */
  price?: number;
  priceCheckedOn?: string;
};

/**
 * Routes sold as advance tickets instead of cash on board. Empty until a
 * BulSU operator's booking flow is verified.
 */
const ROUTE_TICKETING: Readonly<Record<string, RouteTicketing>> = {};

/** Where to board, shown above the stop list. Keyed by route id; kept in code
 *  so it does not wait on a database edit. Empty until BulSU routes exist. */
export const ROUTE_BOARDING_NOTES: Readonly<Record<string, string>> = {};

/** The codes on the stop signs, forward direction first. Keyed by route id. */
export const ROUTE_LINE_CODES: Readonly<Record<string, readonly string[]>> = {};

/** What the windshield signboard says, one entry per line of the board. */
export const ROUTE_SIGNBOARDS: Readonly<Record<string, readonly string[]>> = {};

/** Signboards that say where a jeep on this route ends its trip. */
export const ROUTE_END_BOARDS: Readonly<
  Record<string, readonly { board: string; ends: string }[]>
> = {};

/** The same advice, short enough for a route card on the printable map. */
export const ROUTE_PRINT_NOTES: Readonly<Record<string, string>> = {};

/**
 * When a route runs. Only what an operator or the maintainer has stated is
 * filled in; a missing field means "not published", never a guess.
 */
export type RouteSchedule = {
  /** "Daily", "Monday to Saturday". */
  days: string;
  /** Set departures from the first stop, for routes that run fixed trips. */
  departures?: readonly string[];
  /** First and last trip, for routes that run all day. */
  hours?: { first: string; last: string };
  /** Minutes between trips. No route publishes one yet. */
  headwayMinutes?: number;
  note?: string;
};

/**
 * Keyed by route id, like the boarding notes, because database rows replace
 * the bundled route objects and carry no schedule column. Empty until BulSU
 * operators publish schedules.
 */
export const ROUTE_SCHEDULES: Readonly<Record<string, RouteSchedule>> = {};

export function routeSchedule(routeId: string): RouteSchedule | null {
  return ROUTE_SCHEDULES[routeId] ?? null;
}

/** One way a two-way route runs; `reverse` serves the stops backwards. */
export type RouteDirection = { label: string; summary: string };

/**
 * Routes that run the same stops both ways, named the way riders say them.
 * Empty until BulSU routes exist.
 */
export const ROUTE_DIRECTIONS: Readonly<
  Record<string, { forward: RouteDirection; reverse: RouteDirection }>
> = {};

let activeRouteDirections: typeof ROUTE_DIRECTIONS = ROUTE_DIRECTIONS;

/** Lookup used by transit-direction (test hook below can swap it). */
export function routeDirectionEntry(
  routeId: string,
): { forward: RouteDirection; reverse: RouteDirection } | undefined {
  return activeRouteDirections[routeId];
}

/** Test hook: run direction lookups against fixture directions. */
export function setRouteDirectionsForTests(
  fixture: typeof ROUTE_DIRECTIONS | null,
) {
  activeRouteDirections = fixture ?? ROUTE_DIRECTIONS;
}

export function routeTicketing(routeId: string): RouteTicketing | null {
  return ROUTE_TICKETING[routeId] ?? null;
}

/**
 * Database routes plus any bundled route the database does not have yet (a
 * new route ships in code before anyone adds it to the database, and the
 * offline cache drops stops without database ids). Database rows win.
 */
export function withBundledRoutes(routes: JeepneyRoute[]): JeepneyRoute[] {
  const usable = new Set(
    routes.filter((r) => r.stops.length > 0).map((r) => r.id),
  );
  const missing = [...JEEPNEY_ROUTES, ...BUNDLED_BUS_ROUTES].filter(
    (r) => !usable.has(r.id),
  );
  if (missing.length === 0) return routes;
  const missingIds = new Set(missing.map((r) => r.id));
  return [...routes.filter((r) => !missingIds.has(r.id)), ...missing];
}

/** Fallback route line when no road-snapped geometry exists: a straight
 * polyline through the route's stops, in GeoJSON [lon, lat] order. */
export function deriveRouteLineFromStops(
  stops: JeepneyStop[],
): LineString | null {
  if (stops.length < 2) return null;
  return {
    type: "LineString",
    coordinates: stops.map((stop) => [stop.lon, stop.lat]),
  };
}

/**
 * Where a route's drawn line came from, worst-case last. A car-routed path
 * between two bus stops is a *plausible* road path, not necessarily the one the
 * vehicle takes, and a stops-only line is not a road path at all — so the
 * distinction is shown to the rider rather than hidden in the data.
 */
export type RouteGeometrySource = "osm-relation" | "routed" | "stops-only";

/** An entry of `src/constants/jeepney-geometries.json`. */
export type StoredRouteGeometry = {
  source: Exclude<RouteGeometrySource, "stops-only">;
  /** Which relation or routing pass produced it; for maintainers, not the UI. */
  note?: string;
  /**
   * Route-specific honesty note shown instead of the generic one, for lines
   * that are sourced yet still qualified — a reversed relation, a corridor
   * trimmed at our own end points, an alignment OSM and the operator disagree
   * on. Sourced does not always mean settled.
   */
  caveat?: string;
  geometry: LineString;
};

export type ResolvedRouteGeometry = {
  source: RouteGeometrySource;
  /** Null when a route has neither stored geometry nor two stops to join. */
  line: LineString | null;
  /** What to tell the rider, or null when nothing needs qualifying. */
  caveat: string | null;
};

/** Rider-facing caveat per source; `null` where the line is sourced, not guessed. */
export const ROUTE_GEOMETRY_NOTES: Record<RouteGeometrySource, string | null> =
  {
    "osm-relation": null,
    routed:
      "This line is road-routed between the stops, not traced from the operator's published route. Expect the real trip to differ in places.",
    "stops-only":
      "The exact path of this route isn't mapped yet. The dashed line joins the stops in order and isn't the road the vehicle takes.",
  };

/**
 * Pick the best available line for a route and say where it came from.
 * Sourced geometry wins; otherwise fall back to joining the stops, which is
 * drawn as provisional rather than passed off as a road path.
 */
export function resolveRouteGeometry(
  route: Pick<JeepneyRoute, "id" | "stops">,
  geometries: Record<string, StoredRouteGeometry | undefined>,
): ResolvedRouteGeometry {
  const stored = geometries[route.id];
  if (stored?.geometry?.coordinates?.length) {
    return {
      source: stored.source,
      line: stored.geometry,
      // A route-specific caveat replaces the generic one; it is more accurate
      // about why this particular line is qualified.
      caveat: stored.caveat ?? ROUTE_GEOMETRY_NOTES[stored.source],
    };
  }
  return {
    source: "stops-only",
    line: deriveRouteLineFromStops(route.stops),
    caveat: ROUTE_GEOMETRY_NOTES["stops-only"],
  };
}

export const JEEPNEY_ROUTES: JeepneyRoute[] = [];

export const BUNDLED_BUS_ROUTES: JeepneyRoute[] = [];

/**
 * Rider tips shown in the route modal. Empty until BulSU routes exist and a
 * maintainer verifies local riding guidance.
 */
export const TOWN_JEEPNEY_RIDING_NOTES: string[] = [];

export const JEEPNEY_RIDING_NOTES: string[] = [];

export const TRANSIT_DATA_CREDIT = "";
