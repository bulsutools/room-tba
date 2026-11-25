/**
 * ALAB schedule payload v1 — shared contract for the GradeSim/ALAB bridge
 * (docs/alab-schedule-bridge.md, docs/alab-schedule-payload.v1.schema.json).
 *
 * Pure module: no node or Astro imports, safe for client (fragment import)
 * and server (contribution endpoint) use.
 */
import type { PlannedSection } from "@lib/planner/types";

export const ALAB_SCHEDULE_SCHEMA_VERSION = 1;

export type AlabWeekday = "M" | "T" | "W" | "Th" | "F" | "S" | "Su";

export type AlabRoom = {
  code: string;
  name?: string;
};

export type AlabMeeting = {
  weekday: AlabWeekday;
  /** 24-hour "HH:MM". */
  startTime: string;
  endTime: string;
  mode?: string;
  isOnline?: boolean;
  room?: AlabRoom | null;
};

export type AlabClassEntry = {
  courseCode: string;
  courseTitle?: string;
  section: string;
  /** Component type, e.g. "LEC" | "LAB" | "SEM". */
  type: string;
  professor?: string;
  isOnline?: boolean;
  meetings: AlabMeeting[];
};

export type AlabScheduleTerm = {
  id?: number;
  label?: string;
  schoolYear?: string;
  semester?: string;
};

export type AlabSchedulePayload = {
  schemaVersion: typeof ALAB_SCHEDULE_SCHEMA_VERSION;
  source?: string;
  exportedAt?: string;
  term?: AlabScheduleTerm;
  classes: AlabClassEntry[];
};

// Column widths in drizzle/schema.ts `classes` — reject rather than let
// Postgres varchar(n) error on insert.
const MAX_COURSE_CODE = 16;
const MAX_SECTION = 16;
const MAX_TYPE = 12;
const MAX_TITLE = 200;
const MAX_PROFESSOR = 120;
const MAX_ROOM_CODE = 32;
const MAX_ROOM_NAME = 120;
const MAX_CLASSES = 100;
const MAX_MEETINGS_PER_CLASS = 20;

const WEEKDAY_ALIASES: Record<string, AlabWeekday> = {
  M: "M",
  MON: "M",
  MONDAY: "M",
  T: "T",
  TUE: "T",
  TUES: "T",
  TUESDAY: "T",
  W: "W",
  WED: "W",
  WEDNESDAY: "W",
  TH: "Th",
  THU: "Th",
  THURS: "Th",
  THURSDAY: "Th",
  F: "F",
  FRI: "F",
  FRIDAY: "F",
  S: "S",
  SAT: "S",
  SATURDAY: "S",
  SU: "Su",
  SUN: "Su",
  SUNDAY: "Su",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asTrimmedString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max) return null;
  return trimmed;
}

export function normalizeAlabWeekday(value: unknown): AlabWeekday | null {
  const raw = asTrimmedString(value, 16);
  if (!raw) return null;
  return WEEKDAY_ALIASES[raw.toUpperCase()] ?? null;
}

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

