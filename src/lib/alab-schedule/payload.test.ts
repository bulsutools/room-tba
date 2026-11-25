import { describe, expect, test } from "bun:test";
import {
  alabDedupeKey,
  classScheduleSlots,
  groupMeetingsByRoom,
  meetingToScheduleSlot,
  normalizeAlabWeekday,
  parseAlabSchedulePayload,
  parseAlabTime,
  plannedSectionsFromPayload,
  resolvePayloadTermId,
} from "./payload";

const validPayload = {
  schemaVersion: 1,
  source: "alab-grade-tools",
  term: { id: 1261, schoolYear: "2026-2027", semester: "1" },
  classes: [
    {
      courseCode: "CS 21",
      courseTitle: "Intro to Computing",
      section: "A",
      type: "LEC",
      professor: "Dela Cruz, Juan",
      meetings: [
        {
          weekday: "M",
          startTime: "07:00",
          endTime: "08:30",
          mode: "LEC",
          room: { code: "A1-101", name: "Comp Lab 1" },
        },
        {
          weekday: "W",
          startTime: "07:00",
          endTime: "08:30",
          mode: "LEC",
          room: { code: "a1-101" },
        },
      ],
    },
    {
      courseCode: "BIO 1",
      section: "B-2L",
      type: "LAB",
      meetings: [
        { weekday: "Th", startTime: "13:30", endTime: "15:00", room: null },
      ],
    },
  ],
};

