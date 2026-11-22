import { describe, expect, test } from "bun:test";
import type {
  AnnouncementData,
  BuildingData,
  ClassMapValue,
  CollegeData,
  DivisionData,
  DormData,
  PlaceData,
  RoomData,
  TermWithCount,
} from "@lib/types";
import {
  buildPlaceCorpus,
  callTool,
  findPlace,
  getAcademicCalendar,
  getSchedule,
  rankPlaces,
  searchAnnouncements,
  type McpDataSource,
  type PlaceCorpusEntry,
  type PlaceCorpusInput,
} from "./tools";

const buildings: BuildingData[] = [
  {
    id: 1,
    buildingName: "F. Federizo",
    buildingType: "non-admin",
    lat: 14.161,
    lon: 121.217,
    directions: "Along the Arts corridor",
    imageUrl: null,
    crFacilities: null,
    streetViewPanoId: null,
    streetViewCaptured: null,
    streetViewDistanceM: null,
    streetViewCheckedAt: null,
    version: 1,
    updatedAt: "2026-01-01",
  } as BuildingData,
];

const rooms: RoomData[] = [
  {
    id: 10,
    code: "IT 101",
    fullName: "Institute of Technology Room 101",
    directions: null,
    building: {
      name: "F. Federizo",
      lat: 14.161,
      lon: 121.217,
      directions: null,
    },
    collegeName: "College of Engineering",
    divisionName: null,
    buildingId: 1,
    collegeId: 2,
    divisionId: null,
    imageUrl: null,
    category: "classroom",
    version: 1,
    updatedAt: "2026-01-01",
  },
  {
    id: 11,
    code: "IT 102",
    fullName: null,
    directions: null,
    building: {
      name: "F. Federizo",
      lat: 14.161,
      lon: 121.217,
      directions: null,
    },
    collegeName: "College of Engineering",
    divisionName: null,
    buildingId: 1,
    collegeId: 2,
    divisionId: null,
    imageUrl: null,
    category: null,
    version: 1,
    updatedAt: "2026-01-01",
  },
];

const colleges: CollegeData[] = [
  { id: 2, collegeName: "College of Engineering", version: 1, updatedAt: "x" },
];
const divisions: DivisionData[] = [];
const dorms: DormData[] = [
  {
    id: 5,
    dormName: "Kamia Residence Hall",
    shortName: "KAM",
    lat: 14.16,
    lon: 121.21,
    gender: "coed",
    capacity: null,
    managingOffice: null,
    contactEmail: null,
    amenities: null,
    osmLink: null,
    description: "A coed residence hall.",
    isUpManaged: true,
    priceRange: null,
    contactPhone: null,
    facebookLink: null,
    imageUrl: null,
    version: 1,
    updatedAt: "x",
  } as DormData,
];
const places: PlaceData[] = [];

const corpusInput: PlaceCorpusInput = {
  buildings,
  rooms,
  colleges,
  divisions,
  dorms,
  places,
};

function makeSource(overrides: Partial<McpDataSource> = {}): McpDataSource {
  return {
    listBuildings: async () => buildings,
    listRooms: async () => rooms,
    listColleges: async () => colleges,
    listDivisions: async () => divisions,
    listDorms: async () => dorms,
    listPlaces: async () => places,
    listTerms: async () => terms,
    listPublishedAnnouncements: async () => announcements,
    searchAliases: async () => [],
    classesForScope: async () => [],
    ...overrides,
  };
}

const terms: TermWithCount[] = [
  {
    id: 1261,
    label: "1st Semester 2026-2027",
    schoolYear: "2026-2027",
    semester: "1",
    startsOn: "2026-08-03",
    endsOn: "2026-12-07",
    isDefault: true,
    isActive: true,
    sortOrder: 3,
    classesImportedAt: null,
    version: 1,
    updatedAt: "x",
    classCount: 0,
  },
];

const announcements: AnnouncementData[] = [
  {
    id: 1,
    title: "Gymnasium closed for maintenance",
    body: "The gymnasium will be closed next week.",
    severity: "warning",
    startsOn: "2020-01-01T00:00:00",
    endsOn: null,
    linkUrl: null,
    author: null,
    createdAt: "2020-01-01T00:00:00",
    version: 1,
    updatedAt: "x",
  } as AnnouncementData,
];

const classRow: ClassMapValue = {
  id: 100,
  courseCode: "CS 201",
  courseTitle: "Data Structures",
  section: "A",
  type: "LEC",
  schedule: ["M 08:00-09:30"],
  directions: null,
  roomCode: "IT 101",
  roomId: 10,
  termId: 1261,
};

describe("buildPlaceCorpus / rankPlaces", () => {
  const corpus = buildPlaceCorpus(corpusInput);

  test("fuzzy building name resolves with coords", () => {
    const [top] = rankPlaces("federizo", corpus);
    expect(top?.kind).toBe("building");
    expect(top?.name).toBe("F. Federizo");
    expect(top?.lat).toBe(14.161);
  });

  test("coed resolves to dorms via gender field", () => {
    const results = rankPlaces("coed", corpus);
    expect(results[0]?.kind).toBe("dorm");
    expect(results[0]?.name).toBe("Kamia Residence Hall");
  });

  test("exact room code ranks first", () => {
    const [top] = rankPlaces("it 101", corpus);
    expect(top?.kind).toBe("room");
    expect(top?.code).toBe("IT 101");
  });

  test("alias priority keys boost the canonical building", () => {
    const tied: PlaceCorpusEntry[] = [
      {
        kind: "place",
        id: 9,
        name: "Federizo",
        lat: null,
        lon: null,
        normalizedName: "federizo",
        searchText: "federizo",
      },
      {
        kind: "building",
        id: 1,
        name: "F. Federizo",
        lat: 14.161,
        lon: 121.217,
        normalizedName: "ffederizo",
        searchText: "ffederizo",
      },
    ];
    // The place matches exactly (100) but the building substring (60) plus
    // the alias boost (50) must outrank it.
    const [top] = rankPlaces("federizo", tied, {
      priorityKeys: new Set(["building:1"]),
    });
    expect(top?.kind).toBe("building");
    expect(top?.id).toBe(1);
  });

  test("no match returns empty", () => {
    expect(rankPlaces("zzzznothing", corpus)).toEqual([]);
  });
});

