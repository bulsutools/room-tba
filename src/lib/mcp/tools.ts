/**
 * MCP tool layer for the public read-only endpoint (#3). Handlers are thin
 * wrappers over the same service functions the REST API uses; all matching
 * and shaping lives in pure helpers so `bun test` covers them without a DB.
 */
import {
  holidaysWithin,
  milestonesForTerms,
  type CalendarMilestone,
} from "@lib/academic-milestones";
import { normalizeAlias } from "@lib/site";
import {
  buildYearTimeline,
  resolveTermWindow,
  termWindowStatus,
} from "@lib/academic-calendar";
import {
  CHANGE_OF_MATRICULATION_ENDS,
  resolveActiveTermByDate,
  resolveDefaultTermFromList,
  TERM_CALENDAR_WINDOWS,
  termDateKey,
  toManilaDateKey,
} from "@lib/term-calendar";
import type { AliasMatch, ClassScope } from "@lib/services/map-data-service";
import type {
  AnnouncementData,
  BuildingData,
  ClassMapValue,
  CollegeData,
  DivisionData,
  DormData,
  PlaceData,
  RoomData,
  Term,
  TermWithCount,
} from "@lib/types";

export type PlaceKind =
  | "building"
  | "room"
  | "college"
  | "division"
  | "dorm"
  | "place";

export type PlaceMatch = {
  kind: PlaceKind;
  id: number;
  name: string;
  /** Room code or dorm short name when it differs from `name`. */
  code?: string | null;
  description?: string | null;
  lat: number | null;
  lon: number | null;
  /** Set on rooms: the schedulable parent ids. */
  buildingId?: number | null;
  collegeId?: number | null;
  divisionId?: number | null;
};

export type PlaceCorpusEntry = PlaceMatch & {
  normalizedName: string;
  /** Extra normalized fields (fullName, gender, category, parent names). */
  searchText: string;
};

export type PlaceCorpusInput = {
  buildings: BuildingData[];
  rooms: RoomData[];
  colleges: CollegeData[];
  divisions: DivisionData[];
  dorms: DormData[];
  places: PlaceData[];
};

/** Flatten every searchable entity into one ranked corpus. */
export function buildPlaceCorpus(input: PlaceCorpusInput): PlaceCorpusEntry[] {
  const corpus: PlaceCorpusEntry[] = [];

  for (const b of input.buildings) {
    corpus.push({
      kind: "building",
      id: b.id,
      name: b.buildingName,
      description: b.directions,
      lat: b.lat,
      lon: b.lon,
      normalizedName: normalizeAlias(b.buildingName),
      searchText: normalizeAlias(
        [b.buildingName, b.buildingType, b.directions]
          .filter(Boolean)
          .join(" "),
      ),
    });
  }

  for (const r of input.rooms) {
    corpus.push({
      kind: "room",
      id: r.id,
      name: r.code,
      code: r.code,
      description: r.fullName ?? r.directions,
      lat: r.building?.lat ?? null,
      lon: r.building?.lon ?? null,
      buildingId: r.buildingId,
      collegeId: r.collegeId,
      divisionId: r.divisionId,
      normalizedName: normalizeAlias(r.code),
      searchText: normalizeAlias(
        [
          r.code,
          r.fullName,
          r.collegeName,
          r.divisionName,
          r.building?.name,
          r.directions,
        ]
          .filter(Boolean)
          .join(" "),
      ),
    });
  }

  for (const c of input.colleges) {
    corpus.push({
      kind: "college",
      id: c.id,
      name: c.collegeName,
      lat: null,
      lon: null,
      normalizedName: normalizeAlias(c.collegeName),
      searchText: normalizeAlias(c.collegeName),
    });
  }

  for (const d of input.divisions) {
    corpus.push({
      kind: "division",
      id: d.id,
      name: d.divisionName,
      lat: null,
      lon: null,
      normalizedName: normalizeAlias(d.divisionName),
      searchText: normalizeAlias(d.divisionName),
    });
  }

  for (const d of input.dorms) {
    corpus.push({
      kind: "dorm",
      id: d.id,
      name: d.dormName,
      code: d.shortName,
      description: d.description,
      lat: d.lat,
      lon: d.lon,
      normalizedName: normalizeAlias(d.dormName),
      // gender/description are searchable so "coed" resolves to co-ed halls.
      searchText: normalizeAlias(
        [d.dormName, d.shortName, d.gender, d.description]
          .filter(Boolean)
          .join(" "),
      ),
    });
  }

  for (const p of input.places) {
    corpus.push({
      kind: "place",
      id: p.id,
      name: p.name,
      description:
        [p.category, p.description, p.hours].filter(Boolean).join(" — ") ||
        null,
      lat: p.lat,
      lon: p.lon,
      normalizedName: normalizeAlias(p.name),
      searchText: normalizeAlias(
        [p.name, p.category, p.description, p.hours].filter(Boolean).join(" "),
      ),
    });
  }

  return corpus;
}