/** "HH:MM" 24-hour → minutes since midnight, or null. */
export function parseAlabTime(value: unknown): number | null {
  const raw = asTrimmedString(value, 8);
  if (!raw) return null;
  const match = TIME_RE.exec(raw);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function format12(minutes: number): string {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  let hour12 = hour24 % 12;
  if (hour12 === 0) hour12 = 12;
  // AMIS slots zero-pad the hour ("07:00AM"); keep the same shape.
  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")}${period}`;
}

function parseMeeting(value: unknown): AlabMeeting | null {
  const row = asRecord(value);
  if (!row) return null;
  const weekday = normalizeAlabWeekday(row["weekday"]);
  const start = parseAlabTime(row["startTime"]);
  const end = parseAlabTime(row["endTime"]);
  if (!weekday || start === null || end === null || end <= start) return null;

  const meeting: AlabMeeting = {
    weekday,
    startTime: row["startTime"] as string,
    endTime: row["endTime"] as string,
  };
  const mode = asTrimmedString(row["mode"], MAX_TYPE);
  if (mode) meeting.mode = mode.toUpperCase();
  if (typeof row["isOnline"] === "boolean") meeting.isOnline = row["isOnline"];

  const room = asRecord(row["room"]);
  if (room) {
    const code = asTrimmedString(room["code"], MAX_ROOM_CODE);
    if (code) {
      const name = asTrimmedString(room["name"], MAX_ROOM_NAME);
      meeting.room = name ? { code, name } : { code };
    }
  }
  return meeting;
}

function parseClassEntry(
  value: unknown,
): { entry: AlabClassEntry } | { error: string } {
  const row = asRecord(value);
  if (!row) return { error: "class entry is not an object" };

  const courseCode = asTrimmedString(row["courseCode"], MAX_COURSE_CODE);
  const section = asTrimmedString(row["section"], MAX_SECTION);
  const type = asTrimmedString(row["type"], MAX_TYPE);
  if (!courseCode) return { error: "missing courseCode" };
  if (!section) return { error: `${courseCode}: missing section` };
  if (!type) return { error: `${courseCode} ${section}: missing type` };
  if (!Array.isArray(row["meetings"]) || row["meetings"].length === 0) {
    return { error: `${courseCode} ${section}: no meetings` };
  }
  if (row["meetings"].length > MAX_MEETINGS_PER_CLASS) {
    return { error: `${courseCode} ${section}: too many meetings` };
  }

  const meetings: AlabMeeting[] = [];
  for (const raw of row["meetings"]) {
    const meeting = parseMeeting(raw);
    if (meeting) meetings.push(meeting);
  }
  if (meetings.length === 0) {
    return { error: `${courseCode} ${section}: no valid meetings` };
  }

  const entry: AlabClassEntry = {
    courseCode,
    section,
    type: type.toUpperCase(),
    meetings,
  };
  const courseTitle = asTrimmedString(row["courseTitle"], MAX_TITLE);
  if (courseTitle) entry.courseTitle = courseTitle;
  const professor = asTrimmedString(row["professor"], MAX_PROFESSOR);
  if (professor) entry.professor = professor;
  if (typeof row["isOnline"] === "boolean") entry.isOnline = row["isOnline"];
  return { entry };
}

export type AlabPayloadParseResult =
  | { ok: true; payload: AlabSchedulePayload; warnings: string[] }
  | { ok: false; error: string };

/**
 * Validate an unknown value as an ALAB schedule payload v1. Malformed top-level
 * shape fails; individual bad class entries are skipped into `warnings` so one
 * bad row cannot sink a whole export.
 */
export function parseAlabSchedulePayload(
  value: unknown,
): AlabPayloadParseResult {
  const row = asRecord(value);
  if (!row) return { ok: false, error: "Payload is not a JSON object." };
  if (row["schemaVersion"] !== ALAB_SCHEDULE_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Unsupported schemaVersion (expected ${ALAB_SCHEDULE_SCHEMA_VERSION}).`,
    };
  }
  if (!Array.isArray(row["classes"]) || row["classes"].length === 0) {
    return { ok: false, error: "Payload has no classes." };
  }
  if (row["classes"].length > MAX_CLASSES) {
    return { ok: false, error: `Too many classes (max ${MAX_CLASSES}).` };
  }

  const payload: AlabSchedulePayload = {
    schemaVersion: ALAB_SCHEDULE_SCHEMA_VERSION,
    classes: [],
  };
  const source = asTrimmedString(row["source"], 64);
  if (source) payload.source = source;
  const exportedAt = asTrimmedString(row["exportedAt"], 64);
  if (exportedAt) payload.exportedAt = exportedAt;

  const term = asRecord(row["term"]);
  if (term) {
    const parsed: AlabScheduleTerm = {};
    if (typeof term["id"] === "number" && Number.isInteger(term["id"]) && term["id"] > 0) {
      parsed.id = term["id"];
    }
    const label = asTrimmedString(term["label"], 120);
    if (label) parsed.label = label;
    const schoolYear = asTrimmedString(term["schoolYear"], 16);
    if (schoolYear) parsed.schoolYear = schoolYear;
    const semester = asTrimmedString(term["semester"], 12);
    if (semester) parsed.semester = semester;
    if (Object.keys(parsed).length > 0) payload.term = parsed;
  }

  const warnings: string[] = [];
  for (const raw of row["classes"]) {
    const result = parseClassEntry(raw);
    if ("entry" in result) {
      payload.classes.push(result.entry);
    } else {
      warnings.push(result.error);
    }
  }
  if (payload.classes.length === 0) {
    return { ok: false, error: "No valid class entries in payload." };
  }
  return { ok: true, payload, warnings };
}

/** AMIS-style schedule slot for one meeting, e.g. "M 07:00AM-08:30AM". */
export function meetingToScheduleSlot(meeting: AlabMeeting): string | null {
  // The app grid covers M-S; Sunday has no column.
  if (meeting.weekday === "Su") return null;
  const start = parseAlabTime(meeting.startTime);
  const end = parseAlabTime(meeting.endTime);
  if (start === null || end === null) return null;
  return `${meeting.weekday} ${format12(start)}-${format12(end)}`;
}

export function classScheduleSlots(entry: AlabClassEntry): string[] {
  const slots = entry.meetings
    .map(meetingToScheduleSlot)
    .filter((slot): slot is string => slot !== null);
  return [...new Set(slots)];
}

/** Room key used for grouping + dedupe; "" means no room reported. */
export function normalizeRoomCode(code: string | null | undefined): string {
  return (code ?? "").trim().toUpperCase();
}

export type AlabRoomGroup = {
  roomCode: string | null;
  roomName: string | null;
  meetings: AlabMeeting[];
};

/**
 * Split a class entry's meetings by room so each group maps to one `classes`
 * row (the table holds a single roomId per row).
 */
export function groupMeetingsByRoom(entry: AlabClassEntry): AlabRoomGroup[] {
  const groups = new Map<string, AlabRoomGroup>();
  for (const meeting of entry.meetings) {
    const code = normalizeRoomCode(meeting.room?.code);
    const existing = groups.get(code);
    if (existing) {
      existing.meetings.push(meeting);
    } else {
      groups.set(code, {
        roomCode: code || null,
        roomName: meeting.room?.name?.trim() || null,
        meetings: [meeting],
      });
    }
  }
  return [...groups.values()];
}

/** Dedupe key for dataset contributions: course + section + type + room. */
export function alabDedupeKey(parts: {
  courseCode: string;
  section: string;
  type: string;
  roomCode: string | null;
}): string {
  return [
    parts.courseCode.trim().toUpperCase(),
    parts.section.trim().toUpperCase(),
    parts.type.trim().toUpperCase(),
    normalizeRoomCode(parts.roomCode),
  ].join("|");
}

/** Flatten payload classes into planner sections for the personal view. */
export function plannedSectionsFromPayload(
  payload: AlabSchedulePayload,
): PlannedSection[] {
  const sections: PlannedSection[] = [];
  for (const entry of payload.classes) {
    for (const group of groupMeetingsByRoom(entry)) {
      const schedule = group.meetings
        .map(meetingToScheduleSlot)
        .filter((slot): slot is string => slot !== null);
      const unique = [...new Set(schedule)];
      sections.push({
        courseCode: entry.courseCode,
        section: entry.section,
        type: entry.type,
        // "TBA" marks unscheduled rows the same way AMIS imports do.
        schedule: unique.length > 0 ? unique : ["TBA"],
        roomCode: group.roomCode,
        courseTitle: entry.courseTitle ?? null,
        note: entry.professor ?? undefined,
      });
    }
  }
  return sections;
}

type TermLike = {
  id: number;
  label?: string | null;
  schoolYear?: string | null;
  semester?: string | null;
};

/**
 * Resolve the payload's term to a Room TBA terms.id: explicit id first, then
 * schoolYear+semester, then exact label. Null when nothing matches.
 */
export function resolvePayloadTermId(
  payload: AlabSchedulePayload,
  terms: TermLike[],
): number | null {
  const term = payload.term;
  if (!term) return null;
  if (term["id"] != null) {
    const byId = terms.find((t) => t.id === term["id"]);
    if (byId) return byId.id;
  }
  if (term["schoolYear"] && term["semester"]) {
    const byYearSemester = terms.find(
      (t) =>
        t.schoolYear === term["schoolYear"] && t.semester === term["semester"],
    );
    if (byYearSemester) return byYearSemester.id;
  }
  if (term["label"]) {
    const byLabel = terms.find((t) => t.label === term["label"]);
    if (byLabel) return byLabel.id;
  }
  return null;
}