describe("findPlace", () => {
  test("returns canonical matches and alias hits", async () => {
    const source = makeSource({
      searchAliases: async () => [
        {
          alias: "fed",
          targetType: "building",
          targetId: 1,
          value: "F. Federizo",
        },
      ],
    });
    const out = (await findPlace(source, { query: "federizo" })) as {
      results: { kind: string; name: string }[];
      aliases: { alias: string }[];
    };
    expect(out.results[0]?.name).toBe("F. Federizo");
    expect(out.aliases[0]?.alias).toBe("fed");
  });
});

describe("getSchedule", () => {
  test("room code resolves and returns classes for default term", async () => {
    const seen: { scope: unknown; termId?: number }[] = [];
    const source = makeSource({
      classesForScope: async (scope, termId) => {
        seen.push({ scope, termId });
        return [classRow];
      },
    });
    const out = (await getSchedule(source, { room_or_building: "IT 101" })) as {
      status: string;
      resolved: { kind: string; name: string };
      classes: { courseCode: string }[];
    };
    expect(out.status).toBe("ok");
    expect(out.resolved).toMatchObject({ kind: "room", name: "IT 101" });
    expect(out.classes[0]?.courseCode).toBe("CS 201");
    expect(seen[0]?.scope).toEqual({ roomId: 10 });
    expect(seen[0]?.termId).toBe(1261);
  });

  test("explicit empty state when no classes exist — never fabricated", async () => {
    const out = (await getSchedule(makeSource(), {
      room_or_building: "IT 101",
    })) as { status: string; message: string; classes: unknown[] };
    expect(out.status).toBe("empty");
    expect(out.classes).toEqual([]);
    expect(out.message).toContain("No schedule data");
  });

  test("building name scopes to buildingId", async () => {
    const seen: unknown[] = [];
    const source = makeSource({
      classesForScope: async (scope) => {
        seen.push(scope);
        return [classRow];
      },
    });
    const out = (await getSchedule(source, {
      room_or_building: "federizo",
    })) as { status: string; resolved: { kind: string } };
    expect(out.status).toBe("ok");
    expect(out.resolved.kind).toBe("building");
    expect(seen[0]).toEqual({ buildingId: 1 });
  });

  test("date outside any term returns honest no-term state", async () => {
    const out = (await getSchedule(makeSource(), {
      room_or_building: "IT 101",
      date: "2030-01-15",
    })) as { status: string; terms: unknown[] };
    expect(out.status).toBe("no-term");
    expect(out.terms.length).toBeGreaterThan(0);
  });

  test("date inside term window picks that term", async () => {
    const seen: (number | undefined)[] = [];
    const source = makeSource({
      classesForScope: async (_s, termId) => {
        seen.push(termId);
        return [classRow];
      },
    });
    await getSchedule(source, {
      room_or_building: "IT 101",
      date: "2026-09-01",
    });
    expect(seen[0]).toBe(1261);
  });

  test("dorm/place query is rejected as unschedulable", async () => {
    const out = (await getSchedule(makeSource(), {
      room_or_building: "coed",
    })) as { status: string };
    expect(out.status).toBe("error");
  });

  test("unknown query returns error, not fabricated data", async () => {
    const out = (await getSchedule(makeSource(), {
      room_or_building: "nowhere at all",
    })) as { status: string };
    expect(out.status).toBe("error");
  });
});

describe("getAcademicCalendar", () => {
  test("exposes term windows, milestones, and holidays", async () => {
    const out = (await getAcademicCalendar(makeSource())) as {
      terms: {
        id: number;
        startsOn: string | null;
        finalsStartsOn: string | null;
      }[];
      milestones: { label: string; startsOn: string }[];
      holidays: { label: string }[];
    };
    const term = out.terms.find((t) => t.id === 1261);
    expect(term?.startsOn).toBe("2026-08-03");
    expect(term?.finalsStartsOn).toBe("2026-12-01");
    expect(out.milestones.length).toBeGreaterThan(0);
    expect(out.holidays.length).toBeGreaterThan(0);
  });
});

describe("searchAnnouncements", () => {
  test("filters published announcements by query", async () => {
    const out = (await searchAnnouncements(makeSource(), {
      query: "gymnasium",
    })) as { count: number; announcements: { title: string }[] };
    expect(out.count).toBe(1);
    expect(out.announcements[0]?.title).toContain("Gymnasium");
  });

  test("empty query returns latest published", async () => {
    const out = (await searchAnnouncements(makeSource(), {})) as {
      count: number;
    };
    expect(out.count).toBe(1);
  });
});

describe("callTool dispatch", () => {
  test("routes tool names and rejects unknown", async () => {
    const out = (await callTool(makeSource(), "find_place", {
      query: "coed",
    })) as { count: number };
    expect(out.count).toBeGreaterThan(0);
    await expect(callTool(makeSource(), "nope", {})).rejects.toThrow(
      "Unknown tool",
    );
  });
});
