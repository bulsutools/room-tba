import { describe, expect, test } from "bun:test";
import { polylineMeters, sliceRouteLine } from "./ride-geometry";

/** An L-shaped street: east 0.002°, then north 0.002°. */
const street: [number, number][] = [
  [121.24, 14.16],
  [121.241, 14.16],
  [121.242, 14.16],
  [121.242, 14.161],
  [121.242, 14.162],
];

describe("sliceRouteLine", () => {
  test("follows the street round the corner between two stops", () => {
    const slice = sliceRouteLine(
      street,
      { lat: 14.16, lon: 121.2405 },
      { lat: 14.1615, lon: 121.242 },
    );
    expect(slice).not.toBeNull();
    // Keeps the corner vertex a straight chord would cut.
    expect(slice).toContainEqual([121.242, 14.16]);
    expect(slice![0]).toEqual([121.2405, 14.16]);
    expect(slice!.at(-1)![1]).toBeCloseTo(14.1615, 6);
  });

  test("returns null when a stop is far off the line", () => {
    expect(
      sliceRouteLine(
        street,
        { lat: 14.16, lon: 121.2405 },
        { lat: 14.17, lon: 121.25 },
      ),
    ).toBeNull();
  });

  test("wraps across the seam of a closed loop", () => {
    const loop: [number, number][] = [
      [121.24, 14.16],
      [121.242, 14.16],
      [121.242, 14.162],
      [121.24, 14.162],
      [121.24, 14.16],
    ];
    // Board on the last side (west, heading south), alight on the first.
    const slice = sliceRouteLine(
      loop,
      { lat: 14.161, lon: 121.24 },
      { lat: 14.16, lon: 121.241 },
    );
    expect(slice).not.toBeNull();
    expect(slice).toContainEqual([121.24, 14.16]);
    expect(polylineMeters(slice!)).toBeLessThan(300);
  });
});

// The "real route geometry" suite upstream ships here needs bundled
// route data; BulSU ships JEEPNEY_ROUTES empty until Malolos transit lands.
