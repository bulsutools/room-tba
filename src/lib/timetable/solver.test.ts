import { describe, expect, it } from "bun:test";
import type { ClassMapValue } from "@lib/types";
import { offeringsFromClasses } from "./candidates.js";
import { solveTimetable } from "./solver.js";
import type { TimetableConstraints } from "./types.js";

let nextId = 1;
function row(
  overrides: Partial<ClassMapValue> &
    Pick<ClassMapValue, "courseCode" | "section" | "type">,
): ClassMapValue {
  return {
    id: nextId++,
    courseCode: overrides.courseCode,
    section: overrides.section,
    type: overrides.type,
    schedule: overrides.schedule ?? null,
    roomCode: overrides.roomCode ?? null,
    directions: null,
    courseTitle: overrides.courseTitle ?? null,
    roomId: null,
    termId: 1252,
    ...overrides,
  };
}

/**
 * Fixture timetable: three courses, two sections each. CMSC 128 "A" and
 * MATH 27 "X" overlap on MWF mornings, so no proposal may pair them.
 */
function fixtureRows(): ClassMapValue[] {
  return [
    row({
      courseCode: "CMSC 128",
      section: "A",
      type: "LEC",
      schedule: ["MWF 08:00AM-09:00AM"],
      roomCode: "ENG-301",
      courseTitle: "Introduction to Computing",
    }),
    row({
      courseCode: "CMSC 128",
      section: "A",
      type: "LAB",
      schedule: ["F 01:00PM-04:00PM"],
      roomCode: "ENG-110",
      courseTitle: "Introduction to Computing",
    }),
    row({
      courseCode: "CMSC 128",
      section: "B",
      type: "LEC",
      schedule: ["TTh 10:00AM-11:30AM"],
      roomCode: "ENG-302",
      courseTitle: "Introduction to Computing",
    }),
    row({
      courseCode: "MATH 27",
      section: "X",
      type: "LEC",
      schedule: ["MWF 08:30AM-09:30AM"],
      roomCode: "SCI-201",
      courseTitle: "Calculus",
    }),
    row({
      courseCode: "MATH 27",
      section: "Y",
      type: "LEC",
      schedule: ["TTh 13:00PM-14:30PM"],
      roomCode: "SCI-202",
      courseTitle: "Calculus",
    }),
    row({
      courseCode: "PHILO 1",
      section: "P",
      type: "LEC",
      schedule: ["MW 02:00PM-03:30PM"],
      roomCode: "HUM-101",
      courseTitle: "Introduction to Philosophy",
    }),
    row({
      courseCode: "PHILO 1",
      section: "Q",
      type: "LEC",
      schedule: ["TTh 03:30PM-05:00PM"],
      roomCode: "HUM-102",
      courseTitle: "Introduction to Philosophy",
    }),
  ];
}

const FIXTURE_COURSES = ["CMSC 128", "MATH 27", "PHILO 1"];

const ROOM_BUILDINGS = new Map([
  ["ENG-301", "Engineering"],
  ["ENG-110", "Engineering"],
  ["ENG-302", "Engineering"],
  ["SCI-201", "Science"],
  ["SCI-202", "Science"],
  ["HUM-101", "Humanities"],
  ["HUM-102", "Humanities"],
]);

function fixtureCandidates() {
  return offeringsFromClasses(fixtureRows(), ROOM_BUILDINGS);
}

function keysOf(proposal: { picks: { key: string }[] }) {
  return proposal.picks.map((p) => p.key).sort();
}

describe("offeringsFromClasses", () => {
  it("merges LEC+LAB rows of one section into a single candidate", () => {
    const candidates = fixtureCandidates();
    const cmscA = candidates.find((c) => c.key === "CMSC 128::A");
    expect(cmscA).toBeDefined();
    // MWF lecture + Friday lab = 4 blocks.
    expect(cmscA?.blocks).toHaveLength(4);
    expect(cmscA?.unscheduled).toBe(false);
    expect(cmscA?.roomCodes).toEqual(["ENG-110", "ENG-301"]);
    expect(cmscA?.buildings).toEqual(["Engineering"]);
  });

  it("marks TBA offerings unscheduled so the solver skips them", () => {
    const candidates = offeringsFromClasses([
      row({
        courseCode: "GEED 1",
        section: "Z",
        type: "LEC",
        schedule: ["TBA"],
      }),
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].unscheduled).toBe(true);
    expect(candidates[0].blocks).toHaveLength(0);
  });

  it("counts overlaps between component rows as internal conflicts", () => {
    const candidates = offeringsFromClasses([
      row({
        courseCode: "X 1",
        section: "A",
        type: "LEC",
        schedule: ["MWF 08:00AM-09:00AM"],
      }),
      row({
        courseCode: "X 1",
        section: "A",
        type: "LAB",
        schedule: ["M 08:30AM-10:00AM"],
      }),
    ]);
    expect(candidates[0].internalConflicts).toBe(1);
  });
});