const KIND_ORDER: Record<PlaceKind, number> = {
  building: 0,
  college: 1,
  division: 2,
  dorm: 3,
  place: 4,
  room: 5,
};

/**
 * Rank corpus entries against a fuzzy query. Scoring: exact normalized name
 * > name prefix > name substring > extra-field substring. `priorityKeys`
 * (alias-table hits, `${kind}:${id}`) get a boost so curated synonyms like
 * "federizo" land on the canonical building.
 */
export function rankPlaces(
  query: string,
  corpus: PlaceCorpusEntry[],
  options?: { limit?: number; priorityKeys?: ReadonlySet<string> },
): PlaceMatch[] {
  const needle = normalizeAlias(query);
  if (!needle) return [];
  const limit = options?.limit ?? 10;

  const scored: { entry: PlaceCorpusEntry; score: number }[] = [];
  for (const entry of corpus) {
    let score = 0;
    if (entry.normalizedName === needle) score = 100;
    else if (entry.normalizedName.startsWith(needle)) score = 80;
    else if (entry.normalizedName.includes(needle)) score = 60;
    else if (entry.searchText.includes(needle)) score = 40;
    if (score === 0) continue;
    if (options?.priorityKeys?.has(`${entry.kind}:${entry.id}`)) score += 50;
    scored.push({ entry, score });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      KIND_ORDER[a.entry.kind] - KIND_ORDER[b.entry.kind] ||
      a.entry.name.localeCompare(b.entry.name),
  );

  return scored.slice(0, limit).map(({ entry }) => {
    const { normalizedName: _n, searchText: _s, ...match } = entry;
    return match;
  });
}

/** Data access the tool handlers need; the default impl wires the services. */
export type McpDataSource = {
  listBuildings(): Promise<BuildingData[]>;
  listRooms(): Promise<RoomData[]>;
  listColleges(): Promise<CollegeData[]>;
  listDivisions(): Promise<DivisionData[]>;
  listDorms(): Promise<DormData[]>;
  listPlaces(): Promise<PlaceData[]>;
  listTerms(): Promise<TermWithCount[]>;
  listPublishedAnnouncements(): Promise<AnnouncementData[]>;
  searchAliases(query: string): Promise<AliasMatch[]>;
  classesForScope(
    scope: ClassScope,
    termId?: number,
    limit?: number,
  ): Promise<ClassMapValue[]>;
};

export const FIND_PLACE_LIMIT = 10;
export const SCHEDULE_CLASS_LIMIT = 500;
export const ANNOUNCEMENT_LIMIT = 20;

async function placeCorpus(source: McpDataSource): Promise<PlaceCorpusEntry[]> {
  const [buildings, rooms, colleges, divisions, dorms, places] =
    await Promise.all([
      source.listBuildings(),
      source.listRooms(),
      source.listColleges(),
      source.listDivisions(),
      source.listDorms(),
      source.listPlaces(),
    ]);
  return buildPlaceCorpus({
    buildings,
    rooms,
    colleges,
    divisions,
    dorms,
    places,
  });
}

export async function findPlace(
  source: McpDataSource,
  args: { query: string },
) {
  const corpus = await placeCorpus(source);
  const aliases = await source.searchAliases(args.query);
  const priorityKeys = new Set(
    aliases
      .filter((a) => a.targetType === "building")
      .map((a) => `building:${a.targetId}`),
  );
  const results = rankPlaces(args.query, corpus, {
    limit: FIND_PLACE_LIMIT,
    priorityKeys,
  });
  return {
    query: args.query,
    count: results.length,
    results,
    aliases: aliases.map((a) => ({
      alias: a.alias,
      targetType: a.targetType,
      targetId: a.targetId,
      buildingName: a.value,
    })),
  };
}

const SCHEDULABLE_KINDS = new Set<PlaceKind>([
  "building",
  "college",
  "division",
  "room",
]);

function scopeForMatch(match: PlaceMatch): ClassScope | null {
  if (match.kind === "room") return { roomId: match.id };
  if (match.kind === "building") return { buildingId: match.id };
  if (match.kind === "college") return { collegeId: match.id };
  if (match.kind === "division") return { divisionId: match.id };
  return null;
}

function termSummary(term: Term | TermWithCount) {
  const window = resolveTermWindow(term);
  return {
    id: term.id,
    label: term.label,
    schoolYear: term.schoolYear,
    semester: term.semester,
    startsOn: window?.startsOn ?? termDateKey(term.startsOn),
    endsOn: window?.endsOn ?? termDateKey(term.endsOn),
    status: window ? termWindowStatus(window, new Date()) : null,
  };
}

