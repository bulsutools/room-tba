import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ClassMapValue, RoomData, Term } from "@lib/types";
import {
  buildRoomFinderResults,
  manilaTargetDateKey,
  parseRoomFinderQuery,
  roomAvailabilityAt,
  weekdayForDateKey,
} from "./room-finder.js";

const { getJSONFetch } = vi.hoisted(() => ({
  getJSONFetch: vi.fn(),
}));

vi.mock("./local/data/utils.js", () => ({
  getJSONFetch,
}));

import { RoomFinderStore } from "./stores/room-finder-store.svelte.js";

// Fixed "now": Monday 2026-06-15 06:00 UTC = 14:00 Asia/Manila.
const NOW = new Date("2026-06-15T06:00:00Z");

const room = (over: Partial<RoomData>): RoomData =>
  ({
    id: 1,
    code: "A 101",
    fullName: null,
    directions: null,
    building: {
      name: "Engineering Hall",
      lat: 14.0,
      lon: 121.0,
      directions: null,
    },
    buildingId: 1,
    collegeId: null,
    divisionId: null,
    collegeName: "College of Engineering",
    divisionName: null,
    category: "classroom",
    version: 1,
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  }) as RoomData;

const term = (over: Partial<Term>): Term =>
  ({
    id: 1253,
    label: "Midyear 2026",
    schoolYear: "2026-2027",
    semester: "midyear",
    startsOn: "2026-06-08",
    endsOn: "2026-07-26",
    isDefault: false,
    isActive: true,
    sortOrder: 1,
    classesImportedAt: null,
    version: 1,
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  }) as Term;

const cls = (over: Partial<ClassMapValue>): ClassMapValue =>
  ({
    id: 1,
    courseCode: "CS 101",
    section: "A",
    type: "LEC",
    schedule: ["M 01:00PM-02:30PM"],
    directions: null,
    courseTitle: "Intro",
    roomCode: "A 101",
    termId: 1253,
    roomId: 1,
    ...over,
  }) as ClassMapValue;

const data = (over: Partial<Parameters<typeof buildRoomFinderResults>[1]>) => ({
  rooms: [] as RoomData[],
  classes: [] as ClassMapValue[],
  places: [],
  buildings: [],
  terms: [term({})],
  now: NOW,
  ...over,
});

describe("parseRoomFinderQuery", () => {
  test("parses 'free room near X at 2pm'", () => {
    const q = parseRoomFinderQuery("free room near the library at 2pm", NOW);
    expect(q.matched).toBe(true);
    expect(q.timeMinutes).toBe(14 * 60);
    expect(q.hasExplicitTime).toBe(true);
    expect(q.placeText).toBe("library");
    expect(q.dayOffset).toBe(0);
  });

  test("parses 24h time and tomorrow", () => {
    const q = parseRoomFinderQuery(
      "available room near engineering hall tomorrow at 14:30",
      NOW,
    );
    expect(q.matched).toBe(true);
    expect(q.timeMinutes).toBe(14 * 60 + 30);
    expect(q.dayOffset).toBe(1);
    expect(q.placeText).toBe("engineering hall");
  });

  test("plain entity searches do not match", () => {
    for (const text of ["ICS 201", "computer science", "library", "BSIT"]) {
      expect(parseRoomFinderQuery(text, NOW).matched).toBe(false);
    }
  });

  test("time alone is enough intent", () => {
    const q = parseRoomFinderQuery("room at noon", NOW);
    expect(q.matched).toBe(true);
    expect(q.timeMinutes).toBe(12 * 60);
    expect(q.placeText).toBe("");
  });
});

describe("manila date helpers", () => {
  test("weekdayForDateKey maps Manila days, Sunday → null", () => {
    // 2026-06-15 is a Monday.
    expect(weekdayForDateKey("2026-06-15")).toBe("M");
    expect(weekdayForDateKey("2026-06-20")).toBe("S");
    expect(weekdayForDateKey("2026-06-21")).toBeNull();
  });

  test("manilaTargetDateKey rolls over months", () => {
    // 10:00 UTC = 18:00 Manila on June 30; tomorrow rolls into July.
    expect(manilaTargetDateKey(new Date("2026-06-30T10:00:00Z"), 1)).toBe(
      "2026-07-01",
    );
  });
});

