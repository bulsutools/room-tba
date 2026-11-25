import { resolveTermWindow, termWindowStatus } from "./academic-calendar";
import { toManilaDateKey } from "./term-calendar";
import { parseScheduleTime } from "./schedule-renderer";
import {
  formatMinutes,
  tokenizeScheduleDays,
} from "./schedule-import/day-stops";
import type { Weekday } from "./schedule-import/types";
import type { RoomCategory } from "@constants/room-categories";
import type {
  BuildingData,
  ClassMapValue,
  PlaceData,
  RoomData,
  Term,
} from "@lib/types";

/**
 * Deterministic natural-language room finder (#4). No LLM in the critical
 * path: parse a time expression + place/purpose keywords, then rank rooms by
 * name match and distance to the matched place/building anchor.
 *
 * Availability is honest by construction: a room only reads "free"/"busy"
 * when the academic calendar puts the target day inside a term AND the room
 * has parseable schedule rows for that term. Zero rows means "schedule
 * unknown" — never "free".
 */

export type RoomFinderAvailability = "free" | "busy" | "unknown";

export type RoomFinderQuery = {
  /** Minutes since midnight (Asia/Manila) for the requested slot. */
  timeMinutes: number;
  /** True when the text named a time; false = "right now". */
  hasExplicitTime: boolean;
  /** Manila calendar-day offset from today (0 = today, 1 = tomorrow). */
  dayOffset: number;
  /** Remaining free text used to match places, buildings, and rooms. */
  placeText: string;
  /** Room purpose hint mapped to rooms.category, or null. */
  purpose: RoomCategory | null;
  /** True when the input reads as a finder query at all. */
  matched: boolean;
};

export type RoomFinderResult = {
  code: string;
  fullName: string | null;
  buildingName: string | null;
  collegeName: string | null;
  divisionName: string | null;
  category: RoomCategory | null;
  lat: number | null;
  lon: number | null;
  /** Meters from the matched place/building anchor; null without one. */
  distanceM: number | null;
  availability: RoomFinderAvailability;
  /** Human line for the suggestion row, e.g. "Free at 2 PM". */
  availabilityLabel: string;
};

export type RoomFinderResponse = {
  matched: boolean;
  /** Parsed slot echoed back for the UI header, e.g. "Today 2:00 PM". */
  slotLabel: string | null;
  placeLabel: string | null;
  results: RoomFinderResult[];
};

const MAX_RESULTS = 8;

// "2pm", "2:30 pm", "at 2 pm" — checked before the 24h form so "2:30 PM"
// never parses as 14:30 twice.
const TIME_AMPM_RE = /\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i;
// Bare 24h clock: "14:00", "9:30". Requires the colon so room codes and
// section numbers never read as times.
const TIME_24H_RE = /\b([01]?\d|2[0-3]):([0-5]\d)\b/;
const NOON_RE = /\bnoon\b/i;
const TOMORROW_RE = /\btomorrow\b/i;
const TODAY_RE = /\btoday\b/i;

// Purpose words → rooms.category. Ranking hint only, never a hard filter:
// "meeting room" should still surface classrooms when org rooms are far.
const PURPOSE_PATTERNS: [RegExp, RoomCategory][] = [
  [/\b(org|organization|orgs|club|meeting|fiesta)\b/i, "org-tambayan"],
  [
    /\b(lab|labs|laboratory|laboratories|experiment|experiments)\b/i,
    "laboratory",
  ],
  [/\b(office|offices|staff|faculty\s+room)\b/i, "office"],
  [/\b(event|events|venue|auditorium|program)\b/i, "event-venue"],
  [
    /\b(facility|facilities|gym|court|pool|chapel|clinic|health)\b/i,
    "facility",
  ],
  [/\b(study|studying|quiet|review|class|classroom|lecture)\b/i, "classroom"],
];