describe("solveTimetable", () => {
  it("produces conflict-free proposals for the fixture dataset", () => {
    const result = solveTimetable({
      requiredCourses: FIXTURE_COURSES,
      candidates: fixtureCandidates(),
    });
    expect(result.uncoveredCourses).toEqual([]);
    expect(result.proposals.length).toBeGreaterThan(0);

    for (const proposal of result.proposals) {
      const seen = new Set<string>();
      for (const pick of proposal.picks) {
        for (const block of pick.blocks) {
          const sig = `${block.dayIndex}:${block.startMin}-${block.endMin}`;
          // Same course never self-conflicts; different courses must not share
          // a slot. Track per-course occupancy instead.
          expect(seen.has(sig)).toBe(false);
          seen.add(sig);
        }
      }
      // No proposal may pair CMSC 128 "A" (MWF 8-9) with MATH 27 "X"
      // (MWF 8:30-9:30).
      const keys = keysOf(proposal);
      expect(keys).not.toContain("CMSC 128::A|MATH 27::X");
      const hasA = keys.includes("CMSC 128::A");
      const hasX = keys.includes("MATH 27::X");
      expect(hasA && hasX).toBe(false);
    }
  });

  it("is deterministic: identical inputs give identical proposals", () => {
    const input = {
      requiredCourses: FIXTURE_COURSES,
      candidates: fixtureCandidates(),
    };
    const a = solveTimetable(input);
    const b = solveTimetable(input);
    expect(keysOfAll(a.proposals)).toEqual(keysOfAll(b.proposals));
    expect(a.proposals.map((p) => p.score)).toEqual(
      b.proposals.map((p) => p.score),
    );
  });

  it("respects allowedDays: TTh-only constraint yields only TTh sections", () => {
    const constraints: TimetableConstraints = { allowedDays: [1, 3] };
    const result = solveTimetable({
      requiredCourses: FIXTURE_COURSES,
      candidates: fixtureCandidates(),
      constraints,
    });
    // CMSC 128 has no TTh-only... it does: section B is TTh. MATH Y and
    // PHILO Q are TTh; PHILO P is MW -> excluded.
    for (const proposal of result.proposals) {
      for (const pick of proposal.picks) {
        for (const block of pick.blocks) {
          expect([1, 3]).toContain(block.dayIndex);
        }
      }
      expect(keysOf(proposal)).not.toContain("PHILO 1::P");
    }
    expect(result.proposals.length).toBeGreaterThan(0);
  });

  it("respects maxDaysOnCampus", () => {
    const result = solveTimetable({
      requiredCourses: FIXTURE_COURSES,
      candidates: fixtureCandidates(),
      constraints: { maxDaysOnCampus: 2 },
    });
    for (const proposal of result.proposals) {
      expect(proposal.daysOnCampus).toBeLessThanOrEqual(2);
    }
  });

  it("honors recurring weekly blackout windows", () => {
    const result = solveTimetable({
      requiredCourses: FIXTURE_COURSES,
      candidates: fixtureCandidates(),
      constraints: {
        // Friday 13:00-16:00 blocked kills CMSC 128 "A" (F lab) entirely.
        blockedWindows: [{ dayIndex: 4, startMin: 13 * 60, endMin: 16 * 60 }],
      },
    });
    for (const proposal of result.proposals) {
      expect(keysOf(proposal)).not.toContain("CMSC 128::A");
    }
    expect(result.proposals.length).toBeGreaterThan(0);
  });

  it("ranks preferred-building and preferred-section picks higher", () => {
    const constraints: TimetableConstraints = {
      preferredBuildings: ["Engineering"],
      preferredSections: { "MATH 27": "Y", "PHILO 1": "Q" },
    };
    const result = solveTimetable({
      requiredCourses: FIXTURE_COURSES,
      candidates: fixtureCandidates(),
      constraints,
      maxProposals: 1,
    });
    const top = result.proposals[0];
    expect(top).toBeDefined();
    const keys = keysOf(top);
    // Only CMSC 128 A and B are in Engineering; MATH/PHILO picks should match
    // the preferred sections for the bonus.
    expect(keys).toContain("MATH 27::Y");
    expect(keys).toContain("PHILO 1::Q");
    expect(top.score).toBeGreaterThan(0);
    expect(top.notes.join(" ")).toContain("preferred buildings");
  });

  it("reports uncovered courses instead of emitting partial plans", () => {
    const result = solveTimetable({
      requiredCourses: ["CMSC 128", "NOPE 9"],
      candidates: fixtureCandidates(),
    });
    expect(result.proposals).toEqual([]);
    expect(result.uncoveredCourses).toEqual(["NOPE 9"]);
  });

  it("never proposes offerings whose own components conflict", () => {
    const candidates = offeringsFromClasses([
      row({
        courseCode: "X 1",
        section: "A",
        type: "LEC",
        schedule: ["MWF 08:00AM-09:00AM"],
      }),
      row({
        courseCode: "X 1",
        section: "A",
        type: "LAB",
        schedule: ["M 08:30AM-10:00AM"],
      }),
      row({
        courseCode: "Y 1",
        section: "B",
        type: "LEC",
        schedule: ["TTh 10:00AM-11:00AM"],
      }),
    ]);
    const result = solveTimetable({
      requiredCourses: ["X 1", "Y 1"],
      candidates,
    });
    expect(result.proposals).toEqual([]);
    expect(result.uncoveredCourses).toEqual(["X 1"]);
  });
});

function keysOfAll(proposals: { picks: { key: string }[] }[]) {
  return proposals.map((p) => keysOf(p).join(","));
}
