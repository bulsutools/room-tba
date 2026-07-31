// src/constants/jeepney-routes.ts
// BulSU fork: keep types + UI; ship empty routes until contributors add Malolos transit.

import type { LineString } from "geojson";

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
  description: string;
  /** How to read the stop order (e.g. opposite loop directions). */
  directionNote?: string;
  color: string;
  fare: JeepneyFare;
  stops: JeepneyStop[];
};

export const STANDARD_CAMPUS_FARE: JeepneyFare = {
  regular: 15,
  discounted: 12,
};

/** Campus jeepney fares are set campus-wide, not per route. */
export const JEEPNEY_FARE_NOTE =
  "Add BulSU jeepney / campus transit data via a PR or the editor when ready.";

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
      "The exact path of this route is not mapped yet. The dashed line just joins the stops in order — it is not the road the vehicle takes.",
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

/** Empty until contributors map BulSU routes. Do not leave UPLB Kaliwa data here. */
export const JEEPNEY_ROUTES: JeepneyRoute[] = [];