// Words that carry no place meaning once the intent words are gone.
const FILLER_WORDS = new Set([
  "a",
  "an",
  "the",
  "any",
  "some",
  "find",
  "me",
  "i",
  "can",
  "could",
  "do",
  "does",
  "is",
  "are",
  "there",
  "where",
  "go",
  "going",
  "want",
  "need",
  "get",
  "looking",
  "for",
  "at",
  "around",
  "about",
  "near",
  "by",
  "to",
  "from",
  "in",
  "on",
  "of",
  "and",
  "or",
  "with",
  "please",
  "room",
  "rooms",
  "free",
  "freely",
  "available",
  "availability",
  "empty",
  "vacant",
  "open",
  "slot",
  "space",
  "place",
  "spot",
  "today",
  "tomorrow",
  "tonight",
  "right",
  "now",
  "this",
  "that",
  "it",
  "its",
  "be",
  "been",
]);

// Intent gate: without one of these the query stays a normal entity search
// ("ICS 201" must not become a finder query).
const INTENT_RES = [
  /\b(?:free|available|empty|vacant|open)\s+rooms?\b/i,
  /\brooms?\s+(?:near|by|around|close)\b/i,
  /\b(?:near|around|close\s+to)\s+\S+.*\b(?:at|around|\d)/i,
  /\bfind\s+(?:a\s+|an\s+|me\s+a\s+|me\s+an\s+)?rooms?\b/i,
  /\bwhere\s+(?:can|do|should)\s+i\b/i,
  /\b(?:study|studying|meeting|quiet|review|org|exam)\s+rooms?\b/i,
];

function stripRegexMatches(text: string, re: RegExp): string {
  return text.replace(re, " ");
}

function to24Hour(hour: number, period: string): number {
  const p = period.toLowerCase();
  if (p === "pm" && hour !== 12) return hour + 12;
  if (p === "am" && hour === 12) return 0;
  return hour;
}

/** Manila wall-clock minutes for `date` — the app's "now". */
export function manilaMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  // Intl can emit "24" for midnight under hour12:false on some engines.
  return ((hour % 24) * 60 + minute) % (24 * 60);
}

/** Manila date key for `date` plus `dayOffset` calendar days. */
export function manilaTargetDateKey(date: Date, dayOffset: number): string {
  const base = toManilaDateKey(date);
  const [year = 1970, month = 1, day = 1] = base.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + dayOffset));
  return shifted.toISOString().slice(0, 10);
}

/** Weekday token ("M"…"S") for a Manila date key; null on Sunday. */
export function weekdayForDateKey(dateKey: string): Weekday | null {
  const [year = 1970, month = 1, day = 1] = dateKey.split("-").map(Number);
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  // JS: 0 Sun, 1 Mon … 6 Sat. AMIS schedules have no Sunday token.
  return ([null, "M", "T", "W", "Th", "F", "S"] as const)[jsDay] ?? null;
}

/**
 * Parse free text into a finder query. Returns `matched: false` when the
 * input has no time expression and no room-finder intent words, so plain
 * entity search is untouched.
 */
