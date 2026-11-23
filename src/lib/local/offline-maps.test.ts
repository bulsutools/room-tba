import { afterEach, describe, expect, test } from "bun:test";
import { setBasemapProvider } from "@lib/basemap-provider";
import {
  CAMPUS_MAP_STYLE_URL,
  FALLBACK_MAP_STYLE_URL,
  MAPTILER_KEY_PLACEHOLDER,
} from "@lib/maptiler-key";
import { getTileTemplate, MAX_ZOOM } from "@lib/local/offline-maps";

const MAPTILER_TEMPLATE = "https://api.maptiler.com/{z}/{x}/{y}.pbf";
const OPENFREEMAP_TEMPLATE =
  "https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf";

const CAMPUS_STYLE = {
  version: 8,
  sources: {
    openmaptiles: {
      type: "vector",
      url: `https://api.maptiler.com/tiles/v3-openmaptiles/tiles.json?key=${MAPTILER_KEY_PLACEHOLDER}`,
    },
  },
};

const POSITRON_STYLE = {
  version: 8,
  sources: {
    openmaptiles: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
    },
  },
};

const realFetch = globalThis.fetch;
const realKey = process.env.PUBLIC_MAPTILER_KEY;

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/** Serves both style URLs and both TileJSON indirections; records requests. */
function stubNetwork() {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url === CAMPUS_MAP_STYLE_URL) return json(CAMPUS_STYLE);
    if (url.startsWith("https://api.maptiler.com/")) {
      return json({ tiles: [MAPTILER_TEMPLATE], maxzoom: 14 });
    }
    if (url === FALLBACK_MAP_STYLE_URL) return json(POSITRON_STYLE);
    if (url === "https://tiles.openfreemap.org/planet") {
      return json({ tiles: [OPENFREEMAP_TEMPLATE], maxzoom: 14 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  if (realKey === undefined) delete process.env.PUBLIC_MAPTILER_KEY;
  else process.env.PUBLIC_MAPTILER_KEY = realKey;
});

describe("getTileTemplate", () => {
  test("returns null when the active style has no openmaptiles source", async () => {
    process.env.PUBLIC_MAPTILER_KEY = "working-key-123";
    setBasemapProvider("maptiler");
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url === CAMPUS_MAP_STYLE_URL)
        return json({ version: 8, sources: {} });
      throw new Error(`unexpected fetch: ${url}`);
    }) as typeof fetch;

    expect(await getTileTemplate()).toBeNull();
  });

  test("resolves the MapTiler template when the campus style is active", async () => {
    process.env.PUBLIC_MAPTILER_KEY = "working-key-123";
    setBasemapProvider("maptiler");
    const calls = stubNetwork();

    const source = await getTileTemplate();

    expect(source?.template).toBe(MAPTILER_TEMPLATE);
    expect(source?.maxZoom).toBe(MAX_ZOOM);
    expect(calls).toContain(CAMPUS_MAP_STYLE_URL);
    expect(calls.some((c) => c.startsWith("https://api.maptiler.com/"))).toBe(
      true,
    );
  });

  test("resolves the OpenFreeMap template when that basemap is active", async () => {
    process.env.PUBLIC_MAPTILER_KEY = "working-key-123";
    setBasemapProvider("openfreemap");
    const calls = stubNetwork();

    const source = await getTileTemplate();

    expect(source?.template).toBe(OPENFREEMAP_TEMPLATE);
    expect(calls).toContain(FALLBACK_MAP_STYLE_URL);
    expect(calls).not.toContain(CAMPUS_MAP_STYLE_URL);
  });

  test("uses the keyless basemap when no MapTiler key is configured", async () => {
    delete process.env.PUBLIC_MAPTILER_KEY;
    // Provider still reads its "maptiler" default before the style loads.
    setBasemapProvider("maptiler");
    const calls = stubNetwork();

    const source = await getTileTemplate();

    // Same "openfreemap" route as the previous test, so this may be served
    // from cache — what matters is it never touches the campus/MapTiler style.
    expect(source?.template).toBe(OPENFREEMAP_TEMPLATE);
    expect(calls).not.toContain(CAMPUS_MAP_STYLE_URL);
  });

  test("resolves the OSM raster template without any fetch", async () => {
    setBasemapProvider("osm-raster");
    const calls = stubNetwork();

    const source = await getTileTemplate();

    expect(source?.template).toBe(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    );
    expect(source?.maxZoom).toBe(MAX_ZOOM);
    expect(calls).toHaveLength(0);
  });
});