/** Cap on rooms listed per schedule response; classes stay uncapped-ish. */
const SCHEDULE_ROOM_SAMPLE = 25;

export async function getSchedule(
  source: McpDataSource,
  args: { room_or_building: string; date?: string },
) {
  const query = args.room_or_building.trim();
  if (!query) {
    return { status: "error", message: "room_or_building is required" };
  }

  // Room codes win over fuzzy names: "IT 101" is a room, not a place name.
  const [rooms, buildings, colleges, divisions, terms] = await Promise.all([
    source.listRooms(),
    source.listBuildings(),
    source.listColleges(),
    source.listDivisions(),
    source.listTerms(),
  ]);
  const needle = normalizeAlias(query);
  const exactRoom = rooms.find(
    (r) =>
      normalizeAlias(r.code) === needle ||
      normalizeAlias(r.fullName ?? "") === needle,
  );

  let resolved: PlaceMatch | null = null;
  if (exactRoom) {
    resolved = {
      kind: "room",
      id: exactRoom.id,
      name: exactRoom.code,
      code: exactRoom.code,
      lat: exactRoom.building?.lat ?? null,
      lon: exactRoom.building?.lon ?? null,
      buildingId: exactRoom.buildingId,
      collegeId: exactRoom.collegeId,
      divisionId: exactRoom.divisionId,
    };
  } else {
    const corpus = buildPlaceCorpus({
      buildings,
      rooms,
      colleges,
      divisions,
      dorms: [],
      places: [],
    });
    const aliases = await source.searchAliases(query);
    const [top] = rankPlaces(query, corpus, {
      limit: 3,
      priorityKeys: new Set(
        aliases
          .filter((a) => a.targetType === "building")
          .map((a) => `building:${a.targetId}`),
      ),
    });
    resolved = top ?? null;
    if (resolved && !SCHEDULABLE_KINDS.has(resolved.kind)) {
      return {
        status: "error",
        message: `"${query}" resolves to a ${resolved.kind}, which has no class schedule. Try a building, college, division, or room code.`,
        resolved,
      };
    }
  }

  if (!resolved) {
    return {
      status: "error",
      message: `No building, college, division, or room matches "${query}". Use find_place to search campus places first.`,
    };
  }

  const scope = scopeForMatch(resolved);
  if (!scope) {
    return {
      status: "error",
      message: `"${resolved.name}" is not a schedulable space.`,
      resolved,
    };
  }

  // Term: explicit date wins (must fall inside a term window); otherwise the
  // same default the site shows visitors.
  let term: Term | TermWithCount | null = null;
  if (args.date) {
    const parsed = new Date(`${args.date}T12:00:00+08:00`);
    if (Number.isNaN(parsed.getTime())) {
      return {
        status: "error",
        message: `Invalid date "${args.date}"; use YYYY-MM-DD.`,
      };
    }
    term = resolveActiveTermByDate(terms, parsed);
    if (!term) {
      return {
        status: "no-term",
        message: `No term is in session on ${args.date} (Asia/Manila).`,
        date: toManilaDateKey(parsed),
        terms: terms.map(termSummary),
      };
    }
  } else {
    term = resolveDefaultTermFromList(terms);
  }

  const base = {
    query,
    resolved,
    scope: resolved.kind,
    term: term ? termSummary(term) : null,
  };

  if (!term) {
    return {
      ...base,
      status: "empty",
      message:
        "No active term could be resolved, so there is no schedule data to report. This is an honest empty state, not missing classes.",
      classes: [],
    };
  }

  const classes = await source.classesForScope(
    scope,
    term.id,
    SCHEDULE_CLASS_LIMIT + 1,
  );
  const truncated = classes.length > SCHEDULE_CLASS_LIMIT;
  const rows = truncated ? classes.slice(0, SCHEDULE_CLASS_LIMIT) : classes;

  // Rooms in scope, capped — lets the agent see coverage without a huge list.
  const scopeRooms = rooms.filter((r) => {
    if (resolved?.kind === "room") return r.id === resolved.id;
    if (resolved?.kind === "building") return r.buildingId === resolved.id;
    if (resolved?.kind === "college") return r.collegeId === resolved.id;
    return r.divisionId === resolved?.id;
  });
  const roomSample = scopeRooms
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code))
    .slice(0, SCHEDULE_ROOM_SAMPLE)
    .map((r) => ({ id: r.id, code: r.code, fullName: r.fullName }));

  if (rows.length === 0) {
    return {
      ...base,
      status: "empty",
      message: `No schedule data for ${resolved.name} in ${term.label}. The classes table has no rows for this scope and term — report this as unknown, do not guess a timetable.`,
      roomCount: scopeRooms.length,
      rooms: roomSample,
      roomsTruncated: scopeRooms.length > SCHEDULE_ROOM_SAMPLE,
      classes: [],
    };
  }

  return {
    ...base,
    status: "ok",
    roomCount: scopeRooms.length,
    rooms: roomSample,
    roomsTruncated: scopeRooms.length > SCHEDULE_ROOM_SAMPLE,
    classCount: rows.length,
    truncated,
    classes: rows.map((c) => ({
      id: c.id,
      courseCode: c.courseCode,
      courseTitle: c.courseTitle,
      section: c.section,
      type: c.type,
      schedule: c.schedule,
      roomCode: c.roomCode,
      roomId: c.roomId,
      termId: c.termId,
    })),
  };
}