export function parseRoomFinderQuery(
  raw: string,
  now: Date = new Date(),
): RoomFinderQuery {
  const lower = raw.toLowerCase();
  let rest = ` ${lower} `;

  let timeMinutes: number | null = null;
  let hasExplicitTime = false;

  const ampm = rest.match(TIME_AMPM_RE);
  if (ampm) {
    const hour = to24Hour(parseInt(ampm[1]!, 10), ampm[3]!);
    const minute = ampm[2] ? parseInt(ampm[2], 10) : 0;
    timeMinutes = hour * 60 + minute;
    hasExplicitTime = true;
    rest = stripRegexMatches(rest, TIME_AMPM_RE);
  } else {
    const h24 = rest.match(TIME_24H_RE);
    if (h24) {
      timeMinutes = parseInt(h24[1]!, 10) * 60 + parseInt(h24[2]!, 10);
      hasExplicitTime = true;
      rest = stripRegexMatches(rest, TIME_24H_RE);
    } else if (NOON_RE.test(rest)) {
      timeMinutes = 12 * 60;
      hasExplicitTime = true;
      rest = stripRegexMatches(rest, NOON_RE);
    }
  }

  let dayOffset = 0;
  if (TOMORROW_RE.test(rest)) {
    dayOffset = 1;
    rest = stripRegexMatches(rest, TOMORROW_RE);
  } else if (TODAY_RE.test(rest)) {
    rest = stripRegexMatches(rest, TODAY_RE);
  }

  let purpose: RoomCategory | null = null;
  for (const [re, category] of PURPOSE_PATTERNS) {
    if (re.test(rest)) {
      purpose = category;
      rest = rest.replace(new RegExp(re.source, "gi"), " ");
      break;
    }
  }

  const intentHit = INTENT_RES.some((re) => re.test(lower));
  const matched = hasExplicitTime || intentHit;
  if (!matched) {
    return {
      timeMinutes: manilaMinutes(now),
      hasExplicitTime: false,
      dayOffset,
      placeText: "",
      purpose: null,
      matched: false,
    };
  }

  // What remains after intent/time/purpose words are removed is the
  // place or area reference ("near the library" → "library").
  const placeText = rest
    .split(/[^a-z0-9]+/)
    .filter((token) => token !== "" && !FILLER_WORDS.has(token))
    .join(" ")
    .trim();

  return {
    timeMinutes: timeMinutes ?? manilaMinutes(now),
    hasExplicitTime,
    dayOffset,
    placeText,
    purpose,
    matched: true,
  };
}

/** Great-circle distance in meters. */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

/** Relevance of `needle` inside `name`; mirrors search-suggestions scoring. */
function nameScore(
  name: string | null | undefined,
  needle: string,
): number | null {
  if (!name || needle === "") return null;
  const haystack = name.toLowerCase();
  if (haystack === needle || haystack.includes(`(${needle})`)) return 0;
  const index = haystack.indexOf(needle);
  if (index === -1) return null;
  const before = index === 0 ? "" : haystack.charAt(index - 1);
  return before === "" || !/[a-z0-9]/.test(before) ? 1 : 2;
}

/** Best name-match score across a room's searchable labels. */
function roomTextScore(room: RoomData, needle: string): number | null {
  if (needle === "") return 0;
  const scores = [
    nameScore(room.code, needle),
    nameScore(room.fullName, needle),
    nameScore(room.building?.name, needle),
    nameScore(room.collegeName, needle),
    nameScore(room.divisionName, needle),
  ].filter((s): s is number => s !== null);
  return scores.length ? Math.min(...scores) : null;
}

export type RoomFinderAnchor = {
  name: string;
  lat: number;
  lon: number;
};

/** Best place/building anchor for the free-text place reference. */
export function matchRoomFinderAnchor(
  placeText: string,
  anchors: RoomFinderAnchor[],
): RoomFinderAnchor | null {
  if (placeText === "") return null;
  let best: { anchor: RoomFinderAnchor; score: number } | null = null;
  for (const anchor of anchors) {
    const score = nameScore(anchor.name, placeText.toLowerCase());
    if (score === null) continue;
    if (!best || score < best.score) best = { anchor, score };
  }
  return best?.anchor ?? null;
}

export type RoomFinderAvailabilityInfo = {
  availability: RoomFinderAvailability;
  label: string;
};

/**
 * Busy/free check for one room at `timeMinutes` on `weekday`.
 * `rows` are the room's class rows for the resolved term only.
 */
