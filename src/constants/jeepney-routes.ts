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

/** Empty until contributors map BulSU routes. Do not leave UPLB Kaliwa data here. */
export const JEEPNEY_ROUTES: JeepneyRoute[] = [];
