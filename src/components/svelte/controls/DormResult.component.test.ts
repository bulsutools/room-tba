import { render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import DormResultHost from "@test/components/DormResultHost.svelte";
import type { DormData } from "@lib/types";
import { queryStore } from "@lib/store.svelte";

function dorm(overrides: Partial<DormData> = {}): DormData {
  return {
    id: 12,
    dormName: "Arable Premier Residences",
    shortName: null,
    lat: 14.1663791,
    lon: 121.2381389,
    gender: "coed",
    capacity: null,
    managingOffice: null,
    contactEmail: null,
    amenities: [],
    osmLink: null,
    description: null,
    isUpManaged: false,
    priceRange: null,
    contactPhone: [],
    facebookLink: null,
    imageUrl: null,
    version: 1,
    updatedAt: "2026-07-21T00:00:00.000Z",
    ...overrides,
  };
}

function renderDormResult(testDorm: DormData) {
  queryStore.hydrateQuery({
    category: "dorm",
    type: "result",
    value: testDorm.dormName,
  });
  return render(DormResultHost, { props: { dorm: testDorm } });
}

describe("DormResult details", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  test("dorm without a photo or gallery entry renders no image", () => {
    // Fixture name is not in the landmark manifest, and Street View is off
    // without a key: nothing to show, so no empty frame either.
    renderDormResult(dorm({ dormName: "Nowhere Dorm" }));
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("button", { name: /next photo/i })).toBeNull();
  });
});