export function roomAvailabilityAt(
  rows: ClassMapValue[],
  weekday: Weekday | null,
  timeMinutes: number,
  hasExplicitTime: boolean,
): RoomFinderAvailabilityInfo {
  if (rows.length === 0) {
    // No schedule rows for the term: we cannot tell "no classes" from
    // "not imported". Report unknown — never fabricate "free".
    return { availability: "unknown", label: "Schedule unknown" };
  }

  let sawParseableSlot = false;
  for (const row of rows) {
    for (const slot of row.schedule ?? []) {
      const parsed = parseScheduleTime(slot);
      if (!parsed) continue;
      sawParseableSlot = true;
      if (weekday === null) continue;
      if (!tokenizeScheduleDays(parsed.days ?? "").includes(weekday)) continue;
      if (
        timeMinutes >= parsed.startMinutes &&
        timeMinutes < parsed.endMinutes
      ) {
        return {
          availability: "busy",
          label: hasExplicitTime
            ? `Busy at ${formatMinutes(timeMinutes)}`
            : "Busy now",
        };
      }
    }
  }

  if (!sawParseableSlot) {
    return { availability: "unknown", label: "Schedule unknown" };
  }
  return {
    availability: "free",
    label: hasExplicitTime
      ? `Free at ${formatMinutes(timeMinutes)}`
      : "Free now",
  };
}

function normalizeCategory(
  value: string | null | undefined,
): RoomCategory | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  return (
    [
      "classroom",
      "laboratory",
      "office",
      "org-tambayan",
      "event-venue",
      "facility",
    ] as const
  ).includes(v as RoomCategory)
    ? (v as RoomCategory)
    : null;
}

/** Term whose instructional window contains `dateKey` (Asia/Manila), or null. */
export function inSessionTermForDate(
  terms: Term[],
  dateKey: string,
): Term | null {
  const targetDate = new Date(`${dateKey}T12:00:00+08:00`);
  return (
    terms
      .filter((term) => term.isActive)
      .map((term) => ({ term, window: resolveTermWindow(term) }))
      .filter(
        (
          entry,
        ): entry is {
          term: Term;
          window: { startsOn: string; endsOn: string };
        } =>
          entry.window !== null &&
          termWindowStatus(entry.window, targetDate) === "in-session",
      )
      .sort(
        (a, b) => b.term.sortOrder - a.term.sortOrder || b.term.id - a.term.id,
      )[0]?.term ?? null
  );
}

/**
 * Rank rooms for a parsed finder query.
 *
 * `classes` should be scoped to the term resolved for the target date; rows
 * from other terms are ignored defensively. Pass [] when the academic
 * calendar says no term is in session (every room then reads "No classes in
 * session" — a calendar fact, not a guess).
 */
