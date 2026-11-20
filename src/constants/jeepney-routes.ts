// src/constants/jeepney-routes.ts

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
  /** How to read the stop order, e.g. Kaliwa vs Kanan running the loop in
   * opposite directions. Shown prominently in the route modal. */
  directionNote?: string;
  color: string;
  fare: JeepneyFare;
  stops: JeepneyStop[];
};

/**
 * The day the maintainer last confirmed fares. Only prices confirmed then
 * are quoted; everything else says so instead of guessing.
 */
export const FARES_VERIFIED_ON = "October 7, 2026";
export const FARES_VERIFIED_NOTE = `Prices verified as of ${FARES_VERIFIED_ON}.`;

/** Campus jeepney fares are set campus-wide, not per route. */
export const JEEPNEY_FARE_NOTE = `${FARES_VERIFIED_NOTE} Pay the driver as you ride.`;

/**
 * Town jeeps charge by distance: the minimum fare, plus a per-kilometre
 * amount from the LTFRB fare matrix.
 */
export const TOWN_JEEPNEY_MINIMUM_FARE: JeepneyFare = {
  regular: 14,
  discounted: 12,
};

/** Whole-route fares the maintainer has confirmed, by route id. */
export const VERIFIED_END_TO_END_FARES: Readonly<Record<string, JeepneyFare>> =
  {
    "lb-to-calamba": { regular: 30, discounted: 25 },
  };

const STANDARD_CAMPUS_FARE: JeepneyFare = { regular: 14, discounted: 12 };

/** Routes sold as advance tickets instead of cash on board. */
export type RouteTicketing = {
  operator: string;
  url: string;
  /** Seat price in PHP, as the operator's booking site listed it. */
  price?: number;
  priceCheckedOn?: string;
};

const DLTB_TICKETING: RouteTicketing = {
  operator: "DLTB",
  url: "https://dltb.ph/",
  price: 197,
  priceCheckedOn: "November 16, 2026",
};

/**
 * The UPLB <-> UP Diliman and UPLB -> Buendia buses are booked on DLTB's website, which also has the
 * current fare, so the app links there instead of quoting a price.
 */
const ROUTE_TICKETING: Readonly<Record<string, RouteTicketing>> = {
  "uplb-to-upd": DLTB_TICKETING,
  "upd-to-uplb": DLTB_TICKETING,
  "uplb-to-buendia": DLTB_TICKETING,
};

/**
 * Where to board, for routes that only pass Los Baños. Shown above the stop
 * list; kept in code so it does not wait on a database edit.
 */
const JUNCTION_BOARDING_NOTE =
  "It comes from Calamba and doesn't enter the UPLB campus. Board at the Junction on the national highway by Olivarez Plaza. From campus, ride a Kaliwa or Kanan jeep there first.";

export const ROUTE_BOARDING_NOTES: Readonly<Record<string, string>> = {
  "lb-to-san-pablo": JUNCTION_BOARDING_NOTE,
  "lb-to-sta-cruz": JUNCTION_BOARDING_NOTE,
  forestry:
    "Board at a terminal. Forestry jeeps fill up at their first stop and rarely have room further along. Going up, board at the Forestry Jeep Terminal near Big Belly's. Going down, board at the Upper Forestry Jeep Terminal.",
  "lb-to-calamba": "Board at Olivarez Plaza Mall.",
  "lb-to-buendia":
    "This isn't the DLTB bus. Wait for it at the bus stop by Olivarez Plaza Mall. You don't need to book.",
};

/** The codes on the stop signs around campus, forward direction first. */
export const ROUTE_LINE_CODES: Readonly<Record<string, readonly string[]>> = {
  "kaliwa-kanan": ["KN", "KL"],
  forestry: ["FR"],
  snodlob: ["LOOP"],
  "up-rural": ["RURAL"],
};

/** What the windshield signboard says, one entry per line of the board. */
export const ROUTE_SIGNBOARDS: Readonly<Record<string, readonly string[]>> = {
  "lb-to-calamba": ["Crossing", "SM Calamba"],
  "lb-to-san-pablo": ["San Pablo"],
  "lb-to-sta-cruz": ["Sta. Cruz"],
  "uplb-to-upd": ["UP Diliman"],
  "uplb-to-buendia": ["Buendia"],
  "lb-to-buendia": ["Buendia"],
};

/** Signboards that say where a jeep on this route ends its trip. */
export const ROUTE_END_BOARDS: Readonly<
  Record<string, readonly { board: string; ends: string }[]>
> = {
  "kaliwa-kanan": [
    { board: "Olivarez", ends: "Goes on to Olivarez Plaza Mall." },
    { board: "Junction", ends: "Ends at Jollibee at the end of Lopez Ave." },
    { board: "Bayan", ends: "Ends at the Los Baños Municipal Hall." },
  ],
};

/** The same advice, short enough for a route card on the printable map. */
export const ROUTE_PRINT_NOTES: Readonly<Record<string, string>> = {
  forestry:
    "Sumakay sa Forestry Jeep Terminal malapit sa Big Belly's pag paakyat, at sa Upper Forestry Jeep Terminal pag pababa. Para pumara ng jeep paakyat, ituro ang hintuturo pataas.",
  "kaliwa-kanan":
    "Kumakaliwa sa gate ang Kaliwa at kumakanan ang Kanan. Hanggang Olivarez Plaza Mall ang OLIVAREZ, Jollibee sa Lopez Ave ang JUNCTION, at Municipal Hall ang BAYAN. Hindi pumapasok sa campus ang UP GATE. Sa Freedom Park, tanungin ang driver kung sa SU o sa dorms dadaan.",
};

