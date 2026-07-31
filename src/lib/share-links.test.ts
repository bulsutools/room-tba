import { describe, expect, test } from "bun:test";
import { SITE_URL } from "./site.js";
import { getJeepneyRouteShareUrl } from "./share-links.js";

describe("getJeepneyRouteShareUrl", () => {
  test("builds a jeepney deep link without a stop", () => {
    expect(getJeepneyRouteShareUrl("sample-route")).toBe(
      `${SITE_URL}/transit/sample-route/`,
    );
  });

  test("falls back to the route path when the fork has no stop list", () => {
    expect(getJeepneyRouteShareUrl("sample-route", 3)).toBe(
      `${SITE_URL}/transit/sample-route/`,
    );
  });

  test("includes stop=0 the same way when stops are absent", () => {
    expect(getJeepneyRouteShareUrl("sample-route", 0)).toBe(
      `${SITE_URL}/transit/sample-route/`,
    );
  });

  test("url-encodes the route id", () => {
    expect(getJeepneyRouteShareUrl("a b/c")).toBe(
      `${SITE_URL}/transit/a%20b%2Fc/`,
    );
  });
});
