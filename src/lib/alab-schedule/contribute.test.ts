import { describe, expect, test } from "bun:test";
import { resetRateLimitsForTests } from "@lib/api/rate-limit";
import {
  alabClassPatch,
  enforceAlabSubmitLimits,
  planAlabContribution,
} from "./contribute";
import type { AlabSchedulePayload } from "./payload";

const payload: AlabSchedulePayload = {
  schemaVersion: 1,
  classes: [
    {
      courseCode: "CS 21",
      section: "A",
      type: "LEC",
      professor: "Dela Cruz, Juan",
      meetings: [
        {
          weekday: "M",
          startTime: "07:00",
          endTime: "08:30",
          room: { code: "A1-101", name: "Comp Lab 1" },
        },
        {
          weekday: "W",
          startTime: "07:00",
          endTime: "08:30",
          room: { code: "a1-101" },
        },
        { weekday: "F", startTime: "10:00", endTime: "11:00" },
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

describe("alabClassPatch", () => {
  test("one patch per entry: all slots kept, room = majority vote", () => {
    const entry = payload.classes[0]!;
    const patch = alabClassPatch(entry, 1261, "hash123");
    expect(patch).toMatchObject({
      courseCode: "CS 21",
      section: "A",
      type: "LEC",
      termId: 1261,
      roomCode: "A1-101",
      roomName: "Comp Lab 1",
      professor: "Dela Cruz, Juan",
      source: "alab-grade-tools",
      studentHash: "hash123",
      dedupeKey: "CS 21|A|LEC|A1-101",
      naturalKey: "CS 21|A|LEC",
    });
    expect(patch.schedule).toEqual([
      "M 07:00AM-08:30AM",
      "W 07:00AM-08:30AM",
      "F 10:00AM-11:00AM",
    ]);
  });

  test("roomless entry gets null room and trailing-empty dedupe key", () => {
    const patch = alabClassPatch(payload.classes[1]!, 1261, "hash123");
    expect(patch.roomCode).toBeNull();
    expect(patch.schedule).toEqual(["Th 01:30PM-03:00PM"]);
    expect(patch.dedupeKey).toBe("BIO 1|B-2L|LAB|");
  });
});

describe("planAlabContribution", () => {
  test("skips published natural keys and pending dedupe keys", () => {
    const plan = planAlabContribution(
      payload,
      1261,
      "hash123",
      new Set(["BIO 1|B-2L|LAB"]),
      new Set(["CS 21|A|LEC|"]),
    );
    // CS 21 pending key has empty room; actual patch room is A1-101, so it is
    // NOT deduped — a different room reaches review as a conflict.
    expect(plan.patches.map((p) => p.dedupeKey)).toEqual([
      "CS 21|A|LEC|A1-101",
    ]);
    expect(plan.skipped).toEqual([
      {
        dedupeKey: "BIO 1|B-2L|LAB|",
        naturalKey: "BIO 1|B-2L|LAB",
        courseCode: "BIO 1",
        section: "B-2L",
        reason: "already_published",
      },
    ]);
  });

  test("same offering + same room dedupes as pending_review", () => {
    const plan = planAlabContribution(
      payload,
      1261,
      "hash123",
      new Set(),
      new Set(["CS 21|A|LEC|A1-101"]),
    );
    expect(plan.patches.map((p) => p.courseCode)).toEqual(["BIO 1"]);
    expect(plan.skipped[0]?.reason).toBe("pending_review");
  });

  test("published check ignores room", () => {
    const plan = planAlabContribution(
      payload,
      1261,
      "hash123",
      new Set(["CS 21|A|LEC"]),
      new Set(),
    );
    expect(plan.patches.map((p) => p.courseCode)).toEqual(["BIO 1"]);
    expect(plan.skipped[0]?.reason).toBe("already_published");
  });

  test("dedupes repeated entries inside one payload", () => {
    const dup: AlabSchedulePayload = {
      schemaVersion: 1,
      classes: [payload.classes[1]!, payload.classes[1]!],
    };
    const plan = planAlabContribution(dup, 1261, "h", new Set(), new Set());
    expect(plan.patches).toHaveLength(1);
    expect(plan.skipped[0]?.reason).toBe("duplicate_in_payload");
  });
});

describe("enforceAlabSubmitLimits", () => {
  test("allows normal traffic, blocks past the student cap", () => {
    resetRateLimitsForTests();
    const now = Date.now();
    for (let i = 0; i < 4; i++) {
      expect(enforceAlabSubmitLimits("1.2.3.4", "student-a", now)).toBeNull();
    }
    const denied = enforceAlabSubmitLimits("1.2.3.4", "student-a", now);
    expect(denied).not.toBeNull();
    // A different student on the same IP still has headroom.
    expect(enforceAlabSubmitLimits("1.2.3.4", "student-b", now)).toBeNull();
    resetRateLimitsForTests();
  });
});
