import { describe, expect, test } from "bun:test";
import type { JeepneyRoute, JeepneyStop } from "@constants/jeepney-routes";
import {
  activeDirection,
  orientRoute,
  reverseLine,
  routesAtStop,
} from "./transit-direction";

const stop = (name: string, lat: number, lon: number): JeepneyStop => ({
  name,
  description: `${name} stop.`,
  lat,
  lon,
});

const route = (id: string, stops: JeepneyStop[]): JeepneyRoute => ({
  id,
  name: id,
  description: "Test route.",
  color: "#000000",
  fare: { regular: 15, discounted: 12 },
  stops,
});

// BulSU ships no bundled routes, so these tests use synthetic routes. Real
// direction labels still come from ROUTE_DIRECTIONS, keyed by upstream route
// ids ("kaliwa-kanan" is two-way, "forestry" is one-way).
describe("orientRoute", () => {
  test("a two-way route serves its stops in reverse", () => {
    const kaliwaKanan = route("kaliwa-kanan", [
      stop("First", 14.1, 121.2),
      stop("Middle", 14.2, 121.3),
      stop("Last", 14.3, 121.4),
    ]);
    const kaliwa = orientRoute(kaliwaKanan, true);
    expect(kaliwa.id).toBe("kaliwa-kanan");
    expect(kaliwa.stops.map((s) => s.name)).toEqual([
      "Last",
      "Middle",
      "First",
    ]);
    expect(kaliwaKanan.stops[0]!.name).toBe("First");
  });

  test("one-way routes keep their only real order", () => {
    const forestry = route("forestry", [
      stop("A", 14.1, 121.2),
      stop("B", 14.2, 121.3),
    ]);
    expect(orientRoute(forestry, true)).toBe(forestry);
  });

  test("labels the shown direction", () => {
    expect(activeDirection("kaliwa-kanan", false)?.label).toBe("Kanan");
    expect(activeDirection("kaliwa-kanan", true)?.label).toBe("Kaliwa");
    expect(activeDirection("forestry", true)).toBeNull();
  });
});

describe("reverseLine", () => {
  test("flips the drawn line so the arrows follow the direction", () => {
    expect(
      reverseLine({
        type: "LineString",
        coordinates: [
          [1, 2],
          [3, 4],
        ],
      })?.coordinates,
    ).toEqual([
      [3, 4],
      [1, 2],
    ]);
    expect(reverseLine(null)).toBeNull();
  });
});

describe("routesAtStop", () => {
  const shared = stop("Shared stop", 14.2, 121.3);
  const kaliwaKanan = route("kaliwa-kanan", [
    stop("Olivarez", 14.1, 121.2),
    shared,
    stop("Terminal", 14.3, 121.4),
  ]);
  const loop = route("campus-loop", [
    stop("Loop terminal", 14.5, 121.5),
    stop("Loop middle", 14.6, 121.6),
    stop("Loop terminal", 14.5, 121.5),
  ]);
  const outbound = route("outbound", [
    stop("Origin", 14.7, 121.7),
    stop("Destination", 14.8, 121.8),
  ]);

  test("finds every route serving a stop by position, not name", () => {
    const nearShared = stop("Same kerb, other name", 14.2, 121.3);
    const serving = routesAtStop([kaliwaKanan, loop, outbound], nearShared);
    const ids = serving.map((entry) => entry.route.id);
    expect(ids).toEqual(["kaliwa-kanan"]);
    expect(serving[0]!.direction).toBe("Kanan / Kaliwa");
  });

  test("a loop terminal resolves to stop 1, not the closing stop", () => {
    const terminal = stop("Loop terminal", 14.5, 121.5);
    const entry = routesAtStop([loop], terminal)[0]!;
    expect(entry.stopIndex).toBe(0);
    expect(entry.direction).toBe("One-way loop");
  });

  test("one-way routes say where they are heading", () => {
    const origin = stop("Origin", 14.7, 121.7);
    const serving = routesAtStop([outbound], origin);
    expect(serving[0]!.direction).toBe("Toward Destination");
    const destination = stop("Destination", 14.8, 121.8);
    expect(routesAtStop([outbound], destination)[0]!.direction).toBe(
      "Last stop",
    );
  });
});
