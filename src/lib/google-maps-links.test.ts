import { describe, expect, test } from "bun:test";
import {
  getGoogleMapsPinUrl,
  getGoogleStreetViewUrl,
} from "./google-maps-links";

describe("getGoogleMapsPinUrl", () => {
  test("searches for a named entity instead of opening raw coordinates", () => {
    expect(getGoogleMapsPinUrl(14.6532, 121.0689, "Test Hall")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Test%20Hall%2C%20Malolos%2C%20Bulacan",
    );
  });

  test("builds a Google Maps query URL from coordinates", () => {
    expect(getGoogleMapsPinUrl(14.6532, 121.0689)).toBe(
      "https://www.google.com/maps?q=14.6532,121.0689",
    );
  });
});

describe("getGoogleStreetViewUrl", () => {
  test("builds a Maps URLs API pano viewpoint URL", () => {
    expect(getGoogleStreetViewUrl(14.16497, 121.24132)).toBe(
      "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=14.16497,121.24132",
    );
  });
});