/** Forestry's two trips; also written to the database by scripts/fix-transit-data.ts. */
export const FORESTRY_DIRECTION_NOTE =
  "Uphill trips start at the Forestry Jeep Terminal and serve the stops as listed. Past New FOREHA the jeep loops down Makiling Road, east along Valentin Sajor and back up Felix O. Chinte Sr. through MAREHA and FOREHA. Downhill trips start at the Upper Forestry Jeep Terminal and run back down to the Forestry Jeep Terminal, serving the same stops in reverse. Going down, the jeep stays on Makiling Road instead of turning at the Admin Building.";

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
 * the bundled route objects and carry no schedule column. Sources: DLTB's
 * booking site (dltb.ph, read 2026-11-16) for the UPLB trips, and the
 * maintainer (2026-10-07) for the Buendia return.
 */
export const ROUTE_SCHEDULES: Readonly<Record<string, RouteSchedule>> = {
  "uplb-to-buendia": {
    days: "Monday to Saturday",
    departures: ["5:30 AM"],
  },
  "buendia-to-uplb": {
    days: "Daily",
    departures: ["6:00 PM"],
    note: "More trips may be added when demand is high.",
  },
  "uplb-to-upd": {
    days: "Monday to Saturday",
    departures: ["5:00 AM", "1:00 PM", "6:00 PM"],
  },
  "upd-to-uplb": {
    days: "Monday to Saturday",
    departures: ["5:00 AM", "9:00 AM", "6:00 PM"],
  },
  "buendia-to-lb": {
    days: "Daily",
    hours: { first: "about 4:00 AM", last: "about 10:00 PM" },
    note: "Plus a midnight trip.",
  },
};

export function routeSchedule(routeId: string): RouteSchedule | null {
  return ROUTE_SCHEDULES[routeId] ?? null;
}

/** One way a two-way route runs; `reverse` serves the stops backwards. */
export type RouteDirection = { label: string; summary: string };

/**
 * Routes that run the same stops both ways, named the way riders say them.
 * Kaliwa/Kanan is one loop driven in opposite directions; UP Rural returns
 * along the same road (see each route's direction note).
 */
export const ROUTE_DIRECTIONS: Readonly<
  Record<string, { forward: RouteDirection; reverse: RouteDirection }>
> = {
  "kaliwa-kanan": {
    forward: {
      label: "Kanan",
      summary:
        "It turns right after the gate and serves Carabao Park / DevCom first.",
    },
    reverse: {
      label: "Kaliwa",
      summary:
        "It turns left after the gate and serves Carabao Park / Landbank first.",
    },
  },
  "up-rural": {
    forward: {
      label: "To Jubileeville",
      summary: "Outbound from campus, ending at Jubileeville.",
    },
    reverse: {
      label: "To campus",
      summary: "Back from Jubileeville along the same road.",
    },
  },
};

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

/**
 * DLTB's UPLB <-> LRT Buendia trips. The outbound trip is from dltb.ph
 * (2026-11-16); the return is from the maintainer (2026-10-07). Bundled so
 * they show before anyone adds them to the database; database rows win.
 */
const DLTB_BUENDIA_NOTE =
  "It runs Monday to Saturday and leaves Carabao Park at 5:30 AM. Book a seat on dltb.ph. After Buendia it goes on to Magallanes and Pasay Road. The trip takes about 1.5 to 2 hours.";
const DLTB_BUENDIA_RETURN_NOTE =
  "It leaves the Buendia terminal at 6:00 PM and takes about 1.5 to 2 hours.";

const CPARK_STOP = {
  name: "Carabao Park (CPark), UPLB main gate",
  description:
    "DLTB's UPLB loading point at Carabao Park by the main gate, across from the College of Development Communication.",
  lat: 14.16716,
  lon: 121.24288,
};

export const BUNDLED_BUS_ROUTES: JeepneyRoute[] = [];

/**
 * Rider tips transcribed from the UPLB Public Transit System Map (2024) by
 * Bernardo "Berniemack" Muerong Arellano III, shown in the route modal with
 * credit. Facts only; the map artwork itself is CC BY-NC-SA and is not reused.
 */
/** Tips for jeeps leaving Los Baños town (not campus-specific). */
export const TOWN_JEEPNEY_RIDING_NOTES: string[] = [
  "Board at Olivarez Plaza (College Junction). The outbound signboards are BAYAN (town proper), SM CROSSING, CROSSING CALAMBA, SAKAY/LALAKAY.",
  "Tell the driver where you're getting off, since stops along the highway aren't marked.",
];

export const JEEPNEY_RIDING_NOTES: string[] = [
  "Jeepneys from Calamba Crossing carry a UP COLLEGE or COLLEGE signboard. Near campus they may become Kaliwa, Kanan, Forestry, or UP Gate routes. Check the windshield signboard or ask the driver.",
  "A UP GATE signboard means the jeep stops at Grove and doesn't enter campus.",
  "Hailing a jeep bound for Forestry or Upper Campus? Point your index finger upwards.",
  "The outbound signboards are BAYAN (town proper), OLIVAREZ (Olivarez Plaza Mall), JUNCTION (Lopez Ave), SM CROSSING, CROSSING CALAMBA, SAKAY/LALAKAY.",
  "Board and get off only at the designated stops, marked in yellow.",
];

export const TRANSIT_DATA_CREDIT =
  'Route data cross-checked with the UPLB Public Transit System Map (2024) by Bernardo "Berniemack" Muerong Arellano III.';