export async function getAcademicCalendar(source: McpDataSource) {
  const terms = await source.listTerms();
  const activeTerms = terms.filter((t) => t.isActive);
  const timeline = buildYearTimeline(activeTerms);

  const termIds = activeTerms.map((t) => t.id);
  const milestones: CalendarMilestone[] = milestonesForTerms(termIds);
  const rangeStart = timeline?.rangeStart ?? "1970-01-01";
  const rangeEnd = timeline?.rangeEnd ?? "2100-12-31";
  const holidays = holidaysWithin(rangeStart, rangeEnd);

  return {
    terms: activeTerms.map((term) => {
      const calendarWindow = TERM_CALENDAR_WINDOWS[term.id];
      return {
        ...termSummary(term),
        finalsStartsOn: calendarWindow?.finalsStartsOn ?? null,
        finalsEndsOn: calendarWindow?.finalsEndsOn ?? null,
        changeOfMatriculationEndsOn:
          CHANGE_OF_MATRICULATION_ENDS[term.id] ?? null,
        classCount: term.classCount,
      };
    }),
    milestones,
    holidays,
    range: timeline
      ? { start: timeline.rangeStart, end: timeline.rangeEnd }
      : null,
  };
}

export async function searchAnnouncements(
  source: McpDataSource,
  args: { query?: string },
) {
  const published = await source.listPublishedAnnouncements();
  const needle = normalizeAlias(args.query ?? "");
  const matches = needle
    ? published.filter((a) =>
        normalizeAlias(`${a.title} ${a.body}`).includes(needle),
      )
    : published;
  return {
    query: args.query ?? null,
    count: Math.min(matches.length, ANNOUNCEMENT_LIMIT),
    totalMatches: matches.length,
    announcements: matches.slice(0, ANNOUNCEMENT_LIMIT).map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      severity: a.severity,
      startsOn: a.startsOn,
      endsOn: a.endsOn,
      linkUrl: a.linkUrl,
      author: a.author,
    })),
  };
}

export const MCP_TOOLS = [
  {
    name: "find_place",
    description:
      'Find a campus building, room, college, division, dorm, or place by fuzzy name (e.g. "federizo", "coed"). Returns canonical names, kind, and map coordinates when known.',
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Fuzzy place name or code" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_schedule",
    description:
      "Class schedule for a room, building, college, or division on a date (YYYY-MM-DD, Asia/Manila). Without a date, uses the term the site shows by default. Returns an explicit empty state when no schedule data exists — never fabricated timetables.",
    inputSchema: {
      type: "object",
      properties: {
        room_or_building: {
          type: "string",
          description: "Room code or fuzzy building/college/division name",
        },
        date: {
          type: "string",
          description: "Optional date in YYYY-MM-DD (Asia/Manila)",
        },
      },
      required: ["room_or_building"],
    },
  },
  {
    name: "get_academic_calendar",
    description:
      "UPLB academic calendar: term instructional/finals windows, registrar milestones (registration, dropping, midsem, finals), and official holidays.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "search_announcements",
    description:
      "Search currently-published campus announcements (closures, notices) by keyword. Empty query returns the latest published announcements.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Keyword to match in title/body",
        },
      },
    },
  },
] as const;

export async function callTool(
  source: McpDataSource,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "find_place":
      return findPlace(source, { query: String(args["query"] ?? "") });
    case "get_schedule":
      return getSchedule(source, {
        room_or_building: String(args["room_or_building"] ?? ""),
        date: typeof args["date"] === "string" ? args["date"] : undefined,
      });
    case "get_academic_calendar":
      return getAcademicCalendar(source);
    case "search_announcements":
      return searchAnnouncements(source, {
        query: typeof args["query"] === "string" ? args["query"] : undefined,
      });
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
