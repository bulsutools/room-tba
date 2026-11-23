/**
 * Validation for the BulSU transit dataset (`data/transit/routes.json`).
 *
 * The file is the repo-side source contributors edit via PR (#7 field
 * collection); `scripts/seed-bulsu-transit.ts` turns a valid file into
 * jeepney_routes / jeepney_stops rows. Nothing here invents data — an empty
 * array is a valid dataset and seeds nothing.
 */

import type {
  JeepneyFare,
  JeepneyRoute,
  JeepneyStop,
  TransitOperator,
} from "@constants/jeepney-routes";

const OPERATORS: readonly TransitOperator[] = ["jeepney", "bus", "tricycle"];
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

type JsonStop = {
  name?: unknown;
  description?: unknown;
  lat?: unknown;
  lon?: unknown;
  sortOrder?: unknown;
  fare?: unknown;
};

type JsonRoute = {
  id?: unknown;
  name?: unknown;
  number?: unknown;
  operator?: unknown;
  description?: unknown;
  directionNote?: unknown;
  color?: unknown;
  fare?: unknown;
  stops?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFare(
  value: unknown,
  path: string,
  errors: string[],
): JeepneyFare | null {
  const before = errors.length;
  if (!isRecord(value)) {
    errors.push(`${path}: fare must be an object with regular and discounted`);
    return null;
  }
  const regular = Number(value["regular"]);
  const discounted = Number(value["discounted"]);
  if (!Number.isFinite(regular) || regular <= 0) {
    errors.push(`${path}.fare.regular: must be a positive number`);
  }
  if (!Number.isFinite(discounted) || discounted <= 0) {
    errors.push(`${path}.fare.discounted: must be a positive number`);
  }
  if (
    Number.isFinite(regular) &&
    Number.isFinite(discounted) &&
    discounted > regular
  ) {
    errors.push(`${path}.fare.discounted: cannot exceed regular`);
  }
  if (errors.length > before) return null;
  return { regular, discounted };
}

function parseStop(
  value: unknown,
  path: string,
  index: number,
  errors: string[],
): JeepneyStop | null {
  if (!isRecord(value)) {
    errors.push(`${path}: stop must be an object`);
    return null;
  }
  const before = errors.length;
  const stop = value as JsonStop;
  const name = typeof stop.name === "string" ? stop.name.trim() : "";
  if (!name) errors.push(`${path}.name: required`);
  const description =
    typeof stop.description === "string" ? stop.description.trim() : "";
  if (!description) errors.push(`${path}.description: required`);
  const lat = Number(stop.lat);
  const lon = Number(stop.lon);
  // Philippines bounding box, loose on purpose: catches swapped lat/lon and
  // typos without pinning the dataset to one campus's bounds.
  if (!Number.isFinite(lat) || lat < 4 || lat > 25) {
    errors.push(`${path}.lat: must be a Philippine latitude`);
  }
  if (!Number.isFinite(lon) || lon < 110 || lon > 130) {
    errors.push(`${path}.lon: must be a Philippine longitude`);
  }
  if (index === 0 && stop.fare !== undefined) {
    errors.push(
      `${path}.fare: the first stop has no previous segment; remove it`,
    );
  }
  const fare =
    stop.fare === undefined
      ? undefined
      : (parseFare(stop.fare, path, errors) ?? undefined);
  if (errors.length > before) return null;
  const parsed: JeepneyStop = { name, description, lat, lon };
  if (typeof stop.sortOrder === "number" && Number.isInteger(stop.sortOrder)) {
    parsed.sortOrder = stop.sortOrder;
  }
  if (fare) parsed.fare = fare;
  return parsed;
}

function parseRoute(
  value: unknown,
  path: string,
  errors: string[],
): JeepneyRoute | null {
  if (!isRecord(value)) {
    errors.push(`${path}: route must be an object`);
    return null;
  }
  const route = value as JsonRoute;
  const before = errors.length;
  const id = typeof route.id === "string" ? route.id.trim() : "";
  if (!ID_PATTERN.test(id)) {
    errors.push(`${path}.id: must be lowercase kebab-case`);
  }
  const name = typeof route.name === "string" ? route.name.trim() : "";
  if (!name) errors.push(`${path}.name: required`);
  const description =
    typeof route.description === "string" ? route.description.trim() : "";
  if (!description) errors.push(`${path}.description: required`);
  const color = typeof route.color === "string" ? route.color : "";
  if (!COLOR_PATTERN.test(color)) {
    errors.push(`${path}.color: must be a #rrggbb hex color`);
  }
  let operator: TransitOperator | undefined;
  if (route.operator !== undefined) {
    if (
      typeof route.operator === "string" &&
      (OPERATORS as readonly string[]).includes(route.operator)
    ) {
      operator = route.operator as TransitOperator;
    } else {
      errors.push(`${path}.operator: must be one of ${OPERATORS.join(", ")}`);
    }
  }
  const fare = parseFare(route.fare, path, errors);
  const stops: JeepneyStop[] = [];
  if (!Array.isArray(route.stops) || route.stops.length < 2) {
    errors.push(`${path}.stops: at least two stops required`);
  } else {
    route.stops.forEach((stop, index) => {
      const parsed = parseStop(stop, `${path}.stops[${index}]`, index, errors);
      if (parsed) stops.push(parsed);
    });
  }
  if (errors.length > before) return null;
  const parsed: JeepneyRoute = {
    id,
    name,
    description,
    color,
    fare: fare as JeepneyFare,
    stops,
  };
  if (typeof route.number === "string" && route.number.trim()) {
    parsed.number = route.number.trim();
  }
  if (operator) parsed.operator = operator;
  if (typeof route.directionNote === "string" && route.directionNote.trim()) {
    parsed.directionNote = route.directionNote.trim();
  }
  return parsed;
}

/**
 * Parse `data/transit/routes.json`. Returns every problem found rather than
 * throwing on the first, so a contributor sees the whole fix list at once.
 */
export function parseTransitDataset(
  json: unknown,
): { ok: true; routes: JeepneyRoute[] } | { ok: false; errors: string[] } {
  if (!Array.isArray(json)) {
    return { ok: false, errors: ["dataset must be a JSON array of routes"] };
  }
  const errors: string[] = [];
  const routes: JeepneyRoute[] = [];
  const seen = new Set<string>();
  json.forEach((entry, index) => {
    const parsed = parseRoute(entry, `routes[${index}]`, errors);
    if (!parsed) return;
    if (seen.has(parsed.id)) {
      errors.push(`routes[${index}].id: duplicate "${parsed.id}"`);
      return;
    }
    seen.add(parsed.id);
    routes.push(parsed);
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, routes };
}
