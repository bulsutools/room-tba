import { describe, expect, it } from "bun:test";
import { JEEPNEY_ROUTES } from "@constants/jeepney-routes";
import { getTransitStopPath, parseTransitPathname } from "./transit-urls";

describe("transit URLs", () => {
  it("parses a transit pathname", () => {
    expect(parseTransitPathname("/transit/sample-route/stop-a/")).toEqual({
      routeId: "sample-route",
      stopSlug: "stop-a",
    });
  });

  it("builds a route path when the stop list is empty for this fork", () => {
    expect(JEEPNEY_ROUTES).toEqual([]);
    expect(getTransitStopPath("any-route", 0)).toBe("/transit/any-route/");
  });
});