describe("roomAvailabilityAt", () => {
  const rows = [cls({})];

  test("busy when a class slot covers the time on that weekday", () => {
    const info = roomAvailabilityAt(rows, "M", 13 * 60 + 30, true);
    expect(info.availability).toBe("busy");
  });

  test("free when the slot is on another weekday", () => {
    const info = roomAvailabilityAt(rows, "T", 13 * 60 + 30, true);
    expect(info.availability).toBe("free");
    expect(info.label).toBe("Free at 1:30 PM");
  });

  test("unknown — never free — when the room has no schedule rows", () => {
    const info = roomAvailabilityAt([], "M", 13 * 60, true);
    expect(info.availability).toBe("unknown");
    expect(info.label).toBe("Schedule unknown");
  });
});

describe("buildRoomFinderResults", () => {
  const near = room({
    id: 1,
    code: "LIB 101",
    building: {
      name: "Library",
      lat: 14.0,
      lon: 121.0,
      directions: null,
    },
  });
  const far = room({
    id: 2,
    code: "ENG 202",
    building: {
      name: "Engineering Hall",
      lat: 14.01,
      lon: 121.01,
      directions: null,
    },
  });

  test("ranks rooms by distance to the matched place anchor", () => {
    const q = parseRoomFinderQuery("free room near the library at 2pm", NOW);
    const results = buildRoomFinderResults(q, {
      ...data({}),
      rooms: [far, near],
      places: [
        {
          id: 1,
          name: "Main Library",
          category: "library",
          lat: 14.0,
          lon: 121.0,
          description: null,
          hours: null,
          websiteLink: null,
          facebookLink: null,
          imageUrl: null,
          version: 1,
          updatedAt: "2026-01-01T00:00:00Z",
        } as never,
      ],
      buildings: [],
    });
    expect(results[0]?.code).toBe("LIB 101");
    expect(results[0]?.distanceM).not.toBeNull();
  });

  test("rooms without schedule rows report unknown, not free", () => {
    const q = parseRoomFinderQuery("free room at 2pm", NOW);
    const results = buildRoomFinderResults(q, data({ rooms: [near, far] }));
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.availability).toBe("unknown");
      expect(result.availabilityLabel).toBe("Schedule unknown");
    }
  });

  test("busy rooms rank below free rooms at the requested time", () => {
    const q = parseRoomFinderQuery("free room at 1:30pm", NOW);
    const results = buildRoomFinderResults(
      q,
      data({
        rooms: [near, far],
        classes: [
          cls({ roomCode: "LIB 101", schedule: ["M 01:00PM-02:30PM"] }),
          cls({
            id: 2,
            roomCode: "ENG 202",
            schedule: ["M 09:00AM-10:30AM"],
          }),
        ],
      }),
    );
    const byCode = new Map(results.map((r) => [r.code, r]));
    expect(byCode.get("LIB 101")?.availability).toBe("busy");
    expect(byCode.get("ENG 202")?.availability).toBe("free");
    expect(results[0]?.code).toBe("ENG 202");
  });

  test("outside term windows the calendar itself reports no classes", () => {
    // NOW is inside 1253; move "now" to August, past every window.
    const august = new Date("2026-08-10T06:00:00Z");
    const q = parseRoomFinderQuery("free room at 2pm", august);
    const results = buildRoomFinderResults(q, {
      ...data({ rooms: [near] }),
      now: august,
    });
    expect(results[0]?.availability).toBe("free");
    expect(results[0]?.availabilityLabel).toBe("No classes in session");
  });
});

describe("RoomFinderStore", () => {
  beforeEach(() => {
    getJSONFetch.mockReset();
  });

  test("does not call the endpoint for plain entity searches", async () => {
    const store = new RoomFinderStore();
    await store.search("computer science");
    expect(getJSONFetch).not.toHaveBeenCalled();
    expect(store.matched).toBe(false);
  });

  test("fetches ranked rooms for finder queries", async () => {
    getJSONFetch.mockResolvedValue({
      matched: true,
      slotLabel: "Mon 2:00 PM",
      placeLabel: "library",
      results: [
        {
          code: "LIB 101",
          availability: "free",
          availabilityLabel: "Free at 2:00 PM",
          distanceM: 40,
        },
      ],
    });
    const store = new RoomFinderStore();
    await store.search("free room near the library at 2pm");
    expect(getJSONFetch).toHaveBeenCalledWith(
      `/api/room-finder?q=${encodeURIComponent("free room near the library at 2pm")}`,
    );
    expect(store.matched).toBe(true);
    expect(store.results[0]?.code).toBe("LIB 101");
    expect(store.slotLabel).toBe("Mon 2:00 PM");
  });

  test("clears state on empty input", async () => {
    const store = new RoomFinderStore();
    store.matched = true;
    store.results = [{ code: "X" } as never];
    await store.search("   ");
    expect(store.matched).toBe(false);
    expect(store.results).toEqual([]);
  });
});
