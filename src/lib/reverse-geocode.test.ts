import { describe, expect, test } from "bun:test";
import {
  formatNominatimAddress,
  reverseGeocodeCacheKey,
} from "./reverse-geocode";

describe("reverseGeocodeCacheKey", () => {
  test("rounds coordinates for stable cache keys", () => {
    expect(reverseGeocodeCacheKey(14.165738589, 121.240452825)).toBe(
      "14.16574,121.24045",
    );
  });
});

describe("formatNominatimAddress", () => {
  test("prefers structured address parts over the long display name", () => {
    expect(
      formatNominatimAddress({
        display_name:
          "Carabao Park, Malolos, Bulacan, Calabarzon, 3000, Philippines",
        address: {
          road: "D. L. Umali Street",
          suburb: "BulSU",
          city: "Malolos",
          state: "Bulacan",
        },
      }),
    ).toBe("D. L. Umali Street, BulSU, Malolos, Bulacan");
  });

  test("falls back to display_name when structured parts are missing", () => {
    expect(
      formatNominatimAddress({
        display_name: "Main Gate, Malolos, Bulacan, Philippines",
      }),
    ).toBe("Main Gate, Malolos, Bulacan, Philippines");
  });
});