describe("parseAlabSchedulePayload", () => {
  test("accepts a valid v1 payload", () => {
    const result = parseAlabSchedulePayload(validPayload);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.classes).toHaveLength(2);
    expect(result.payload.classes[0]!.meetings).toHaveLength(2);
    expect(result.warnings).toHaveLength(0);
  });

  test("rejects wrong schemaVersion and non-objects", () => {
    expect(parseAlabSchedulePayload(null).ok).toBe(false);
    expect(parseAlabSchedulePayload({ schemaVersion: 2 }).ok).toBe(false);
    expect(parseAlabSchedulePayload({}).ok).toBe(false);
  });

  test("rejects payloads with no usable class entries", () => {
    const result = parseAlabSchedulePayload({
      schemaVersion: 1,
      classes: [{ courseCode: "CS 21" }],
    });
    expect(result.ok).toBe(false);
  });

  test("skips malformed entries into warnings, keeps valid ones", () => {
    const result = parseAlabSchedulePayload({
      schemaVersion: 1,
      classes: [
        { courseCode: "", section: "A", type: "LEC", meetings: [{}] },
        validPayload.classes[0],
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.classes).toHaveLength(1);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test("drops meetings with invalid times or weekdays", () => {
    const result = parseAlabSchedulePayload({
      schemaVersion: 1,
      classes: [
        {
          courseCode: "CS 21",
          section: "A",
          type: "LEC",
          meetings: [
            { weekday: "Funday", startTime: "07:00", endTime: "08:00" },
            { weekday: "M", startTime: "25:00", endTime: "08:00" },
            { weekday: "M", startTime: "08:00", endTime: "07:00" },
          ],
        },
      ],
    });
    expect(result.ok).toBe(false);
  });
});

describe("normalizeAlabWeekday / parseAlabTime", () => {
  test("accepts aliases and full names case-insensitively", () => {
    expect(normalizeAlabWeekday("th")).toBe("Th");
    expect(normalizeAlabWeekday("Thursday")).toBe("Th");
    expect(normalizeAlabWeekday("fri")).toBe("F");
    expect(normalizeAlabWeekday("SU")).toBe("Su");
    expect(normalizeAlabWeekday("X")).toBeNull();
  });

  test("validates 24-hour times", () => {
    expect(parseAlabTime("07:00")).toBe(420);
    expect(parseAlabTime("23:59")).toBe(1439);
    expect(parseAlabTime("24:00")).toBeNull();
    expect(parseAlabTime("7:00")).toBe(420);
    expect(parseAlabTime("07:60")).toBeNull();
    expect(parseAlabTime("noon")).toBeNull();
  });
});

describe("meetingToScheduleSlot / classScheduleSlots", () => {
  test("emits AMIS-style slots", () => {
    expect(
      meetingToScheduleSlot({
        weekday: "M",
        startTime: "07:00",
        endTime: "08:30",
      }),
    ).toBe("M 07:00AM-08:30AM");
    expect(
      meetingToScheduleSlot({
        weekday: "Th",
        startTime: "13:30",
        endTime: "15:00",
      }),
    ).toBe("Th 01:30PM-03:00PM");
    expect(
      meetingToScheduleSlot({
        weekday: "F",
        startTime: "12:00",
        endTime: "13:00",
      }),
    ).toBe("F 12:00PM-01:00PM");
  });

  test("skips Sunday (no grid column) and dedupes slots", () => {
    const entry = {
      courseCode: "CS 21",
      section: "A",
      type: "LEC",
      meetings: [
        { weekday: "Su" as const, startTime: "10:00", endTime: "11:00" },
        { weekday: "M" as const, startTime: "07:00", endTime: "08:30" },
        { weekday: "M" as const, startTime: "07:00", endTime: "08:30" },
      ],
    };
    expect(classScheduleSlots(entry)).toEqual(["M 07:00AM-08:30AM"]);
  });
});

describe("groupMeetingsByRoom", () => {
  test("groups by normalized room code, null room separate", () => {
    const entry = {
      courseCode: "CS 21",
      section: "A",
      type: "LEC",
      meetings: [
        {
          weekday: "M" as const,
          startTime: "07:00",
          endTime: "08:30",
          room: { code: "a1-101", name: "Lab" },
        },
        {
          weekday: "W" as const,
          startTime: "07:00",
          endTime: "08:30",
          room: { code: "A1-101" },
        },
        { weekday: "F" as const, startTime: "10:00", endTime: "11:00" },
      ],
    };
    const groups = groupMeetingsByRoom(entry);
    expect(groups).toHaveLength(2);
    const lab = groups.find((g) => g.roomCode === "A1-101");
    expect(lab?.meetings).toHaveLength(2);
    expect(lab?.roomName).toBe("Lab");
    const online = groups.find((g) => g.roomCode === null);
    expect(online?.meetings).toHaveLength(1);
  });
});

describe("alabDedupeKey", () => {
  test("normalizes case and whitespace, includes room", () => {
    expect(
      alabDedupeKey({
        courseCode: " cs 21 ",
        section: "a",
        type: "lec",
        roomCode: " a1-101 ",
      }),
    ).toBe("CS 21|A|LEC|A1-101");
    expect(
      alabDedupeKey({
        courseCode: "CS 21",
        section: "A",
        type: "LEC",
        roomCode: null,
      }),
    ).toBe("CS 21|A|LEC|");
  });
});

describe("plannedSectionsFromPayload", () => {
  test("flattens classes into planner sections with professor as note", () => {
    const parsed = parseAlabSchedulePayload(validPayload);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const sections = plannedSectionsFromPayload(parsed.payload);
    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({
      courseCode: "CS 21",
      section: "A",
      type: "LEC",
      roomCode: "A1-101",
      courseTitle: "Intro to Computing",
      note: "Dela Cruz, Juan",
    });
    expect(sections[0]!.schedule).toEqual([
      "M 07:00AM-08:30AM",
      "W 07:00AM-08:30AM",
    ]);
    expect(sections[1]!.roomCode).toBeNull();
    expect(sections[1]!.schedule).toEqual(["Th 01:30PM-03:00PM"]);
  });

  test("marks roomless unscheduled entries TBA", () => {
    const sections = plannedSectionsFromPayload({
      schemaVersion: 1,
      classes: [
        {
          courseCode: "CS 21",
          section: "A",
          type: "LEC",
          meetings: [
            { weekday: "Su", startTime: "10:00", endTime: "11:00" },
          ],
        },
      ],
    });
    expect(sections[0]!.schedule).toEqual(["TBA"]);
  });
});

describe("resolvePayloadTermId", () => {
  const terms = [
    { id: 1252, label: "AY 2025-2026 Midyear", schoolYear: "2025-2026", semester: "midyear" },
    { id: 1261, label: "AY 2026-2027 1st Semester", schoolYear: "2026-2027", semester: "1" },
  ];

  test("prefers explicit id, then schoolYear+semester, then label", () => {
    const parsed = parseAlabSchedulePayload(validPayload);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(resolvePayloadTermId(parsed.payload, terms)).toBe(1261);

    const byYear = {
      ...parsed.payload,
      term: { schoolYear: "2025-2026", semester: "midyear" },
    };
    expect(resolvePayloadTermId(byYear, terms)).toBe(1252);

    const byLabel = {
      ...parsed.payload,
      term: { label: "AY 2026-2027 1st Semester" },
    };
    expect(resolvePayloadTermId(byLabel, terms)).toBe(1261);

    const unknown = { ...parsed.payload, term: { id: 9999 } };
    expect(resolvePayloadTermId(unknown, terms)).toBeNull();
    expect(resolvePayloadTermId({ ...parsed.payload, term: undefined }, terms)).toBeNull();
  });
});