export function buildRoomFinderResults(
  query: RoomFinderQuery,
  data: {
    rooms: RoomData[];
    classes: ClassMapValue[];
    places: PlaceData[];
    buildings: BuildingData[];
    /** Active terms with windows; used to confirm the target day is in session. */
    terms: Term[];
    now?: Date;
  },
): RoomFinderResult[] {
  const now = data.now ?? new Date();
  const dateKey = manilaTargetDateKey(now, query.dayOffset);
  const weekday = weekdayForDateKey(dateKey);

  // Calendar gate: only trust schedules inside a term window. Outside one,
  // "no classes" is a fact from the academic calendar, so rooms read free.
  const inSessionTerm = inSessionTermForDate(data.terms, dateKey);
  const noSession = inSessionTerm === null;

  const classesByRoom = new Map<string, ClassMapValue[]>();
  for (const cls of data.classes) {
    if (inSessionTerm !== null && cls.termId !== inSessionTerm.id) continue;
    const code = cls.roomCode?.trim().toUpperCase();
    if (!code) continue;
    const list = classesByRoom.get(code) ?? [];
    list.push(cls);
    classesByRoom.set(code, list);
  }

  const anchors: RoomFinderAnchor[] = [
    ...data.places
      .filter((p) => p.lat != null && p.lon != null)
      .map((p) => ({
        name: p.name,
        lat: p.lat as number,
        lon: p.lon as number,
      })),
    ...data.buildings.map((b) => ({
      name: b.buildingName,
      lat: b.lat,
      lon: b.lon,
    })),
  ];
  const anchor = matchRoomFinderAnchor(query.placeText, anchors);

  const needle = query.placeText.toLowerCase();
  const ranked: { result: RoomFinderResult; sortKey: (number | string)[] }[] =
    [];

  for (const room of data.rooms) {
    const textScore = roomTextScore(room, needle);
    const buildingLat = room.building?.lat ?? null;
    const buildingLon = room.building?.lon ?? null;
    const hasCoords = buildingLat != null && buildingLon != null;
    const distanceM =
      anchor && buildingLat != null && buildingLon != null
        ? distanceMeters(anchor.lat, anchor.lon, buildingLat, buildingLon)
        : null;

    // With a place reference, rooms must either sit near the anchor or match
    // the text; otherwise "near the library" would return the whole campus.
    if (needle !== "" && anchor === null && textScore === null) continue;

    const category = normalizeCategory(room.category);
    const purposePenalty =
      query.purpose !== null && category !== query.purpose ? 1 : 0;

    let availability: RoomFinderAvailability;
    let availabilityLabel: string;
    if (noSession) {
      availability = "free";
      availabilityLabel = "No classes in session";
    } else {
      const info = roomAvailabilityAt(
        classesByRoom.get(room.code.trim().toUpperCase()) ?? [],
        weekday,
        query.timeMinutes,
        query.hasExplicitTime,
      );
      availability = info.availability;
      availabilityLabel = info.label;
    }

    // Sort tuple (ascending): anchor distance first when a place was named,
    // then text relevance, purpose hint, availability, room code.
    const sortKey: (number | string)[] = anchor
      ? [
          distanceM ?? Number.MAX_SAFE_INTEGER,
          textScore ?? 99,
          purposePenalty,
          availability === "free" ? 0 : availability === "unknown" ? 1 : 2,
          room.code.toLowerCase(),
        ]
      : [
          textScore ?? 99,
          purposePenalty,
          distanceM ?? Number.MAX_SAFE_INTEGER,
          availability === "free" ? 0 : availability === "unknown" ? 1 : 2,
          room.code.toLowerCase(),
        ];

    ranked.push({
      sortKey,
      result: {
        code: room.code,
        fullName: room.fullName ?? null,
        buildingName: room.building?.name ?? null,
        collegeName: room.collegeName ?? null,
        divisionName: room.divisionName ?? null,
        category,
        lat: hasCoords ? buildingLat : null,
        lon: hasCoords ? buildingLon : null,
        distanceM: distanceM === null ? null : Math.round(distanceM),
        availability,
        availabilityLabel,
      },
    });
  }

  return ranked
    .sort((a, b) => {
      for (
        let i = 0;
        i < Math.max(a.sortKey.length, b.sortKey.length);
        i += 1
      ) {
        const av = a.sortKey[i];
        const bv = b.sortKey[i];
        if (av === bv) continue;
        if (av === undefined) return 1;
        if (bv === undefined) return -1;
        if (typeof av === "number" && typeof bv === "number") return av - bv;
        return String(av).localeCompare(String(bv));
      }
      return 0;
    })
    .slice(0, MAX_RESULTS)
    .map(({ result }) => result);
}

function formatSlotLabel(dateKey: string, timeMinutes: number): string {
  const day = weekdayForDateKey(dateKey);
  const dayLabel =
    day === null
      ? "Sun"
      : (
          {
            M: "Mon",
            T: "Tue",
            W: "Wed",
            Th: "Thu",
            F: "Fri",
            S: "Sat",
          } as const
        )[day];
  return `${dayLabel} ${formatMinutes(timeMinutes)}`;
}

/** Full pipeline used by the API route: parse, then rank against live data. */
export function runRoomFinder(
  rawQuery: string,
  data: Parameters<typeof buildRoomFinderResults>[1],
): RoomFinderResponse {
  const query = parseRoomFinderQuery(rawQuery, data.now);
  if (!query.matched) {
    return { matched: false, slotLabel: null, placeLabel: null, results: [] };
  }
  const dateKey = manilaTargetDateKey(data.now ?? new Date(), query.dayOffset);
  return {
    matched: true,
    slotLabel: formatSlotLabel(dateKey, query.timeMinutes),
    placeLabel: query.placeText === "" ? null : query.placeText,
    results: buildRoomFinderResults(query, data),
  };
}
