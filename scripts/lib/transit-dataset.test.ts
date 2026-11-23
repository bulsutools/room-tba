import { describe, expect, test } from "bun:test";
import transitDataset from "../../data/transit/routes.json" with { type: "json" };
import { parseTransitDataset } from "./transit-dataset";

const validRoute = {
  id: "guinhawa-annex",
  name: "Guinhawa Gate — Campus 2 Annex",
  number: "C2",
  operator: "jeepney",
  description: "Campus shuttle between the main gate and the Campus 2 annex.",
  color: "#dc2626",
  fare: { regular: 12, discounted: 10 },
  stops: [
    {
      name: "Guinhawa Gate",
      description: "Main gate terminal.",
      lat: 14.857,
      lon: 120.812,
    },
    {
      name: "Campus 2 Annex",
      description: "Annex gate.",
      lat: 14.852,
      lon: 120.815,
      fare: { regular: 12, discounted: 10 },
    },
  ],
};

describe("parseTransitDataset", () => {
  test("accepts an empty dataset", () => {
    expect(parseTransitDataset([])).toEqual({ ok: true, routes: [] });
  });

  test("accepts a well-formed route and preserves segment fares", () => {
    const result = parseTransitDataset([validRoute]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.routes).toHaveLength(1);
    const route = result.routes[0]!;
    expect(route.id).toBe("guinhawa-annex");
    expect(route.number).toBe("C2");
    expect(route.operator).toBe("jeepney");
    expect(route.stops[1]?.fare).toEqual({ regular: 12, discounted: 10 });
    expect(route.stops[0]?.fare).toBeUndefined();
  });

  test("rejects non-array input", () => {
    const result = parseTransitDataset({ routes: [] });
    expect(result.ok).toBe(false);
  });

  test("reports every problem in one pass", () => {
    const result = parseTransitDataset([
      { id: "Bad ID!", name: "", stops: [{ name: "Only" }] },
      validRoute,
      { ...validRoute, id: "guinhawa-annex" },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const joined = result.errors.join("\n");
    expect(joined).toContain("routes[0].id");
    expect(joined).toContain("routes[0].name");
    expect(joined).toContain("routes[0].color");
    expect(joined).toContain("fare must be an object");
    expect(joined).toContain("routes[0].stops");
    expect(joined).toContain("duplicate");
    // The valid middle route still parses; only bad entries are dropped.
    expect(result.errors.some((e) => e.startsWith("routes[1]"))).toBe(false);
  });

  test("rejects a segment fare on the first stop", () => {
    const route = {
      ...validRoute,
      stops: [
        { ...validRoute.stops[0], fare: { regular: 5, discounted: 4 } },
        validRoute.stops[1],
      ],
    };
    const result = parseTransitDataset([route]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join("\n")).toContain("first stop");
  });

  test("rejects unknown operators and out-of-range coordinates", () => {
    const route = {
      ...validRoute,
      operator: "ferry",
      stops: [
        { ...validRoute.stops[0], lat: 48.8, lon: 2.3 },
        validRoute.stops[1],
      ],
    };
    const result = parseTransitDataset([route]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const joined = result.errors.join("\n");
    expect(joined).toContain("operator");
    expect(joined).toContain("lat");
  });

  test("the shipped BulSU dataset parses (empty until #7 lands)", () => {
    // Only validity is asserted: routes.json gains real entries under #7.
    expect(parseTransitDataset(transitDataset).ok).toBe(true);
  });
});
