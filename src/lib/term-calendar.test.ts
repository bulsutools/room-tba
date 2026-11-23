import { describe, expect, it, test } from "bun:test";
import {
  changeOfMatriculationLabel,
  changeOfMatriculationPeriod,
  formatDateRange,
  finalsWindowLabel,
  isDateWithinTerm,
  isFinalsWeek,
  resolveActiveTermByDate,
  resolveInitialTermId,
} from "./term-calendar";
import type { Term } from "./types";

function term(id: number, overrides: Partial<Term> = {}): Term {
  const semester =
    id === 1253 ? "midyear" : id === 1252 ? "2" : String(id - 1250);
  return {
    id,
    label: `Term ${id}`,
    schoolYear: "2025-2026",
    semester,
    startsOn: null,
    endsOn: null,
    isDefault: id === 1253,
    isActive: true,
    sortOrder: id,
    version: 1,
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

const MIDYEAR_1253 = {
  startsOn: "2026-06-08",
  endsOn: "2026-07-26",
} as const;

const SECOND_SEM_1252 = {
  startsOn: "2026-01-19",
  endsOn: "2026-05-31",
  finalsStartsOn: "2026-05-15",
  finalsEndsOn: "2026-05-22",
} as const;

describe("term-calendar", () => {
  it("detects midyear from Manila calendar date", () => {
    const midyear = term(1253, MIDYEAR_1253);
    expect(
      isDateWithinTerm(midyear, new Date("2026-06-29T12:00:00+08:00")),
    ).toBe(true);
    expect(
      isDateWithinTerm(midyear, new Date("2026-08-01T12:00:00+08:00")),
    ).toBe(false);
  });

  it("resolves the in-session term for today", () => {
    const terms = [
      term(1251, { startsOn: "2025-09-01", endsOn: "2025-12-20" }),
      term(1252, SECOND_SEM_1252),
      term(1253, MIDYEAR_1253),
    ];
    expect(
      resolveActiveTermByDate(terms, new Date("2026-06-29T08:00:00+08:00"))?.id,
    ).toBe(1253);
    expect(
      resolveActiveTermByDate(terms, new Date("2026-03-15T08:00:00+08:00"))?.id,
    ).toBe(1252);
  });

  it("handles postgres timestamp strings in UTC", () => {
    const midyear = term(1253, {
      startsOn: "2026-06-07T16:00:00.000Z",
      endsOn: "2026-07-25T16:00:00.000Z",
    });
    expect(
      isDateWithinTerm(midyear, new Date("2026-06-29T12:00:00+08:00")),
    ).toBe(true);
  });

  it("ignores stale local picks for undated terms during midyear", () => {
    const terms = [
      { ...term(1252, SECOND_SEM_1252), classCount: 4351 },
      { ...term(1253, MIDYEAR_1253), classCount: 200 },
      { ...term(1251), classCount: 0 },
    ];
    const midyearDay = new Date("2026-06-29T08:00:00+08:00");

    expect(
      resolveInitialTermId(terms, {
        fromUrl: null,
        storedId: 1251,
        date: midyearDay,
      }),
    ).toBe(1253);
  });

  it("keeps a usable stored term during the same instructional window", () => {
    const terms = [
      { ...term(1252, SECOND_SEM_1252), classCount: 4351 },
      { ...term(1253, MIDYEAR_1253), classCount: 200 },
      { ...term(1251), classCount: 0 },
    ];
    const midyearDay = new Date("2026-06-29T08:00:00+08:00");

    expect(
      resolveInitialTermId(terms, {
        fromUrl: null,
        storedId: 1253,
        date: midyearDay,
      }),
    ).toBe(1253);
  });
});

describe("isFinalsWeek", () => {
  it("is false for every term until registrar windows are imported", () => {
    // TERM_CALENDAR_WINDOWS is empty on the BulSU fork; finalsWindowForTerm
    // has no entry, so isFinalsWeek can never report true.
    expect(
      isFinalsWeek(new Date("2026-05-18T12:00:00+08:00"), term(1252)),
    ).toBe(false);
    expect(
      isFinalsWeek(new Date("2026-12-03T12:00:00+08:00"), term(1261)),
    ).toBe(false);
  });
});

describe("finalsWindowLabel", () => {
  it("returns null while the windows map is empty", () => {
    expect(finalsWindowLabel(1261)).toBeNull();
    expect(finalsWindowLabel(1251)).toBeNull();
    expect(finalsWindowLabel(null)).toBeNull();
  });
});

describe("changeOfMatriculationLabel", () => {
  it("returns null while the COM map is empty", () => {
    expect(changeOfMatriculationLabel(1261)).toBeNull();
    expect(changeOfMatriculationLabel(1252)).toBeNull();
    expect(changeOfMatriculationLabel(null)).toBeNull();
  });
});

describe("changeOfMatriculationPeriod", () => {
  test("returns null for every term while the map is empty", () => {
    expect(changeOfMatriculationPeriod(1261)).toBeNull();
    expect(changeOfMatriculationPeriod(9999)).toBeNull();
    expect(changeOfMatriculationPeriod(null)).toBeNull();
  });
});

describe("formatDateRange", () => {
  test("shortens ranges inside one month or year", () => {
    expect(formatDateRange("2026-08-03", "2026-08-07")).toBe("Aug 3–7, 2026");
    expect(formatDateRange("2027-01-30", "2027-02-03")).toBe(
      "Jan 30 – Feb 3, 2027",
    );
    expect(formatDateRange("2026-12-28", "2027-01-02")).toBe(
      "Dec 28, 2026 – Jan 2, 2027",
    );
    expect(formatDateRange("2027-06-08", "2027-06-08")).toBe("Jun 8, 2027");
  });
});
