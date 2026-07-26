import { describe, expect, it } from "bun:test";
import {
  buildEventTimeline,
  buildYearTimeline,
  currentAcademicYearTerms,
  EVENT_MARKER_STEP_PCT,
  resolveTermWindow,
  termWindowStatus,
} from "./academic-calendar";
import type { Term } from "./types";

function term(id: number, overrides: Partial<Term> = {}): Term {
  return {
    id,
    label: `Term ${id}`,
    schoolYear: "2025-2026",
    semester: null,
    startsOn: null,
    endsOn: null,
    isDefault: false,
    isActive: true,
    sortOrder: id,
    classesImportedAt: null,
    version: 1,
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

const manilaNoon = (isoDate: string) => new Date(`${isoDate}T12:00:00+08:00`);

describe("resolveTermWindow", () => {
  it("prefers DB starts_on/ends_on over the hand-kept constants", () => {
    const window = resolveTermWindow(
      term(1252, { startsOn: "2026-01-05", endsOn: "2026-05-20" }),
    );
    expect(window).toEqual({ startsOn: "2026-01-05", endsOn: "2026-05-20" });
  });

  it("falls back to TERM_CALENDAR_WINDOWS when DB dates are missing (#335)", () => {
    expect(resolveTermWindow(term(1253))).toEqual({
      startsOn: "2026-06-08",
      endsOn: "2026-07-26",
    });
  });

  it("returns null for a term with no dates anywhere", () => {
    expect(resolveTermWindow(term(9999))).toBeNull();
  });
});

describe("termWindowStatus", () => {
  const window = { startsOn: "2026-01-19", endsOn: "2026-05-31" };

  it("is inclusive on both edges (Asia/Manila)", () => {
    expect(termWindowStatus(window, manilaNoon("2026-01-19"))).toBe(
      "in-session",
    );
    expect(termWindowStatus(window, manilaNoon("2026-05-31"))).toBe(
      "in-session",
    );
    expect(termWindowStatus(window, manilaNoon("2026-01-18"))).toBe("upcoming");
    expect(termWindowStatus(window, manilaNoon("2026-06-01"))).toBe("past");
  });

  it("uses the Manila calendar day, not the local/UTC one", () => {
    // 2026-01-18T23:00Z is already Jan 19 in Manila.
    expect(termWindowStatus(window, new Date("2026-01-18T23:00:00Z"))).toBe(
      "in-session",
    );
  });
});

describe("buildYearTimeline", () => {
  const terms = [
    term(1251, { startsOn: "2025-09-01", endsOn: "2025-12-31" }),
    term(1252, { startsOn: "2026-01-19", endsOn: "2026-05-31" }),
  ];

  it("pads the strip to month boundaries and positions segments by day", () => {
    const timeline = buildYearTimeline(terms, manilaNoon("2026-02-01"));
    expect(timeline).not.toBeNull();
    // Sep 1 2025 → May 31 2026 = 273 days.
    expect(timeline?.rangeStart).toBe("2025-09-01");
    expect(timeline?.rangeEnd).toBe("2026-05-31");
    expect(timeline?.months.map((month) => month.label)).toEqual([
      "Sep",
      "Oct",
      "Nov",
      "Dec",
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
    ]);

    const [first, second] = timeline?.segments ?? [];
    expect(first?.term.id).toBe(1251);
    expect(first?.startPct).toBe(0);
    // Sep–Dec = 122 of 273 days.
    expect(first?.widthPct).toBeCloseTo((122 / 273) * 100, 5);
    // Jan 19 is day index 140 of the strip.
    expect(second?.startPct).toBeCloseTo((140 / 273) * 100, 5);
    expect(second?.widthPct).toBeCloseTo((133 / 273) * 100, 5);
  });

  it("marks segment status and centers the today marker on its day", () => {
    const timeline = buildYearTimeline(terms, manilaNoon("2026-02-01"));
    expect(timeline?.segments.map((segment) => segment.status)).toEqual([
      "past",
      "in-session",
    ]);
    // Feb 1 is day index 153; marker sits mid-cell.
    expect(timeline?.todayPct).toBeCloseTo((153.5 / 273) * 100, 5);
  });

  it("drops the today marker when today is outside the strip", () => {
    const timeline = buildYearTimeline(terms, manilaNoon("2026-08-01"));
    expect(timeline?.todayPct).toBeNull();
  });

  it("returns null when no term has a resolvable window", () => {
    expect(
      buildYearTimeline([term(9999)], manilaNoon("2026-02-01")),
    ).toBeNull();
  });
});

describe("buildEventTimeline", () => {
  // Aug 1 → Dec 31 2026 = 153 days, the strip AY 2026-2027 1st sem produces.
  const strip = { rangeStart: "2026-08-01", rangeEnd: "2026-12-31" };
  const entry = (label: string, startsOn: string, endsOn = startsOn) => ({
    label,
    startsOn,
    endsOn,
  });

  it("places one entry per grid cell at the cell center", () => {
    const { markers } = buildEventTimeline(strip, [
      entry("a", "2026-08-01"),
      entry("b", "2026-12-31"),
    ]);
    expect(markers.map((marker) => marker.leftPct)).toEqual([2.5, 97.5]);
  });

  it("clusters same-cell entries into one marker with a count", () => {
    // A 5% cell is ~7.6 days on this strip; Sep 2/5/8 share one.
    const { markers } = buildEventTimeline(strip, [
      entry("first", "2026-09-02"),
      entry("second", "2026-09-05"),
      entry("third", "2026-09-08"),
      entry("later", "2026-11-20"),
    ]);
    expect(markers).toHaveLength(2);
    expect(markers[0]?.events.map((event) => event.label)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("keeps every marker a full grid step apart, even at 60 entries", () => {
    const dense = Array.from({ length: 60 }, (_, index) =>
      entry(
        `e${index}`,
        `2026-09-${String((index % 30) + 1).padStart(2, "0")}`,
      ),
    );
    const { markers } = buildEventTimeline(strip, dense);
    expect(markers.length).toBeGreaterThan(1);
    for (const [index, marker] of markers.entries()) {
      expect(marker.leftPct).toBeGreaterThanOrEqual(EVENT_MARKER_STEP_PCT / 2);
      expect(marker.leftPct).toBeLessThanOrEqual(
        100 - EVENT_MARKER_STEP_PCT / 2,
      );
      const previous = markers[index - 1];
      if (previous) {
        expect(marker.leftPct - previous.leftPct).toBeGreaterThanOrEqual(
          EVENT_MARKER_STEP_PCT,
        );
      }
    }
    expect(
      dense.every((item) =>
        markers.some((marker) => marker.events.includes(item)),
      ),
    ).toBe(true);
  });

  it("keeps entries that overlap the strip and pins them to its first day", () => {
    const { markers, months, outOfRangeCount } = buildEventTimeline(strip, [
      entry("summer-long", "2026-06-01", "2026-09-30"),
    ]);
    expect(outOfRangeCount).toBe(0);
    expect(markers[0]?.leftPct).toBe(2.5);
    expect(months[0]?.label).toBe("Aug 2026");
  });

  it("counts entries outside the strip instead of dropping them silently", () => {
    const { markers, months, outOfRangeCount } = buildEventTimeline(strip, [
      entry("before", "2026-07-04"),
      entry("after", "2027-02-14"),
      entry("inside", "2026-10-05"),
    ]);
    expect(outOfRangeCount).toBe(2);
    expect(markers).toHaveLength(1);
    expect(months.map((group) => group.label)).toEqual(["Oct 2026"]);
  });

  it("groups the list by month in calendar order", () => {
    const { months } = buildEventTimeline(strip, [
      entry("dec", "2026-12-15"),
      entry("aug-late", "2026-08-28"),
      entry("aug-early", "2026-08-03"),
    ]);
    expect(months.map((group) => group.key)).toEqual(["2026-08", "2026-12"]);
    expect(months[0]?.events.map((event) => event.label)).toEqual([
      "aug-early",
      "aug-late",
    ]);
  });

  it("returns empty groups when nothing falls in the year", () => {
    expect(buildEventTimeline(strip, [])).toEqual({
      markers: [],
      months: [],
      outOfRangeCount: 0,
    });
  });
});

describe("currentAcademicYearTerms", () => {
  const ay2526 = [
    term(1251, {
      startsOn: "2025-09-01",
      endsOn: "2025-12-31",
      schoolYear: "2025-2026",
    }),
    term(1252, {
      startsOn: "2026-01-19",
      endsOn: "2026-05-31",
      schoolYear: "2025-2026",
    }),
  ];
  const ay2627 = [
    term(1261, {
      startsOn: "2026-08-10",
      endsOn: "2026-12-20",
      schoolYear: "2026-2027",
    }),
  ];
  const all = [...ay2526, ...ay2627];

  it("picks the AY whose term is in session today", () => {
    const picked = currentAcademicYearTerms(all, manilaNoon("2026-02-01"));
    expect(picked.map((entry) => entry.id).sort()).toEqual([1251, 1252]);
  });

  it("between AYs, anchors on the next upcoming term", () => {
    const picked = currentAcademicYearTerms(all, manilaNoon("2026-07-01"));
    expect(picked.map((entry) => entry.id)).toEqual([1261]);
  });

  it("when everything is past, keeps the most recent AY", () => {
    const picked = currentAcademicYearTerms(ay2526, manilaNoon("2027-03-01"));
    expect(picked.map((entry) => entry.id).sort()).toEqual([1251, 1252]);
  });

  it("ignores inactive terms and terms without dates", () => {
    const picked = currentAcademicYearTerms(
      [
        ...ay2526,
        term(1249, {
          isActive: false,
          startsOn: "2026-01-01",
          endsOn: "2026-02-01",
        }),
        term(9999),
      ],
      manilaNoon("2026-02-01"),
    );
    expect(picked.map((entry) => entry.id).sort()).toEqual([1251, 1252]);
  });
});
