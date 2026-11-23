import { describe, expect, test } from "bun:test";
import {
  distinctStopCount,
  isLoopRoute,
  perBoardingFare,
  routeFareInfo,
  transitRouteKind,
  transitRouteNoun,
  transitStopNoun,
} from "./transit-route-kind";

describe("transitRouteKind", () => {
  test("no bundled routes ship on this fork, so nothing classifies as campus", () => {
    // Upstream's campus-jeep ids (forestry, kaliwa-kanan, …) only classify as
    // "campus" while they exist in JEEPNEY_ROUTES; BulSU ships that list empty.
    expect(transitRouteKind({ id: "forestry", name: "Forestry" })).toBe("town");
  });

  test("buses classify by name while no BulSU route ids are curated", () => {
    expect(transitRouteKind({ id: "x1", name: "Malolos → Manila (Bus)" })).toBe(
      "bus",
    );
    expect(
      transitRouteKind({ id: "new-route", name: "X → Y (Commuter Bus)" }),
    ).toBe("bus");
    expect(transitRouteNoun({ id: "x1", name: "Malolos → Manila (Bus)" })).toBe(
      "bus route",
    );
    expect(transitStopNoun({ id: "x1", name: "Malolos → Manila (Bus)" })).toBe(
      "Bus stop",
    );
  });

  test("no route is ticketed or fare-verified while the tables are empty", () => {
    const route = { id: "buendia-to-x", name: "X → Y (DLTB bus)" };
    expect(transitRouteKind(route)).toBe("bus");
    expect(routeFareInfo(route).kind).toBe("unverified");
    expect(perBoardingFare(route)).toBeNull();
  });

  test("other database routes are town jeeps", () => {
    expect(
      transitRouteKind({
        id: "town-1",
        name: "Malolos → San Jose del Monte",
      }),
    ).toBe("town");
    expect(
      transitRouteNoun({
        id: "town-1",
        name: "Malolos → San Jose del Monte",
      }),
    ).toBe("jeepney route");
  });
});

describe("isLoopRoute", () => {
  const stop = (name: string, lat: number, lon: number) => ({ name, lat, lon });

  test("a route that ends where it starts is a loop", () => {
    const route = {
      stops: [
        stop("Olivarez Plaza Mall", 14.17903, 121.23908),
        stop("Robinsons", 14.1773, 121.2424),
        stop("Raymundo Gate", 14.1677, 121.2416),
        stop("Olivarez Plaza Mall", 14.17903, 121.23908),
      ],
    };
    expect(isLoopRoute(route)).toBe(true);
    expect(distinctStopCount(route)).toBe(3);
  });

  test("a one-way route is not", () => {
    const route = {
      stops: [
        stop("A", 14.1, 121.1),
        stop("B", 14.2, 121.2),
        stop("C", 14.3, 121.3),
      ],
    };
    expect(isLoopRoute(route)).toBe(false);
    expect(distinctStopCount(route)).toBe(3);
  });
});

describe("routeFareInfo", () => {
  test("every route is unverified while no fares or ticketing are curated", () => {
    // TOWN_JEEPNEY_MINIMUM_FARE and VERIFIED_END_TO_END_FARES are empty on
    // this fork, so town jeeps, upstream campus-jeep ids, and buses all fall
    // back to the unverified note.
    for (const route of [
      { id: "kaliwa-kanan", name: "Kaliwa / Kanan" },
      { id: "lb-to-calamba", name: "Malolos → Calamba" },
      { id: "x1", name: "Malolos → Manila (Bus)" },
    ]) {
      expect(routeFareInfo(route).kind).toBe("unverified");
      expect(perBoardingFare(route)).toBeNull();
    }
  });
});
